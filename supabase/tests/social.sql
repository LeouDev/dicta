-- Backend tests for the social layer: triggers, counters, notifications, RLS,
-- search and blocking, exercised as real users through the `authenticated` role.
-- Everything runs in one transaction that is ROLLED BACK: nothing persists.
--   npm run test:db
begin;

-- Fixtures (two throwaway users, never committed).
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.invalid', '{}', '{}', now(), now());
insert into public.profiles (id, username, display_name)
values
  ('00000000-0000-4000-a000-00000000000a', 'test_ana', 'Ana Test'),
  ('00000000-0000-4000-a000-00000000000b', 'test_ben', 'Ben Test');

set local role authenticated;

-- ── Ana publishes ────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
select public.create_post('Keep going. #Growth matters', 'editorial', '{"template":"editorial"}'::jsonb, 'growth', null);
do $$ begin
  assert (select posts_count from public.profiles where username = 'test_ana') = 1, 'post count increments';
  assert exists (select 1 from public.post_hashtags h join public.posts p on p.id = h.post_id
                 where p.author_id = '00000000-0000-4000-a000-00000000000a' and h.tag = 'growth'), 'hashtags are indexed lowercase';
  assert (select count(*) from public.post_designs d join public.posts p on p.id = d.post_id
          where p.author_id = '00000000-0000-4000-a000-00000000000a') = 1, 'design saved with the post';
end $$;

-- ── Likes (Ben) ──────────────────────────────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-00000000000b', id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a';
-- The app's duplicate-safe write: a repeat like is ignored, not double counted.
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-00000000000b', id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a'
on conflict do nothing;
do $$ begin
  assert (select like_count from public.posts where author_id = '00000000-0000-4000-a000-00000000000a') = 1, 'duplicate like is not counted';
  begin
    insert into public.likes (user_id, post_id)
    select '00000000-0000-4000-a000-00000000000b', id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a';
    assert false, 'plain duplicate like must be rejected';
  exception when unique_violation then null;
  end;
  begin
    insert into public.likes (user_id, post_id)
    select '00000000-0000-4000-a000-00000000000a', id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a';
    assert false, 'cannot like as someone else';
  exception when insufficient_privilege then null;
  end;
end $$;
delete from public.likes where user_id = '00000000-0000-4000-a000-00000000000b';
do $$ begin
  assert (select like_count from public.posts where author_id = '00000000-0000-4000-a000-00000000000a') = 0, 'unlike decrements';
end $$;
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-00000000000b', id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a';

-- ── Follows (Ben → Ana) ──────────────────────────────────────────────────
insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000a');
do $$ begin
  assert (select followers_count from public.profiles where username = 'test_ana') = 1, 'followers count increments';
  assert (select following_count from public.profiles where username = 'test_ben') = 1, 'following count increments';
  begin
    insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000b');
    assert false, 'self-follow must be rejected';
  exception when check_violation then null;
  end;
end $$;

-- ── Saves (Ben) ──────────────────────────────────────────────────────────
insert into public.saves (user_id, post_id)
select '00000000-0000-4000-a000-00000000000b', id from public.posts where author_id = '00000000-0000-4000-a000-00000000000a';
do $$ begin
  assert (select save_count from public.posts where author_id = '00000000-0000-4000-a000-00000000000a') = 1, 'save count increments';
  assert (select public.saved_by_me(p) from public.posts p where author_id = '00000000-0000-4000-a000-00000000000a'), 'saved_by_me is true for Ben';
  assert (select public.liked_by_me(p) from public.posts p where author_id = '00000000-0000-4000-a000-00000000000a'), 'liked_by_me is true for Ben';
end $$;

