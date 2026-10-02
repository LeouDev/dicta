-- Backend tests for archiving and pinning posts: only the author sees an
-- archived post, it leaves feeds and the post count and comes back intact;
-- up to 3 pins, only on your own published posts. ROLLED BACK: nothing persists.
--   npm run test:db
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana1@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben1@test.invalid', '{}', '{}', now(), now());
insert into public.profiles (id, username, display_name)
values
  ('00000000-0000-4000-a000-0000000000a1', 'test_ana1', 'Ana Test'),
  ('00000000-0000-4000-a000-0000000000b1', 'test_ben1', 'Ben Test');

-- ── Ana posts five quotes; Ben likes the first and follows her ──────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
select public.create_post('One', 'editorial', '{"template":"editorial"}'::jsonb);
select public.create_post('Two', 'editorial', '{"template":"editorial"}'::jsonb);
select public.create_post('Three', 'editorial', '{"template":"editorial"}'::jsonb);
select public.create_post('Four', 'editorial', '{"template":"editorial"}'::jsonb);
select public.create_post('Five', 'editorial', '{"template":"editorial"}'::jsonb);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-0000000000b1', '00000000-0000-4000-a000-0000000000a1');
insert into public.likes (user_id, post_id)
select '00000000-0000-4000-a000-0000000000b1', id from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One';

-- Ben can't archive or pin Ana's posts.
do $$ begin
  begin
    perform public.set_post_archived((select id from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Two'), true);
    raise exception 'someone else archived Ana''s post';
  exception when no_data_found then null;
  end;
  begin
    perform public.set_post_pinned((select id from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Two'), true);
    raise exception 'someone else pinned Ana''s post';
  exception when no_data_found then null;
  end;
end $$;

-- ── Ana pins two posts, then archives one of them ──────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
select public.set_post_pinned(id, true) from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text in ('One', 'Two');
select public.set_post_archived(id, true) from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One';
select public.set_post_archived(id, true) from public.posts -- archiving twice is fine
where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One';

do $$ begin
  assert (select status from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One') = 'archived',
    'Ana still sees her archived post';
  assert (select pinned_at from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One') is null,
    'archiving unpins';
  assert (select posts_count from public.profiles where id = '00000000-0000-4000-a000-0000000000a1') = 4,
    'an archived post leaves the post count';
  assert (select count(*) from public.home_feed(null, null, 50) where author_id = '00000000-0000-4000-a000-0000000000a1') = 4,
    'and Ana''s own feed';
  assert (select like_count from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One') = 1,
    'it keeps its likes';
end $$;

-- Ben no longer sees it anywhere.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
do $$ begin
  assert not exists (select 1 from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One'),
    'others can''t see an archived post';
  assert (select count(*) from public.home_feed(null, null, 50) where author_id = '00000000-0000-4000-a000-0000000000a1') = 4,
    'nor in their feed';
  assert not exists (select 1 from public.search_posts('One') where author_id = '00000000-0000-4000-a000-0000000000a1'), 'nor in search';
end $$;

-- ── Pins: up to three, published only ──────────────────────────────────
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
select public.set_post_pinned(id, true) from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text in ('Three', 'Four');
do $$ begin
  begin
    perform public.set_post_pinned((select id from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Five'), true);
    raise exception 'a fourth pin went through';
  exception when check_violation then
    assert sqlerrm = 'pin_limit', 'the app can tell it''s the pin limit';
  end;
  begin
    perform public.set_post_pinned((select id from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One'), true);
    raise exception 'an archived post was pinned';
  exception when invalid_parameter_value then null;
  end;
  assert (select count(*) from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and pinned_at is not null) = 3,
    'three pins';
end $$;
select public.set_post_pinned(id, true) from public.posts -- re-pinning keeps its place
where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Two';
select public.set_post_pinned(id, false) from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Three';
do $$ begin
  assert (select count(*) from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and pinned_at is not null) = 2,
    'unpinning frees a place';
end $$;

-- A pinned post that moderation removes stops holding one of the three.
reset role;
update public.posts set status = 'removed' where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Four';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
select public.set_post_pinned(id, true) from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text in ('Three', 'Five');
do $$ begin
  assert (select count(*) from public.posts
          where author_id = '00000000-0000-4000-a000-0000000000a1' and pinned_at is not null and status = 'published') = 3,
    'a removed post doesn''t hold a pin';
end $$;
reset role;
update public.posts set status = 'published' where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Four';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';

-- ── Unarchive, then delete an archived post ────────────────────────────
select public.set_post_archived(id, false) from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One';
select public.set_post_archived(id, true) from public.posts
where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Five';
delete from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'Five';

reset role;
do $$ begin
  assert (select status from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One') = 'published',
    'unarchiving brings it back';
  assert (select posts_count from public.profiles where id = '00000000-0000-4000-a000-0000000000a1') = 4,
    'counted again, and a deleted archived post isn''t subtracted twice';
  assert exists (select 1 from net.http_request_queue q
                 where q.url = 'https://dicta-orcin.vercel.app/api/purge?post=' ||
                   (select id::text from public.posts where author_id = '00000000-0000-4000-a000-0000000000a1' and text = 'One')),
    'archiving drops the post from the website''s cache';
end $$;

rollback;
