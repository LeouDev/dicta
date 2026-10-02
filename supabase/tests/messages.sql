-- Backend tests for direct messages: one conversation per pair, landing in
-- requests unless the recipient follows the sender; only the two people read
-- it; replying accepts; pushes only for accepted, unmuted chats, once each;
-- clearing hides what came before; blocking stops it; unsend is the sender's;
-- reports keep a copy. ROLLED BACK: nothing persists.
--   npm run test:db
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana4@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben4@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cai4@test.invalid', '{}', '{}', now(), now());
insert into public.profiles (id, username, display_name)
values
  ('00000000-0000-4000-a000-0000000000a4', 'test_ana4', 'Ana Test'),
  ('00000000-0000-4000-a000-0000000000b4', 'test_ben4', 'Ben Test'),
  ('00000000-0000-4000-a000-0000000000c4', 'test_cai4', 'Cai Test');
create temp table w as select convert_from(decode('cG9ybg==', 'base64'), 'utf8') as word;
grant select on w to authenticated;
-- The test chat's id, filled in once Ana starts it.
create temp table chat (id uuid);
grant select, insert on chat to authenticated;

-- ── Both have phones; Ana writes to Ben, who doesn't follow her ────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b4","role":"authenticated"}';
select public.register_push_token('ExponentPushToken[ben4-phone]');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a4","role":"authenticated"}';
select public.register_push_token('ExponentPushToken[ana4-phone]');
insert into chat select public.start_conversation('00000000-0000-4000-a000-0000000000b4');
insert into public.messages (conversation_id, sender_id, body)
select id, '00000000-0000-4000-a000-0000000000a4', 'Hi Ben' from chat;

do $$ declare word text := (select w.word from w); begin
  assert public.start_conversation('00000000-0000-4000-a000-0000000000b4') = (select id from chat), 'one conversation per pair';
  begin
    perform public.start_conversation('00000000-0000-4000-a000-0000000000a4');
    raise exception 'Ana started a chat with herself';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-4000-a000-0000000000a4', 'so ' || word from chat;
    raise exception 'a blocked word was sent';
  exception when check_violation then null;
  end;
  begin
    insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-4000-a000-0000000000a4', '   ' from chat;
    raise exception 'an empty message was sent';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-4000-a000-0000000000b4', 'As Ben' from chat;
    raise exception 'Ana sent a message as Ben';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert not (select accepted from public.conversation_members
              where conversation_id = (select id from chat) and user_id = '00000000-0000-4000-a000-0000000000b4'),
    'it waits in Ben''s requests (he doesn''t follow Ana)';
  assert not exists (select 1 from net.http_request_queue q
                     where convert_from(q.body, 'utf8')::jsonb ? 'message'
                       and convert_from(q.body, 'utf8')::jsonb ->> 'message' in (select m.id::text from public.messages m where m.conversation_id = (select id from chat))),
    'and isn''t pushed';
end $$;

-- Cai can't read it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c4","role":"authenticated"}';
do $$ begin
  assert not exists (select 1 from public.messages where conversation_id = (select id from chat)), 'outsiders can''t read';
  assert not exists (select 1 from public.conversations where id = (select id from chat)), 'or see the conversation';
  begin
    insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-4000-a000-0000000000c4', 'Hello?' from chat;
    raise exception 'Cai wrote into someone else''s chat';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Ben sees the request, replies (which accepts), and reads ───────────
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b4","role":"authenticated"}';
do $$ begin
  assert (select not accepted and last_body = 'Hi Ben' from public.my_conversations() where conversation_id = (select id from chat)),
    'Ben''s inbox lists it as a request';
end $$;
insert into public.messages (conversation_id, sender_id, body)
select id, '00000000-0000-4000-a000-0000000000b4', 'Hi   Ana,
good to hear from you' from chat;
update public.conversation_members set last_read_at = now()
where conversation_id = (select id from chat) and user_id = '00000000-0000-4000-a000-0000000000b4';
-- Read times come from the server's clock, not the phone's.
update public.conversation_members set last_read_at = now() + interval '1 hour'
where conversation_id = (select id from chat) and user_id = '00000000-0000-4000-a000-0000000000b4';
do $$ begin
  assert (select last_read_at from public.conversation_members
          where conversation_id = (select id from chat) and user_id = '00000000-0000-4000-a000-0000000000b4') = now(), 'the server''s time, not the phone''s';
end $$;

