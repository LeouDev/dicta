-- Backend tests for stacked posts and stories. Cards: created with the post,
-- in order, replaced together, up to 10 in all, through the word filter, and
-- only for their author. Stories: seen by the same people as the author's
-- posts until they expire, ringed until viewed, and the author sees who
-- viewed them. ROLLED BACK: nothing persists.
--   npm run test:db
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana3@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben3@test.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-a000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cai3@test.invalid', '{}', '{}', now(), now());
insert into public.profiles (id, username, display_name)
values
  ('00000000-0000-4000-a000-0000000000a3', 'test_ana3', 'Ana Test'),
  ('00000000-0000-4000-a000-0000000000b3', 'test_ben3', 'Ben Test'),
  ('00000000-0000-4000-a000-0000000000c3', 'test_cai3', 'Cai Test');
create temp table w as select convert_from(decode('cG9ybg==', 'base64'), 'utf8') as word;
grant select on w to authenticated;

-- ── A stack of three cards ─────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a3","role":"authenticated"}';
select public.create_post('Card one', 'editorial', '{"template":"editorial"}'::jsonb, null, null,
  '[{"text": "  Card two  ", "template": "minimal", "design": {"template": "minimal"}},
    {"text": "Card three", "template": "midnight", "design": {"template": "midnight"}, "background_image_path": "00000000-0000-4000-a000-0000000000a3/x.jpg"}]'::jsonb);
-- Older app versions still post with five arguments.
select public.create_post('Single card', 'editorial', '{"template":"editorial"}'::jsonb, null, null);

do $$ declare word text := (select w.word from w); begin
  assert (select array_agg(c.text order by c.position) from public.post_cards c
          join public.posts p on p.id = c.post_id where p.text = 'Card one'
            and p.author_id = '00000000-0000-4000-a000-0000000000a3') = array['Card two', 'Card three'],
    'the extra cards, trimmed and in order';
  assert (select c.background_image_path from public.post_cards c join public.posts p on p.id = c.post_id
          where p.text = 'Card one' and c.position = 2) = '00000000-0000-4000-a000-0000000000a3/x.jpg', 'with their photo';
  begin
    perform public.create_post('Clean', 'editorial', '{"template":"editorial"}'::jsonb, null, null,
      jsonb_build_array(jsonb_build_object('text', 'a ' || word, 'template', 'editorial', 'design', '{"template":"editorial"}'::jsonb)));
    raise exception 'a blocked word in a card was posted';
  exception when check_violation then null;
  end;
  begin
    perform public.create_post('Too many', 'editorial', '{"template":"editorial"}'::jsonb, null, null,
      (select jsonb_agg(jsonb_build_object('text', 'x', 'template', 'editorial', 'design', '{"template":"editorial"}'::jsonb))
       from generate_series(1, 10)));
    raise exception 'an eleven-card post went through';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Editing replaces the stack.
select public.set_post_cards(id, '[{"text": "New two", "template": "editorial", "design": {"template": "editorial"}}]'::jsonb)
from public.posts where text = 'Card one' and author_id = '00000000-0000-4000-a000-0000000000a3';
do $$ begin
  assert (select array_agg(c.text) from public.post_cards c join public.posts p on p.id = c.post_id
          where p.text = 'Card one' and p.author_id = '00000000-0000-4000-a000-0000000000a3') = array['New two'],
    'the stack is replaced';
end $$;

-- An edit is saved whole (update_post): the words, the design and the other cards.
do $$ declare word text := (select w.word from w); begin
  begin
    perform public.update_post((select id from public.posts where text = 'Card one' and author_id = '00000000-0000-4000-a000-0000000000a3'),
      'Card one, edited', null, 'editorial', '{"template":"editorial"}'::jsonb, null,
      jsonb_build_array(jsonb_build_object('text', 'a ' || word, 'template', 'editorial', 'design', '{"template":"editorial"}'::jsonb)));
    raise exception 'a blocked word in an edited card was saved';
  exception when check_violation then null;
  end;
end $$;
select public.update_post(id, 'Card one', 'love', 'minimal', '{"template":"minimal"}'::jsonb, null,
  '[{"text": "New two", "template": "editorial", "design": {"template": "editorial"}}]'::jsonb)
from public.posts where text = 'Card one' and author_id = '00000000-0000-4000-a000-0000000000a3';
do $$ begin
  assert (select p.topic = 'love' and d.template = 'minimal' from public.posts p join public.post_designs d on d.post_id = p.id
          where p.text = 'Card one' and p.author_id = '00000000-0000-4000-a000-0000000000a3'), 'the words and design are saved';
  assert (select array_agg(c.text) from public.post_cards c join public.posts p on p.id = c.post_id
          where p.text = 'Card one' and p.author_id = '00000000-0000-4000-a000-0000000000a3') = array['New two'], 'with the cards';
