-- Stacked posts (1.0.3): a post can hold up to 10 cards that people swipe
-- through. The first card stays where it always was (posts.text and
-- post_designs), so older app versions and the website keep showing it; the
-- others live in post_cards, in order. A card is its own words and design, so
-- the table mirrors those two, and it's needed because a post had room for
-- exactly one design.

create table public.post_cards (
  post_id uuid not null references public.posts (id) on delete cascade,
  position smallint not null,
  text text not null,
  template text not null,
  design jsonb not null,
  background_image_path text,
  primary key (post_id, position),
  constraint post_cards_position check (position between 1 and 9),
  constraint post_cards_text_length check (char_length(btrim(text)) between 1 and 500),
  constraint post_cards_design_object check (jsonb_typeof(design) = 'object')
);
create index post_cards_background_idx on public.post_cards (background_image_path) where background_image_path is not null;

alter table public.post_cards enable row level security;
-- Cards follow their post's visibility (the sub-select is itself subject to posts RLS).
create policy "Cards of visible posts are visible" on public.post_cards
  for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id));
create policy "Authors add cards to their posts" on public.post_cards
  for insert to authenticated with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );
create policy "Authors remove cards from their posts" on public.post_cards
  for delete to authenticated using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );
grant select on public.post_cards to anon, authenticated;
grant insert (post_id, position, text, template, design, background_image_path), delete on public.post_cards to authenticated;

create trigger post_cards_reject_objectionable
before insert on public.post_cards
for each row execute function private.reject_objectionable('text', 'design.signature.text');

-- Cards from a JSON array of {text, template, design, background_image_path}, numbered from 1.
create or replace function private.insert_post_cards(p_post_id uuid, p_cards jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_cards is null then
    return;
  end if;
  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) > 9 then
    raise exception 'A post holds up to 10 cards' using errcode = '22023';
  end if;
  insert into public.post_cards (post_id, position, text, template, design, background_image_path)
  select p_post_id, c.ordinality, btrim(c.value ->> 'text'), c.value ->> 'template', c.value -> 'design',
         nullif(c.value ->> 'background_image_path', '')
  from jsonb_array_elements(p_cards) with ordinality as c(value, ordinality);
end;
$$;
revoke execute on function private.insert_post_cards(uuid, jsonb) from public;
grant execute on function private.insert_post_cards(uuid, jsonb) to authenticated;

-- create_post gains the extra cards. Replaced rather than overloaded, so older
-- app versions, which call it without p_cards, still find exactly one function.
drop function public.create_post(text, text, jsonb, text, text);
create function public.create_post(
  p_text text,
  p_template text,
  p_design jsonb,
  p_topic text default null,
  p_background_image_path text default null,
  p_cards jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.posts (author_id, text, topic)
  values ((select auth.uid()), btrim(p_text), p_topic)
  returning id into v_post_id;

  insert into public.post_designs (post_id, template, design, background_image_path)
  values (v_post_id, p_template, p_design, p_background_image_path);

  perform private.insert_post_cards(v_post_id, p_cards);
  return v_post_id;
end;
$$;
revoke execute on function public.create_post(text, text, jsonb, text, text, jsonb) from public;
grant execute on function public.create_post(text, text, jsonb, text, text, jsonb) to authenticated;

-- Replaces a post's extra cards (editing a stack). SECURITY INVOKER: RLS still applies.
create or replace function public.set_post_cards(p_post_id uuid, p_cards jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts where id = p_post_id and author_id = (select auth.uid())) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  delete from public.post_cards where post_id = p_post_id;
  perform private.insert_post_cards(p_post_id, coalesce(p_cards, '[]'::jsonb));
end;
$$;
revoke execute on function public.set_post_cards(uuid, jsonb) from public;
grant execute on function public.set_post_cards(uuid, jsonb) to authenticated;