-- ── Comments + replies ───────────────────────────────────────────────────
insert into public.comments (post_id, author_id, body)
select id, '00000000-0000-4000-a000-00000000000b', 'This stays with me @test_ana' from public.posts where author_id = '00000000-0000-4000-a000-00000000000a';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.saves) = 0, 'saves are private to their owner';
end $$;
insert into public.comments (post_id, author_id, parent_id, body)
select c.post_id, '00000000-0000-4000-a000-00000000000a', c.id, 'Thank you @test_ben'
from public.comments c where c.author_id = '00000000-0000-4000-a000-00000000000b';
insert into public.comment_likes (user_id, comment_id)
select '00000000-0000-4000-a000-00000000000a', id from public.comments where author_id = '00000000-0000-4000-a000-00000000000b';
do $$ begin
  assert (select comment_count from public.posts where author_id = '00000000-0000-4000-a000-00000000000a') = 2, 'comment + reply counted';
  assert (select reply_count from public.comments where author_id = '00000000-0000-4000-a000-00000000000b') = 1, 'reply count on parent';
  assert (select like_count from public.comments where author_id = '00000000-0000-4000-a000-00000000000b') = 1, 'comment like counted';
  -- Ana's notifications: like, follow, comment (the @mention of the post author folds into "comment").
  assert (select count(*) from public.notifications where read_at is null) = 3, 'three unread notifications for Ana';
  assert (select array_agg(type::text order by type::text) from public.notifications) = array['comment', 'follow', 'like'], 'notification types';
end $$;

-- Mark all read only touches the recipient's rows.
update public.notifications set read_at = now() where read_at is null;
do $$ begin
  assert (select count(*) from public.notifications where read_at is null) = 0, 'mark all read';
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$ begin
  assert (select array_agg(type::text order by type::text) from public.notifications where read_at is null) = array['comment_like', 'reply'],
    'Ben is notified of the reply and the comment like, still unread';
end $$;
-- Deleting a comment removes its replies and fixes the count.
delete from public.comments where author_id = '00000000-0000-4000-a000-00000000000b';
do $$ begin
  assert (select comment_count from public.posts where author_id = '00000000-0000-4000-a000-00000000000a') = 0, 'delete cascades replies and counts';
end $$;

-- ── Search + discovery (as Ben) ──────────────────────────────────────────
do $$ begin
  assert exists (select 1 from public.search_profiles('test_a') where username = 'test_ana'), 'search users by handle';
  assert exists (select 1 from public.search_profiles('@Ana') where username = 'test_ana'), 'search users by name, @ stripped';
  assert exists (select 1 from public.search_posts('keep going') where author_id = '00000000-0000-4000-a000-00000000000a'), 'search quotes';
  assert exists (select 1 from public.search_hashtags('#gro') where tag = 'growth'), 'search hashtags by prefix';
  assert exists (select 1 from public.trending_hashtags() where tag = 'growth'), 'trending hashtags';
  assert not exists (select 1 from public.search_posts('%')), 'wildcards are escaped';
  assert not exists (select 1 from public.suggested_creators() where username = 'test_ana'), 'suggestions skip people you follow';
end $$;
delete from public.follows where follower_id = '00000000-0000-4000-a000-00000000000b';
do $$ begin
  assert exists (select 1 from public.suggested_creators() where username = 'test_ana'), 'suggestions include creators you don''t follow';
  assert not exists (select 1 from public.suggested_creators() where username = 'test_ben'), 'suggestions never include yourself';
end $$;

-- ── Blocking (Ana blocks Ben) ────────────────────────────────────────────
insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000a');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000b');
do $$ begin
  assert (select followers_count from public.profiles where username = 'test_ana') = 0, 'blocking removes the follow';
  assert (select count(*) from public.notifications) = 0, 'blocking clears notifications between them';
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.posts where author_id = '00000000-0000-4000-a000-00000000000a') = 0, 'blocked users cannot see posts';
  assert not exists (select 1 from public.search_profiles('test_ana')), 'blocked users are hidden from search';
  assert not exists (select 1 from public.suggested_creators() where username = 'test_ana'), 'blocked users are not suggested';
  begin
    insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000a');
    assert false, 'cannot follow someone who blocked you';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}';
delete from public.blocks where blocker_id = '00000000-0000-4000-a000-00000000000a';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.posts where author_id = '00000000-0000-4000-a000-00000000000a') = 1, 'unblocking restores visibility';
end $$;

-- ── Reports ──────────────────────────────────────────────────────────────
insert into public.reports (reporter_id, reported_user_id, reason, details)
values ('00000000-0000-4000-a000-00000000000b', '00000000-0000-4000-a000-00000000000a', 'spam', 'test');
do $$ begin
  begin
    insert into public.reports (reporter_id, reason) values ('00000000-0000-4000-a000-00000000000b', 'spam');
    assert false, 'a report needs a target';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'social backend tests passed' as result;
rollback;
