-- Backend tests for push notifications and website purges: what queues a push,
-- that each goes out once, preferences, devices and their RLS. Everything runs
-- in one transaction that is ROLLED BACK: nothing persists, and pg_net sends
-- nothing (it only sends after a commit). Every check looks only at the test
-- people's rows, since this runs on the live database alongside real ones.
--   npm run test:db
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.invalid', '{}', '{}', now(), now());
insert into public.profiles (id, username, display_name)
values
  ('00000000-0000-4000-a000-00000000000a', 'test_ana', 'Ana Test'),
  ('00000000-0000-4000-a000-00000000000b', 'test_ben', 'Ben Test');

-- ── Ana posts twice and turns on notifications on her phone ─────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select public.create_post('Stay soft.', 'editorial', '{"template":"editorial"}'::jsonb, null, null);
select public.create_post('Second   thought,
with a line break.', 'editorial', '{"template":"editorial"}'::jsonb, null, null);
select public.register_push_token('ExponentPushToken[ana-phone_1]');
do $$ begin
  begin
    perform public.register_push_token('not a token');
    raise exception 'a malformed token must be rejected';
  exception when check_violation then null;
  end;
end $$;

-- ── Ben likes, unlikes and likes again; Ana likes her own post ──────────
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-00000000000b', id from public.posts
where author_id = '00000000-0000-4000-a000-00000000000a' and text = 'Stay soft.';
delete from public.likes where user_id = '00000000-0000-4000-a000-00000000000b';
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-00000000000b', id from public.posts
where author_id = '00000000-0000-4000-a000-00000000000a' and text = 'Stay soft.';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-00000000000a', id from public.posts
where author_id = '00000000-0000-4000-a000-00000000000a' and text = 'Stay soft.';

reset role;
do $$ begin
  assert (select count(*) from public.push_deliveries
          where type = 'like' and recipient_id = '00000000-0000-4000-a000-00000000000a') = 1, 'like → unlike → like queues one push';
  assert not exists (select 1 from public.push_deliveries where actor_id = recipient_id), 'nobody is pushed about their own actions';
  assert exists (select 1 from net.http_request_queue q
                 where q.url = 'https://dicta-orcin.vercel.app/api/push'
                   and convert_from(q.body, 'utf8')::jsonb ->> 'id' = (select id::text from public.push_deliveries
                                                                       where type = 'like' and recipient_id = '00000000-0000-4000-a000-00000000000a')),
    'the push goes out through pg_net, naming its delivery';
end $$;

-- ── Follows both ways: only Ana has a device ───────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000a');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000b');

reset role;
do $$
declare
  v_to_ana text := (select id::text from public.push_deliveries where type = 'follow' and recipient_id = '00000000-0000-4000-a000-00000000000a');
  v_to_ben text := (select id::text from public.push_deliveries where type = 'follow' and recipient_id = '00000000-0000-4000-a000-00000000000b');
begin
  assert v_to_ana is not null and v_to_ben is not null, 'both follows are recorded';
  assert exists (select 1 from net.http_request_queue where url like '%/api/push' and convert_from(body, 'utf8')::jsonb ->> 'id' = v_to_ana),
    'Ana, who has a device, is pushed';
  assert not exists (select 1 from net.http_request_queue where url like '%/api/push' and convert_from(body, 'utf8')::jsonb ->> 'id' = v_to_ben),
    'Ben, who has no device, is not';
end $$;

-- ── Ben comments; Ana replies; Ben mentions Ana under his own post ─────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
insert into public.comments (post_id, author_id, body)
select id, '00000000-0000-4000-a000-00000000000b', 'This one stays with me.' from public.posts
where author_id = '00000000-0000-4000-a000-00000000000a' and text = 'Stay soft.';
select public.create_post('Ben''s own words.', 'editorial', '{"template":"editorial"}'::jsonb, null, null);
insert into public.comments (post_id, author_id, body)
select id, '00000000-0000-4000-a000-00000000000b', '@test_ana what do you think?' from public.posts
where author_id = '00000000-0000-4000-a000-00000000000b' and text = 'Ben''s own words.';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
insert into public.comments (post_id, author_id, parent_id, body)
select c.post_id, '00000000-0000-4000-a000-00000000000a', c.id, 'Thank you!' from public.comments c
where c.author_id = '00000000-0000-4000-a000-00000000000b' and c.body = 'This one stays with me.';

reset role;
do $$ begin
  assert (select count(*) from public.push_deliveries
          where type = 'comment' and recipient_id = '00000000-0000-4000-a000-00000000000a') = 1, 'a comment queues a push';
  assert (select count(*) from public.push_deliveries
          where type = 'reply' and recipient_id = '00000000-0000-4000-a000-00000000000b') = 1, 'a reply queues a push';
  assert exists (select 1 from public.notifications
                 where type = 'mention' and recipient_id = '00000000-0000-4000-a000-00000000000a'), 'the mention reached Activity';
  assert not exists (select 1 from public.push_deliveries where type = 'mention'), 'mentions are not pushed';
