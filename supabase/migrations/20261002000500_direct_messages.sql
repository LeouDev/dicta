-- Direct messages (1.0.3): one-to-one chats with words, shared quotes and
-- story replies. New tables, and why:
--   conversations         one per pair of people (user_a < user_b, so a pair
--                         can only have one), and when it last moved.
--   conversation_members  each person's side: whether they've accepted it
--                         (a message from someone they don't follow waits in
--                         their requests), what they've read, what they've
--                         cleared, and whether it's muted.
--   messages              the messages, readable only by the two people in
--                         the chat, never across a block, and through the
--                         same word filter as everything else.
-- Pushes go out like the others (pg_net → api/push → Expo), but only for
-- accepted, unmuted chats; requests wait quietly in Messages.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  constraint conversations_ordered_pair check (user_a < user_b),
  constraint conversations_pair_key unique (user_a, user_b)
);
create index conversations_user_b_idx on public.conversations (user_b);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  accepted boolean not null default false,
  last_read_at timestamptz,
  cleared_at timestamptz,
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  post_id uuid references public.posts (id) on delete set null,
  story_id uuid references public.stories (id) on delete set null,
  created_at timestamptz not null default now(),
  -- When its push was claimed (claim_message_push), so it goes out at most once.
  push_sent_at timestamptz,
  constraint messages_body_length check (body is null or char_length(btrim(body)) between 1 and 1000)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);
create index messages_post_idx on public.messages (post_id) where post_id is not null;
create index messages_story_idx on public.messages (story_id) where story_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
create policy "People see their conversations" on public.conversations
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));
grant select on public.conversations to authenticated;

-- Both sides of your conversations (read receipts need the other person's).
alter table public.conversation_members enable row level security;
create policy "People see both sides of their conversations" on public.conversation_members
  for select to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.user_a, c.user_b))
  );
create policy "People manage their own side" on public.conversation_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.conversation_members to authenticated;
grant update (accepted, last_read_at, cleared_at, muted) on public.conversation_members to authenticated;

alter table public.messages enable row level security;
create policy "People read their conversations" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.user_id = (select auth.uid())
        and (m.cleared_at is null or messages.created_at > m.cleared_at)
    )
  );
-- A message has words, a quote or a story; the quote or story must be one the sender can see.
create policy "People write in their conversations" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and ((body is not null and char_length(btrim(body)) between 1 and 1000) or post_id is not null or story_id is not null)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (select auth.uid()) in (c.user_a, c.user_b)
        and not private.blocked_with(case when c.user_a = (select auth.uid()) then c.user_b else c.user_a end)
    )
    and (post_id is null or exists (select 1 from public.posts p where p.id = post_id))
    and (story_id is null or exists (select 1 from public.stories s where s.id = story_id))
  );
create policy "Senders unsend their messages" on public.messages
  for delete to authenticated using (sender_id = (select auth.uid()));
grant select, delete on public.messages to authenticated;
grant insert (conversation_id, sender_id, body, post_id, story_id) on public.messages to authenticated;

create trigger messages_reject_objectionable
before insert on public.messages
for each row execute function private.reject_objectionable('body');

-- ---------------------------------------------------------------------------
-- Starting a chat, sending, the inbox
-- ---------------------------------------------------------------------------

-- The conversation with someone, made the first time. It lands in their
-- requests unless they follow you.
create or replace function public.start_conversation(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_user is null or p_user = v_me or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'There''s no one to message' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.blocks
    where (blocker_id = v_me and blocked_id = p_user) or (blocker_id = p_user and blocked_id = v_me)
  ) then
    raise exception 'blocked' using errcode = '42501';
  end if;

  insert into public.conversations (user_a, user_b)
  values (least(v_me, p_user), greatest(v_me, p_user))
  on conflict on constraint conversations_pair_key do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.conversations where user_a = least(v_me, p_user) and user_b = greatest(v_me, p_user);
    return v_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id, accepted)
  values
    (v_id, v_me, true),
    (v_id, p_user, exists (select 1 from public.follows where follower_id = p_user and following_id = v_me));
  return v_id;
end;
$$;
revoke execute on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Whether a message is pushed is decided as it's sent: only when the other
-- person has accepted the chat, hasn't muted it and has a device. Any other
-- message is marked as handled, so claiming it later (the endpoint is public)
-- sends nothing, even once the chat has been accepted.
create or replace function private.on_message_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.conversation_members m
    where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
      and m.accepted and not m.muted
      and exists (select 1 from public.push_tokens t where t.user_id = m.user_id)
  ) then
    new.push_sent_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function private.on_message_before_insert() from public;

create trigger messages_before_insert
before insert on public.messages
for each row execute function private.on_message_before_insert();

-- After a message: the chat moves to the top, replying accepts a request, and
-- the push goes out when one was decided on.
create or replace function private.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set accepted = true
  where conversation_id = new.conversation_id and user_id = new.sender_id and not accepted;

  if new.push_sent_at is null then
    -- A message must never fail because its push couldn't be queued.
    begin
      perform net.http_post(
        url := 'https://dicta-orcin.vercel.app/api/push',
        body := jsonb_build_object('message', new.id),
        timeout_milliseconds := 10000
      );
    exception when others then
      raise warning 'push for message % not queued: %', new.id, sqlerrm;
    end;
  end if;
  return null;
