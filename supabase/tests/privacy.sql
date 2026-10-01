-- Backend tests for private accounts: only followers (and the owner) see a
-- private account's posts, everywhere posts are read; following takes a
-- request, which notifies, can be withdrawn, declined or accepted; accepting
-- doesn't push a "started following you"; going public approves everyone
-- waiting; going private drops the posts from the website's cache; blocking
-- clears requests. ROLLED BACK: nothing persists.
--   npm run test:db
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana2@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben2@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cai2@test.invalid', '{}', '{}', now(), now());
insert into public.profiles (id, username, display_name)
values
  ('00000000-0000-4000-a000-0000000000a2', 'test_ana2', 'Ana Test'),
  ('00000000-0000-4000-a000-0000000000b2', 'test_ben2', 'Ben Test'),
  ('00000000-0000-4000-a000-0000000000c2', 'test_cai2', 'Cai Test');

-- ── Ana posts while public; Cai likes it; then Ana goes private ────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select public.create_post('Quiet words. #hush', 'editorial', '{"template":"editorial"}'::jsonb, null, null,
  '[{"text": "Second card", "template": "editorial", "design": {"template": "editorial"}}]'::jsonb);
select public.create_post('More quiet words.', 'editorial', '{"template":"editorial"}'::jsonb);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c2","role":"authenticated"}';
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-0000000000c2', id from public.posts where text = 'Quiet words. #hush';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
update public.profiles set is_private = true where id = '00000000-0000-4000-a000-0000000000a2';

reset role;
-- Ana's posts, for checks that must only look at the test people's rows.
create temp table ana_posts as select id from public.posts where author_id = '00000000-0000-4000-a000-0000000000a2';
grant select on ana_posts to anon, authenticated;
do $$ begin
  assert (select count(*) from net.http_request_queue q
          where q.url like 'https://dicta-orcin.vercel.app/api/purge?post=%'
            and substring(q.url from 'post=(.*)$')::uuid in (select id from public.posts where author_id = '00000000-0000-4000-a000-0000000000a2')) = 2,
    'going private drops both posts from the website''s cache';
end $$;

-- ── Ben, not a follower, sees nothing of Ana's, and can't just follow ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
do $$ begin
  assert not exists (select 1 from public.posts where author_id = '00000000-0000-4000-a000-0000000000a2'), 'no posts';
  assert not exists (select 1 from public.post_designs where post_id in (select id from ana_posts)), 'no designs';
  assert not exists (select 1 from public.post_cards where post_id in (select id from ana_posts)), 'no cards';
  assert not exists (select 1 from public.post_hashtags where post_id in (select id from ana_posts)), 'no hashtags';
  assert not exists (select 1 from public.likes where user_id = '00000000-0000-4000-a000-0000000000c2'), 'no likes on them';
  assert not exists (select 1 from public.search_posts('Quiet words') where author_id = '00000000-0000-4000-a000-0000000000a2'),
    'nothing in search';
  assert exists (select 1 from public.profiles where id = '00000000-0000-4000-a000-0000000000a2'), 'but the profile itself shows';
  begin
    insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-0000000000b2', '00000000-0000-4000-a000-0000000000a2');
    raise exception 'Ben followed a private account without asking';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The website (anon) sees nothing either.
reset role;
set local role anon;
set local request.jwt.claims = '{}';
do $$ begin
  assert not exists (select 1 from public.posts where author_id = '00000000-0000-4000-a000-0000000000a2'), 'the website can''t show them';
end $$;

-- ── Ben asks, withdraws, asks again; Ana sees the request ──────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
insert into public.follow_requests (requester_id, target_id) values ('00000000-0000-4000-a000-0000000000b2', '00000000-0000-4000-a000-0000000000a2');
delete from public.follow_requests where requester_id = '00000000-0000-4000-a000-0000000000b2';
insert into public.follow_requests (requester_id, target_id) values ('00000000-0000-4000-a000-0000000000b2', '00000000-0000-4000-a000-0000000000a2');
do $$ begin
  assert (select public.requested_by_me(p) from public.profiles p where p.id = '00000000-0000-4000-a000-0000000000a2'),
    'Ben sees his request is pending';
  begin
    insert into public.follow_requests (requester_id, target_id) values ('00000000-0000-4000-a000-0000000000b2', '00000000-0000-4000-a000-0000000000c2');
    raise exception 'a request to a public account went through';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.notifications where type = 'follow_request'
          and recipient_id = '00000000-0000-4000-a000-0000000000a2') = 1,
    'one request notification, withdrawing took the first away';
  assert exists (select 1 from public.follow_requests where target_id = '00000000-0000-4000-a000-0000000000a2'), 'Ana sees the request';