end $$;

-- Ben sees the cards of a public post, and can't edit them.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b3","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.post_cards c join public.posts p on p.id = c.post_id
          where p.author_id = '00000000-0000-4000-a000-0000000000a3') = 1, 'others see the cards';
  begin
    perform public.set_post_cards((select id from public.posts where text = 'Card one' and author_id = '00000000-0000-4000-a000-0000000000a3'), '[]'::jsonb);
    raise exception 'Ben edited Ana''s stack';
  exception when no_data_found then null;
  end;
  delete from public.post_cards c using public.posts p
  where p.id = c.post_id and p.author_id = '00000000-0000-4000-a000-0000000000a3';
  assert (select count(*) from public.post_cards c join public.posts p on p.id = c.post_id
          where p.author_id = '00000000-0000-4000-a000-0000000000a3') = 1, 'nor delete them';
end $$;

-- ── Stories ────────────────────────────────────────────────────────────
-- Ben follows Ana; Cai doesn't. Ana posts two stories.
insert into public.follows (follower_id, following_id) values ('00000000-0000-4000-a000-0000000000b3', '00000000-0000-4000-a000-0000000000a3');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a3","role":"authenticated"}';
insert into public.stories (author_id, text, template, design)
values ('00000000-0000-4000-a000-0000000000a3', 'Morning thought', 'editorial', '{"template":"editorial"}'),
       ('00000000-0000-4000-a000-0000000000a3', 'Evening thought', 'editorial', '{"template":"editorial"}');
do $$ declare word text := (select w.word from w); begin
  begin
    insert into public.stories (author_id, text, template, design)
    values ('00000000-0000-4000-a000-0000000000a3', 'so ' || word, 'editorial', '{"template":"editorial"}');
    raise exception 'a blocked word in a story was posted';
  exception when check_violation then null;
  end;
  begin
    insert into public.stories (author_id, text, template, design)
    values ('00000000-0000-4000-a000-0000000000b3', 'Ben''s words', 'editorial', '{"template":"editorial"}');
    raise exception 'Ana posted a story as Ben';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b3","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3') = 2, 'a follower sees the stories';
  assert (select unseen from public.story_tray() where author_id = '00000000-0000-4000-a000-0000000000a3'), 'ringed as unseen';
end $$;
insert into public.story_views (story_id, viewer_id)
select id, '00000000-0000-4000-a000-0000000000b3' from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3';
do $$ begin
  assert not (select unseen from public.story_tray() where author_id = '00000000-0000-4000-a000-0000000000a3'), 'seen once viewed';
end $$;

-- Cai, not following, doesn't get Ana in the tray, but can open a public account's stories.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c3","role":"authenticated"}';
do $$ begin
  assert not exists (select 1 from public.story_tray() where author_id = '00000000-0000-4000-a000-0000000000a3'), 'only people you follow are ringed';
  assert (select count(*) from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3') = 2, 'a public account''s stories show';
  assert not exists (select 1 from public.story_views where viewer_id = '00000000-0000-4000-a000-0000000000b3'), 'Cai can''t see who viewed';
end $$;

-- Ana sees Ben's views; then goes private, and Cai loses the stories.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a3","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.story_views where viewer_id = '00000000-0000-4000-a000-0000000000b3') = 2, 'the author sees who viewed';
end $$;
update public.profiles set is_private = true where id = '00000000-0000-4000-a000-0000000000a3';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c3","role":"authenticated"}';
do $$ begin
  assert not exists (select 1 from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3'), 'a private account''s stories are for followers';
  begin
    insert into public.story_views (story_id, viewer_id)
    select id, '00000000-0000-4000-a000-0000000000c3' from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3';
    -- Nothing visible to insert: fine. A guessed id must fail:
    insert into public.story_views (story_id, viewer_id) values (gen_random_uuid(), '00000000-0000-4000-a000-0000000000c3');
    raise exception 'Cai recorded a view of a story he can''t see';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A day later the stories expire: gone for Ben, still Ana's own.
reset role;
update public.stories set expires_at = now() - interval '1 minute' where author_id = '00000000-0000-4000-a000-0000000000a3';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b3","role":"authenticated"}';
do $$ begin
  assert not exists (select 1 from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3'), 'expired stories disappear';
  assert not exists (select 1 from public.story_tray() where author_id = '00000000-0000-4000-a000-0000000000a3'), 'and leave the tray';
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a3","role":"authenticated"}';
delete from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3' and expires_at < now();
do $$ begin
  assert not exists (select 1 from public.stories where author_id = '00000000-0000-4000-a000-0000000000a3'), 'the author cleans up their expired stories';
end $$;

rollback;
