-- Push notifications for new followers, likes, comments and replies, and
-- instant purges of the website's cache. Both are sent from the database with
-- pg_net once a change commits, so every path is covered: the app, account
-- deletion, moderation and the dashboard.
--
-- New tables, and why each is needed:
--   push_tokens      the devices to reach; nothing stored them before.
--   push_settings    which kinds of push someone wants; no row means all on.
--   push_deliveries  one row per push ever queued. Unlike and unfollow delete
--                    the notification, so only this table can remember that a
--                    like → unlike → like was already pushed.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint push_tokens_expo_format check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$')
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
create policy "Users see their devices" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users remove their devices" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.push_tokens to authenticated;

-- A device belongs to whoever signed in on it last, so pushes follow the
-- person holding the phone.
create or replace function public.register_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_tokens (token, user_id)
  values (p_token, (select auth.uid()))
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
$$;
grant execute on function public.register_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------

create table public.push_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  follows boolean not null default true,
  likes boolean not null default true,
  comments boolean not null default true,
  replies boolean not null default true
);

alter table public.push_settings enable row level security;
create policy "Users see their push settings" on public.push_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users save their push settings" on public.push_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users change their push settings" on public.push_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Upserts set every column they send, user_id included; the policies keep it the caller's.
grant select, insert (user_id, follows, likes, comments, replies), update (user_id, follows, likes, comments, replies)
  on public.push_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------

-- No policies or grants: only the database and the website's server use it.
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  post_id uuid,
  comment_id uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint push_deliveries_once unique nulls not distinct (recipient_id, actor_id, type, post_id, comment_id)
);
create index push_deliveries_actor_idx on public.push_deliveries (actor_id);
alter table public.push_deliveries enable row level security;

-- Queues the push for a new follow, like, comment or reply notification: once
-- per recipient, actor, kind, post and comment, and only for people with a
-- device. api/push.js sends it.
create or replace function private.queue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery uuid;
begin
  if new.type not in ('follow', 'like', 'comment', 'reply') then
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
revoke execute on function private.queue_push() from public;

create trigger notifications_after_insert_push
after insert on public.notifications
for each row execute function private.queue_push();

-- The push for one queued delivery, marked sent as it's read so it goes out at
-- most once. Null when it was sent already, its notification is gone (unliked,
-- unfollowed, blocked, deleted), that kind is turned off, or the recipient has
-- no device. Only the website's server calls it.
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
  if not found or not exists (select 1 from public.notifications where id = d.notification_id) then
    return null;
  end if;

  if not coalesce((
    select case d.type when 'follow' then s.follows when 'like' then s.likes when 'comment' then s.comments else s.replies end
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
  elsif d.type in ('comment', 'reply') then
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
      when 'like' then v_name || ' liked your quote “' || v_quote || '”'
      when 'comment' then v_name || ' commented: “' || v_quote || '”'
      else v_name || ' replied: “' || v_quote || '”'
    end,
    -- The screen the notification opens, as Activity opens it.
    'url', case when d.type = 'follow' then '/user/' || v_username else '/post/' || d.post_id end,
    'then', case when d.type in ('comment', 'reply') then '/post/' || d.post_id || '/comments' end
  );
end;
$$;
revoke execute on function public.claim_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_push(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Website cache
-- ---------------------------------------------------------------------------

-- When a post stops being public (deleted, hidden or removed, or gone with its
-- author's account), drop its page, artwork and link preview from the
-- website's cache at once. api/purge.js checks the post really is gone.
create or replace function private.purge_post_from_website()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(url := 'https://dicta-orcin.vercel.app/api/purge?post=' || old.id);
  return null;
end;
$$;
revoke execute on function private.purge_post_from_website() from public;

create trigger posts_after_delete_purge
after delete on public.posts
for each row execute function private.purge_post_from_website();

create trigger posts_after_unpublish_purge
after update of status on public.posts
for each row when (old.status = 'published' and new.status <> 'published')
execute function private.purge_post_from_website();