end;
$$;
revoke execute on function private.on_message_insert() from public;

create trigger messages_after_insert
after insert on public.messages
for each row execute function private.on_message_insert();

-- Your conversations, newest message first, with the other person and the last
-- message you can see. Chats with no visible messages (new, or cleared) and
-- chats across a block are left out.
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  accepted boolean,
  muted boolean,
  last_read_at timestamptz,
  other_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_url text,
  other_is_verified boolean,
  other_last_read_at timestamptz,
  last_message_id uuid,
  last_sender_id uuid,
  last_body text,
  last_post_id uuid,
  last_story_id uuid,
  last_message_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, me.accepted, me.muted, me.last_read_at,
         p.id, p.username, p.display_name, p.avatar_url, p.is_verified, them.last_read_at,
         lm.id, lm.sender_id, lm.body, lm.post_id, lm.story_id, lm.created_at
  from public.conversations c
  join public.conversation_members me on me.conversation_id = c.id and me.user_id = (select auth.uid())
  join public.conversation_members them on them.conversation_id = c.id and them.user_id <> (select auth.uid())
  join public.profiles p on p.id = them.user_id
  join lateral (
    select m.id, m.sender_id, m.body, m.post_id, m.story_id, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where not private.blocked_with(p.id)
  order by lm.created_at desc
  limit 200;
$$;
revoke execute on function public.my_conversations() from public;
grant execute on function public.my_conversations() to authenticated;

-- ---------------------------------------------------------------------------
-- Pushes
-- ---------------------------------------------------------------------------

alter table public.push_settings add column messages boolean not null default true;
grant insert (messages), update (messages) on public.push_settings to authenticated;

-- The push for one message, marked sent as it's read so it goes out at most
-- once. Null when it was sent already, was unsent, the chat isn't accepted or
-- is muted, messages are turned off, there's a block, or no device. Only the
-- website's server calls it.
create or replace function public.claim_message_push(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.messages;
  v_other uuid;
  v_tokens text[];
  v_name text;
  v_text text;
begin
  update public.messages set push_sent_at = now()
  where id = p_id and push_sent_at is null
  returning * into m;
  if not found then
    return null;
  end if;

  select cm.user_id into v_other from public.conversation_members cm
  where cm.conversation_id = m.conversation_id and cm.user_id <> m.sender_id and cm.accepted and not cm.muted;
  if v_other is null then
    return null;
  end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_other and b.blocked_id = m.sender_id)
       or (b.blocker_id = m.sender_id and b.blocked_id = v_other)
  ) then
    return null;
  end if;
  if not coalesce((select s.messages from public.push_settings s where s.user_id = v_other), true) then
    return null;
  end if;

  select array_agg(t.token order by t.updated_at desc) into v_tokens
  from public.push_tokens t
  where t.user_id = v_other;
  if v_tokens is null then
    return null;
  end if;

  select p.display_name into v_name from public.profiles p where p.id = m.sender_id;
  v_text := btrim(regexp_replace(coalesce(m.body, ''), '\s+', ' ', 'g'));
  if char_length(v_text) > 120 then
    v_text := left(v_text, 119) || '…';
  end if;

  return jsonb_build_object(
    'tokens', to_jsonb(v_tokens),
    'body', case
      when v_text <> '' then v_name || ': ' || v_text
      when m.post_id is not null then v_name || ' sent you a quote.'
      else v_name || ' replied to your story.'
    end,
    'url', '/messages/' || m.conversation_id,
    'then', null
  );
end;
$$;
revoke execute on function public.claim_message_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_message_push(uuid) to service_role;

-- Live chats: new messages and read receipts reach the open conversation (RLS
-- decides who receives what).
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_members;

-- ---------------------------------------------------------------------------
-- Reports for stories and messages
-- ---------------------------------------------------------------------------
-- A story expires and a message can be unsent, so the report keeps a copy of
-- the words (snapshot) for the moderator.

alter table public.reports add column story_id uuid references public.stories (id) on delete set null;
alter table public.reports add column message_id uuid references public.messages (id) on delete set null;
alter table public.reports add column snapshot text;

drop policy "Users file reports as themselves" on public.reports;
create policy "Users file reports as themselves" on public.reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and num_nonnulls(post_id, reported_user_id, comment_id, story_id, message_id) >= 1
    -- Only what the reporter can see: their own conversations' messages, visible stories.
    and (message_id is null or exists (select 1 from public.messages m where m.id = message_id))
    and (story_id is null or exists (select 1 from public.stories s where s.id = story_id))
  );
grant insert (story_id, message_id) on public.reports to authenticated;

create or replace function private.snapshot_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.message_id is not null then
    select m.body into new.snapshot from public.messages m where m.id = new.message_id;
  elsif new.story_id is not null then
    select s.text into new.snapshot from public.stories s where s.id = new.story_id;
  end if;
  return new;
end;
$$;
revoke execute on function private.snapshot_report() from public;

create trigger reports_before_insert_snapshot
before insert on public.reports
for each row execute function private.snapshot_report();
