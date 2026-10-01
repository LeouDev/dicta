-- Private accounts (1.0.3).
--
-- New, and why each is needed:
--   profiles.is_private  the switch in Settings → Privacy.
--   follow_requests      who asked to follow a private account; a follow only
--                        exists once the owner accepts, so follows keeps
--                        meaning "accepted" everywhere it's already used.
--   private.can_see      who may see an author's posts (and, later, stories):
--                        themselves, anyone for a public account, followers for
--                        a private one, and never across a block. The posts
--                        policy uses it, and everything that reads posts
--                        through RLS follows (designs, hashtags, comments,
--                        likes, feeds, search, the website, which reads with
--                        the public key). Privacy is enforced here, not only
--                        in the app, so posts can't be fetched around it.

alter table public.profiles add column is_private boolean not null default false;
grant update (is_private) on public.profiles to authenticated;

create table public.follow_requests (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint follow_requests_not_self check (requester_id <> target_id)
);
create index follow_requests_target_idx on public.follow_requests (target_id, created_at desc);

create or replace function private.can_see(author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select author = (select auth.uid())
    or (
      not private.blocked_with(author)
      and (
        not coalesce((select p.is_private from public.profiles p where p.id = author), false)
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid()) and f.following_id = author
        )
      )
    );
$$;
revoke execute on function private.can_see(uuid) from public;
grant execute on function private.can_see(uuid) to anon, authenticated;

drop policy "Published posts are visible" on public.posts;
create policy "Published posts are visible" on public.posts
  for select to anon, authenticated using (
    author_id = (select auth.uid())
    or (status = 'published' and private.can_see(author_id))
  );

-- Who liked what was public; now it follows the post (your own likes always show).
drop policy "Likes are public" on public.likes;
create policy "Likes on visible posts are visible" on public.likes
  for select to anon, authenticated using (
    user_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id)
  );

-- Following a private account takes a request instead.
drop policy "Users follow as themselves" on public.follows;
create policy "Users follow as themselves" on public.follows
  for insert to authenticated with check (
    follower_id = (select auth.uid())
    and not private.blocked_with(following_id)
    and not exists (select 1 from public.profiles p where p.id = following_id and p.is_private)
  );

alter table public.follow_requests enable row level security;
create policy "People see requests they sent or got" on public.follow_requests
  for select to authenticated using (requester_id = (select auth.uid()) or target_id = (select auth.uid()));
create policy "Users ask to follow private accounts" on public.follow_requests
  for insert to authenticated with check (
    requester_id = (select auth.uid())
    and not private.blocked_with(target_id)
    and exists (select 1 from public.profiles p where p.id = target_id and p.is_private)
    and not exists (select 1 from public.follows f where f.follower_id = requester_id and f.following_id = target_id)
  );
create policy "Requests are withdrawn or declined" on public.follow_requests
  for delete to authenticated using (requester_id = (select auth.uid()) or target_id = (select auth.uid()));
grant select, delete on public.follow_requests to authenticated;
grant insert (requester_id, target_id) on public.follow_requests to authenticated;

-- A request notifies the account's owner; withdrawing or answering it takes the notification away.
create or replace function public.on_follow_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.target_id, new.requester_id, 'follow_request');
    return new;
  end if;
  delete from public.notifications
  where type = 'follow_request' and actor_id = old.requester_id and recipient_id = old.target_id;
  return old;
end;
$$;

create trigger follow_requests_after_change
after insert or delete on public.follow_requests
for each row execute function public.on_follow_request_change();

