-- Backend tests for the content filter: a blocked word can't be posted in a
-- quote, a card signature, a comment, a display name or a bio, whatever the
-- case or with a plural "s"; ordinary text and longer words that merely
-- contain one can. ROLLED BACK: nothing persists.
--   npm run test:db
begin;

-- The blocked word under test, encoded like the list itself.
create temp table w as select convert_from(decode('cG9ybg==', 'base64'), 'utf8') as word;
grant select on w to authenticated;

do $$ declare word text := (select w.word from w); begin
  assert private.is_objectionable('no ' || word || ' here'), 'a blocked word is caught';
  assert private.is_objectionable(upper(word) || 's!'), 'in any case, with a plural s';
  assert not private.is_objectionable(word || 'ography and more'), 'a longer word that contains one is fine';
  assert not private.is_objectionable('Stay soft. It''s a strength.'), 'ordinary text is fine';
  assert not private.is_objectionable(null), 'nothing is fine';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-a000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dan@test.invalid', '{}', '{}', now(), now());

-- Dan posts, as the app does.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000d","role":"authenticated"}';
insert into public.profiles (id, username, display_name) values ('00000000-0000-4000-a000-00000000000d', 'test_dan', 'Dan Test');

do $$
declare
  word text := (select w.word from w);
  me uuid := '00000000-0000-4000-a000-00000000000d';
  post uuid;
  blocked integer := 0;
begin
  insert into public.posts (author_id, text) values (me, 'A clean quote') returning id into post;
  insert into public.post_designs (post_id, template, design) values (post, 'editorial', '{"signature": {"text": "— Dan"}}');
  insert into public.comments (post_id, author_id, body) values (post, me, 'Lovely.');

  begin insert into public.posts (author_id, text) values (me, 'A ' || word || ' quote');
  exception when check_violation then blocked := blocked + 1; end;
  begin update public.post_designs set design = jsonb_build_object('signature', jsonb_build_object('text', word)) where post_id = post;
  exception when check_violation then blocked := blocked + 1; end;
  begin insert into public.comments (post_id, author_id, body) values (post, me, word);
  exception when check_violation then blocked := blocked + 1; end;
  begin update public.profiles set bio = 'I like ' || word where id = me;
  exception when check_violation then blocked := blocked + 1; end;
  begin update public.profiles set display_name = word where id = me;
  exception when check_violation then blocked := blocked + 1; end;
  assert blocked = 5, format('quotes, signatures, comments, bios and names are filtered (%s of 5)', blocked);

  -- Counters and other columns still update on existing rows.
  update public.profiles set avatar_url = null where id = me;
end $$;

reset role;
do $$ begin
  assert not has_table_privilege('authenticated', 'private.blocked_terms', 'select'), 'the list is not readable by the app';
  assert not has_function_privilege('anon', 'private.is_objectionable(text)', 'execute'), 'visitors cannot probe the list';
end $$;

rollback;