reset role;
do $$ declare v_push jsonb; begin
  assert (select accepted from public.conversation_members
          where conversation_id = (select id from chat) and user_id = '00000000-0000-4000-a000-0000000000b4'), 'replying accepts';
  v_push := public.claim_message_push((select id from public.messages where body like 'Hi   Ana%'));
  assert v_push = jsonb_build_object('tokens', jsonb_build_array('ExponentPushToken[ana4-phone]'),
                                     'body', 'Ben Test: Hi Ana, good to hear from you',
                                     'url', '/messages/' || (select id from chat), 'then', null),
    'Ana is pushed the reply, opening the chat';
  assert public.claim_message_push((select id from public.messages where body like 'Hi   Ana%')) is null, 'once';
  assert public.claim_message_push((select id from public.messages where body = 'Hi Ben')) is null,
    'and never for a message sent while it was still a request';
end $$;

-- ── Ana mutes the chat: Ben's next message isn't pushed ────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a4","role":"authenticated"}';
update public.conversation_members set muted = true
where conversation_id = (select id from chat) and user_id = '00000000-0000-4000-a000-0000000000a4';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b4","role":"authenticated"}';
insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-4000-a000-0000000000b4', 'Quiet one' from chat;
reset role;
do $$ begin
  assert public.claim_message_push((select id from public.messages where body = 'Quiet one')) is null, 'muted chats aren''t pushed';
end $$;

-- ── A shared quote, unsending, clearing ────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a4","role":"authenticated"}';
select public.create_post('Worth sharing', 'editorial', '{"template":"editorial"}'::jsonb);
insert into public.messages (conversation_id, sender_id, post_id)
select (select id from chat), '00000000-0000-4000-a000-0000000000a4', id from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a4' and text = 'Worth sharing';
insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-4000-a000-0000000000a4', 'Oops' from chat;
delete from public.messages where body = 'Oops' and sender_id = '00000000-0000-4000-a000-0000000000a4';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b4","role":"authenticated"}';
delete from public.messages where conversation_id = (select id from chat) and sender_id = '00000000-0000-4000-a000-0000000000a4';
do $$ begin
  assert (select count(*) from public.messages where conversation_id = (select id from chat)) = 4,
    'Ana''s unsent message is gone, and Ben can''t unsend hers';
  assert exists (select 1 from public.messages m join public.posts p on p.id = m.post_id
                 where m.conversation_id = (select id from chat) and p.text = 'Worth sharing'), 'the quote comes through';
end $$;

-- Ben reports Ana's first message; the report keeps its words.
insert into public.reports (reporter_id, message_id, reported_user_id, reason)
select '00000000-0000-4000-a000-0000000000b4', id, '00000000-0000-4000-a000-0000000000a4', 'harassment'
from public.messages where body = 'Hi Ben';

-- Ben clears the chat: older messages disappear for him only.
update public.conversation_members set cleared_at = now() + interval '1 second'
where conversation_id = (select id from chat) and user_id = '00000000-0000-4000-a000-0000000000b4';
do $$ begin
  assert not exists (select 1 from public.messages where conversation_id = (select id from chat)), 'cleared';
  assert not exists (select 1 from public.my_conversations() where conversation_id = (select id from chat)), 'and gone from his inbox';
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a4","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.messages where conversation_id = (select id from chat)) = 4, 'Ana still has hers';
end $$;

-- Cai can't report a message he can't see, even knowing its id.
reset role;
create temp table hi as select id from public.messages where body = 'Hi Ben';
grant select on hi to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c4","role":"authenticated"}';
do $$ begin
  begin
    insert into public.reports (reporter_id, message_id, reason)
    values ('00000000-0000-4000-a000-0000000000c4', (select id from hi), 'spam');
    raise exception 'Cai reported a message he can''t see';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Ben blocks Ana: neither can write, and the chat leaves Ana's inbox ──
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b4","role":"authenticated"}';
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-4000-a000-0000000000b4', '00000000-0000-4000-a000-0000000000a4');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a4","role":"authenticated"}';
do $$ begin
  begin
    insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-4000-a000-0000000000a4', 'Still there?' from chat;
    raise exception 'a blocked person could still write';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.start_conversation('00000000-0000-4000-a000-0000000000b4');
    raise exception 'a blocked person could start a chat';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from public.my_conversations() where conversation_id = (select id from chat)), 'the chat leaves her inbox';
end $$;

reset role;
do $$ begin
  assert (select snapshot from public.reports where reporter_id = '00000000-0000-4000-a000-0000000000b4') = 'Hi Ben',
    'the report kept the message''s words';
end $$;

rollback;