end $$;

-- Ben has a device, so the acceptance can be pushed to him.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
select public.register_push_token('ExponentPushToken[ben2-phone]');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
select public.register_push_token('ExponentPushToken[ana2-phone]');

-- ── Ana accepts ────────────────────────────────────────────────────────
select public.accept_follow_request('00000000-0000-4000-a000-0000000000b2');
select public.accept_follow_request('00000000-0000-4000-a000-0000000000b2'); -- twice is fine

reset role;
do $$ begin
  assert exists (select 1 from public.follows where follower_id = '00000000-0000-4000-a000-0000000000b2'
                 and following_id = '00000000-0000-4000-a000-0000000000a2'), 'Ben follows Ana';
  assert not exists (select 1 from public.follow_requests where target_id = '00000000-0000-4000-a000-0000000000a2'), 'the request is answered';
  assert not exists (select 1 from public.notifications where type = 'follow_request'
                     and recipient_id = '00000000-0000-4000-a000-0000000000a2'), 'its notification is gone';
  assert (select read_at from public.notifications where type = 'follow'
          and recipient_id = '00000000-0000-4000-a000-0000000000a2') is not null, 'the follow lands already read';
  assert public.claim_push((select id from public.push_deliveries where type = 'follow'
                            and recipient_id = '00000000-0000-4000-a000-0000000000a2')) is null,
    'so it isn''t pushed back to Ana';
  assert public.claim_push((select id from public.push_deliveries where type = 'follow_accept'
                            and recipient_id = '00000000-0000-4000-a000-0000000000b2'))
         = '{"tokens": ["ExponentPushToken[ben2-phone]"], "body": "Ana Test accepted your follow request.", "url": "/user/test_ana2", "then": null}'::jsonb,
    'Ben is told, opening Ana''s profile';
end $$;

-- Now Ben sees her posts, cards and likes.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.posts where author_id = '00000000-0000-4000-a000-0000000000a2') = 2, 'a follower sees the posts';
  assert (select count(*) from public.post_cards where post_id in (select id from ana_posts)) = 1, 'and their cards';
  assert exists (select 1 from public.likes where user_id = '00000000-0000-4000-a000-0000000000c2'), 'and who liked them';
  assert (select count(*) from public.home_feed(null, null, 50) where author_id = '00000000-0000-4000-a000-0000000000a2') = 2,
    'in his feed';
end $$;

-- ── Cai asks; Ana declines; Cai asks again; Ana goes public ────────────
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c2","role":"authenticated"}';
insert into public.follow_requests (requester_id, target_id) values ('00000000-0000-4000-a000-0000000000c2', '00000000-0000-4000-a000-0000000000a2');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
delete from public.follow_requests where requester_id = '00000000-0000-4000-a000-0000000000c2';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c2","role":"authenticated"}';
insert into public.follow_requests (requester_id, target_id) values ('00000000-0000-4000-a000-0000000000c2', '00000000-0000-4000-a000-0000000000a2');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
update public.profiles set is_private = false where id = '00000000-0000-4000-a000-0000000000a2';

reset role;
do $$ begin
  assert exists (select 1 from public.follows where follower_id = '00000000-0000-4000-a000-0000000000c2'
                 and following_id = '00000000-0000-4000-a000-0000000000a2'), 'going public approves the waiting request';
  assert not exists (select 1 from public.follow_requests where target_id = '00000000-0000-4000-a000-0000000000a2'), 'nobody is left waiting';
  assert (select read_at from public.notifications where type = 'follow' and actor_id = '00000000-0000-4000-a000-0000000000c2'
          and recipient_id = '00000000-0000-4000-a000-0000000000a2') is not null, 'quietly';
end $$;

-- ── Private again: Cai unfollows and asks; Ana blocks Cai ──────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
update public.profiles set is_private = true where id = '00000000-0000-4000-a000-0000000000a2';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c2","role":"authenticated"}';
delete from public.follows where follower_id = '00000000-0000-4000-a000-0000000000c2';
insert into public.follow_requests (requester_id, target_id) values ('00000000-0000-4000-a000-0000000000c2', '00000000-0000-4000-a000-0000000000a2');
do $$ begin
  assert not exists (select 1 from public.posts where author_id = '00000000-0000-4000-a000-0000000000a2'), 'unfollowing loses access';
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a2","role":"authenticated"}';
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-4000-a000-0000000000a2', '00000000-0000-4000-a000-0000000000c2');

reset role;
do $$ begin
  assert not exists (select 1 from public.follow_requests where requester_id = '00000000-0000-4000-a000-0000000000c2'),
    'blocking clears the request';
end $$;

rollback;