-- Accepting makes the follow (which a private account's policy wouldn't let the
-- requester make) and tells the requester. The new follower's "started
-- following you" lands in Activity already read, so accepting doesn't push it back.
create or replace function public.accept_follow_request(p_requester uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  delete from public.follow_requests where requester_id = p_requester and target_id = v_me;
  if not found then
    return; -- withdrawn meanwhile, or already answered
  end if;
  insert into public.follows (follower_id, following_id) values (p_requester, v_me) on conflict do nothing;
  update public.notifications set read_at = now()
  where recipient_id = v_me and actor_id = p_requester and type = 'follow' and read_at is null;
  insert into public.notifications (recipient_id, actor_id, type) values (p_requester, v_me, 'follow_accept');
end;
$$;
revoke execute on function public.accept_follow_request(uuid) from public;
grant execute on function public.accept_follow_request(uuid) to authenticated;

-- Computed field beside followed_by_me: select('*, followed_by_me, requested_by_me').
create or replace function public.requested_by_me(profile public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.follow_requests
    where target_id = profile.id and requester_id = (select auth.uid())
  );
$$;
grant execute on function public.requested_by_me(public.profiles) to anon, authenticated;

-- Going public approves everyone waiting (quietly: their follows land read).
-- Going private drops the account's posts from the website's cache at once.
create or replace function public.on_profile_privacy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester uuid;
begin
  if old.is_private and not new.is_private then
    for v_requester in
      delete from public.follow_requests where target_id = new.id returning requester_id
    loop
      insert into public.follows (follower_id, following_id) values (v_requester, new.id) on conflict do nothing;
      update public.notifications set read_at = now()
      where recipient_id = new.id and actor_id = v_requester and type = 'follow' and read_at is null;
    end loop;
  elsif new.is_private and not old.is_private then
    perform net.http_post(url := 'https://dicta-orcin.vercel.app/api/purge?post=' || p.id)
    from public.posts p
    where p.author_id = new.id and p.status = 'published';
  end if;
  return null;
end;
$$;
revoke execute on function public.on_profile_privacy_change() from public;

create trigger profiles_after_privacy_change
after update of is_private on public.profiles
for each row when (old.is_private is distinct from new.is_private)
execute function public.on_profile_privacy_change();

-- Blocking also clears follow requests either way.
create or replace function public.on_block_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  delete from public.follow_requests
  where (requester_id = new.blocker_id and target_id = new.blocked_id)
     or (requester_id = new.blocked_id and target_id = new.blocker_id);
  delete from public.notifications
  where (recipient_id = new.blocker_id and actor_id = new.blocked_id)
     or (recipient_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end;
$$;

-- Pushes for requests and acceptances, under the "New followers" switch.
create or replace function private.queue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery uuid;
begin
  if new.type not in ('follow', 'like', 'comment', 'reply', 'mention', 'follow_request', 'follow_accept') then
    return null;
  end if;
  -- A repeat before the push went out (like → unlike → like within a second)
  -- points the queued push at the new notification; after it, it's dropped.
  insert into public.push_deliveries (notification_id, recipient_id, actor_id, type, post_id, comment_id)
  values (new.id, new.recipient_id, new.actor_id, new.type, new.post_id, new.comment_id)
  on conflict on constraint push_deliveries_once do update
    set notification_id = excluded.notification_id
    where push_deliveries.sent_at is null
  returning id into v_delivery;
  if v_delivery is not null and exists (select 1 from public.push_tokens where user_id = new.recipient_id) then
    perform net.http_post(
      url := 'https://dicta-orcin.vercel.app/api/push',
      body := jsonb_build_object('id', v_delivery),
      timeout_milliseconds := 10000
    );
  end if;
  return null;
end;
$$;

-- As before, plus: no push for a notification that's already been read (an
-- accepted request's follow), and the request and acceptance messages.
create or replace function public.claim_push(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.push_deliveries;
  v_tokens text[];
  v_name text;
  v_username text;
  v_quote text;
begin
  update public.push_deliveries set sent_at = now()
  where id = p_id and sent_at is null
  returning * into d;
  if not found or not exists (
    select 1 from public.notifications where id = d.notification_id and read_at is null
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = d.recipient_id and b.blocked_id = d.actor_id)
       or (b.blocker_id = d.actor_id and b.blocked_id = d.recipient_id)
  ) then
    return null;
  end if;

  if not coalesce((
    select case
      when d.type in ('follow', 'follow_request', 'follow_accept') then s.follows
      when d.type = 'like' then s.likes
      when d.type = 'comment' then s.comments
      else s.replies
    end
    from public.push_settings s
    where s.user_id = d.recipient_id
  ), true) then
    return null;
  end if;

  select array_agg(t.token order by t.updated_at desc) into v_tokens
  from public.push_tokens t
  where t.user_id = d.recipient_id;
  if v_tokens is null then
    return null;
  end if;

  select p.display_name, p.username into v_name, v_username from public.profiles p where p.id = d.actor_id;
  if d.type = 'like' then
    select p.text into v_quote from public.posts p where p.id = d.post_id;
  elsif d.type in ('comment', 'reply', 'mention') then
    select c.body into v_quote from public.comments c where c.id = d.comment_id;
  end if;
  v_quote := btrim(regexp_replace(coalesce(v_quote, ''), '\s+', ' ', 'g'));
  if char_length(v_quote) > 80 then
    v_quote := left(v_quote, 79) || '…';
  end if;

  return jsonb_build_object(
    'tokens', to_jsonb(v_tokens),
    'body', case d.type
      when 'follow' then v_name || ' started following you.'
      when 'follow_request' then v_name || ' asked to follow you.'
      when 'follow_accept' then v_name || ' accepted your follow request.'
      when 'like' then v_name || ' liked your quote “' || v_quote || '”'
      when 'comment' then v_name || ' commented: “' || v_quote || '”'
      when 'mention' then v_name || ' mentioned you: “' || v_quote || '”'
      else v_name || ' replied: “' || v_quote || '”'
    end,
    -- The screen the notification opens, as Activity opens it.
    'url', case
      when d.type in ('follow', 'follow_accept') then '/user/' || v_username
      when d.type = 'follow_request' then '/requests'
      else '/post/' || d.post_id
    end,
    'then', case when d.type in ('comment', 'reply', 'mention') then '/post/' || d.post_id || '/comments' end
  );
end;
$$;