end $$;

-- ── Claiming: once, with the right words and screen ────────────────────
do $$
declare
  v_like uuid := (select id from public.push_deliveries where type = 'like' and recipient_id = '00000000-0000-4000-a000-00000000000a');
  v_follow uuid := (select id from public.push_deliveries where type = 'follow' and recipient_id = '00000000-0000-4000-a000-00000000000a');
  v_comment uuid := (select id from public.push_deliveries where type = 'comment' and recipient_id = '00000000-0000-4000-a000-00000000000a');
  v_post uuid := (select id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a' and text = 'Stay soft.');
  v_push jsonb;
begin
  v_push := public.claim_push(v_like);
  assert v_push ->> 'body' = 'Ben Test liked your quote “Stay soft.”', 'like: ' || (v_push ->> 'body');
  assert v_push ->> 'url' = '/post/' || v_post, 'a like opens the post';
  assert v_push -> 'tokens' = '["ExponentPushToken[ana-phone_1]"]'::jsonb, 'sent to Ana’s device';
  assert public.claim_push(v_like) is null, 'each push goes out once';

  v_push := public.claim_push(v_follow);
  assert v_push ->> 'body' = 'Ben Test started following you.' and v_push ->> 'url' = '/user/test_ben', 'a follow opens the follower';

  v_push := public.claim_push(v_comment);
  assert v_push ->> 'body' = 'Ben Test commented: “This one stays with me.”', 'comment: ' || (v_push ->> 'body');
  assert v_push ->> 'then' = '/post/' || v_post || '/comments', 'a comment opens the comments';
end $$;

-- ── A like taken back before its push goes out sends nothing ───────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-00000000000b', id from public.posts
where author_id = '00000000-0000-4000-a000-00000000000a' and text like 'Second%';
delete from public.likes
where user_id = '00000000-0000-4000-a000-00000000000b'
  and post_id = (select id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a' and text like 'Second%');
reset role;
do $$ begin
  assert public.claim_push((select d.id from public.push_deliveries d join public.posts p on p.id = d.post_id
                            where p.author_id = '00000000-0000-4000-a000-00000000000a' and p.text like 'Second%'
                              and d.actor_id = '00000000-0000-4000-a000-00000000000b')) is null,
    'an unliked like is not pushed';
end $$;

-- ── Preferences ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
-- The app's upsert, as PostgREST sends it.
insert into public.push_settings (user_id, comments) values ('00000000-0000-4000-a000-00000000000a', false)
on conflict (user_id) do update set user_id = excluded.user_id, comments = excluded.comments;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
insert into public.comments (post_id, author_id, body)
select id, '00000000-0000-4000-a000-00000000000b', 'Another thought.' from public.posts
where author_id = '00000000-0000-4000-a000-00000000000a' and text = 'Stay soft.';
do $$ begin
  assert (select count(*) from public.push_settings) = 0, 'people only see their own settings';
  begin
    insert into public.push_settings (user_id, comments) values ('00000000-0000-4000-a000-00000000000a', true);
    raise exception 'nobody can change someone else''s settings';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert public.claim_push((select d.id from public.push_deliveries d join public.comments c on c.id = d.comment_id
                            where c.author_id = '00000000-0000-4000-a000-00000000000b' and c.body = 'Another thought.')) is null,
    'kinds someone turned off are not pushed';
end $$;

-- ── Devices ────────────────────────────────────────────────────────────
do $$ begin
  assert not has_function_privilege('anon', 'public.register_push_token(text)', 'execute'), 'only signed-in people register devices';
  assert not has_function_privilege('authenticated', 'public.claim_push(uuid)', 'execute'), 'only the server claims pushes';
end $$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.push_tokens) = 0, 'people only see their own devices';
  begin
    perform public.claim_push(gen_random_uuid());
    raise exception 'the app must not claim pushes';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Ben signs in on Ana's phone: the phone is his now.
select public.register_push_token('ExponentPushToken[ana-phone_1]');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
delete from public.push_tokens where token = 'ExponentPushToken[ana-phone_1]';
reset role;
do $$ begin
  assert (select user_id from public.push_tokens where token = 'ExponentPushToken[ana-phone_1]') = '00000000-0000-4000-a000-00000000000b',
    'a device follows whoever signed in last, and only its owner can remove it';
end $$;

-- ── The website's cache: deleted and hidden posts are purged ───────────
create temporary table test_posts on commit drop as
select id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
delete from public.posts where author_id = '00000000-0000-4000-a000-00000000000a' and text = 'Stay soft.';
reset role;
update public.posts set status = 'hidden' where author_id = '00000000-0000-4000-a000-00000000000a' and text like 'Second%';
do $$ begin
  assert (select count(*) from net.http_request_queue q join test_posts t on q.url = 'https://dicta-orcin.vercel.app/api/purge?post=' || t.id) = 2,
    'deleting or hiding a post purges it from the website';
end $$;

rollback;
