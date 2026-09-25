-- Discovery + search helpers and blocking hardening.
-- Every function is SECURITY INVOKER, so the existing RLS still decides what
-- a viewer can see (published posts, no blocked users either way).

-- LIKE-safe search term: trimmed, leading @/# removed, wildcards escaped.
create or replace function private.search_term(p_query text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(regexp_replace(btrim(coalesce(p_query, '')), '^[@#]+', ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

grant execute on function private.search_term(text) to anon, authenticated;

-- Hashtags used most in recent visible posts.
create or replace function public.trending_hashtags(p_days integer default 7, p_limit integer default 12)
returns table (tag text, post_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.tag, count(*) as post_count
  from public.post_hashtags h
  join public.posts p on p.id = h.post_id
  where p.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by h.tag
  order by post_count desc, h.tag
  limit least(greatest(p_limit, 1), 50);
$$;

-- Hashtags starting with the query, most used first.
create or replace function public.search_hashtags(p_query text, p_limit integer default 12)
returns table (tag text, post_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.tag, count(*) as post_count
  from public.post_hashtags h
  join public.posts p on p.id = h.post_id
  where length(private.search_term(p_query)) > 0
    and h.tag like lower(private.search_term(p_query)) || '%' escape '\'
  group by h.tag
  order by post_count desc, h.tag
  limit least(greatest(p_limit, 1), 50);
$$;

-- People by username or display name (trigram-indexed), exact handle first.
create or replace function public.search_profiles(p_query text, p_limit integer default 20)
returns setof public.profiles
language sql
stable
security invoker
set search_path = ''
as $$
  select pr.*
  from public.profiles pr
  where length(private.search_term(p_query)) > 0
    and (
      pr.username ilike '%' || private.search_term(p_query) || '%' escape '\'
      or pr.display_name ilike '%' || private.search_term(p_query) || '%' escape '\'
    )
    and not private.blocked_with(pr.id)
  order by
    (pr.username = lower(btrim(regexp_replace(p_query, '^@+', '')))) desc,
    (pr.username ilike private.search_term(p_query) || '%' escape '\') desc,
    pr.followers_count desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Quotes containing the query (trigram-indexed), most loved first.
create or replace function public.search_posts(p_query text, p_limit integer default 20, p_offset integer default 0)
returns setof public.posts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.posts p
  where length(private.search_term(p_query)) > 0
    and p.text ilike '%' || private.search_term(p_query) || '%' escape '\'
  order by p.like_count desc, p.created_at desc, p.id
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

-- Popular creators the viewer doesn't follow yet (never themselves or blocked users).
create or replace function public.suggested_creators(p_limit integer default 12)
returns setof public.profiles
language sql
stable
security invoker
set search_path = ''
as $$
  select pr.*
  from public.profiles pr
  where pr.id is distinct from (select auth.uid())
    and pr.posts_count > 0
    and not private.blocked_with(pr.id)
    and not exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.following_id = pr.id
    )
  order by pr.followers_count desc, pr.posts_count desc, pr.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.trending_hashtags(integer, integer) to anon, authenticated;
grant execute on function public.search_hashtags(text, integer) to anon, authenticated;
grant execute on function public.search_profiles(text, integer) to anon, authenticated;
grant execute on function public.search_posts(text, integer, integer) to anon, authenticated;
grant execute on function public.suggested_creators(integer) to anon, authenticated;

-- Blocking also clears notifications between the two people…
create or replace function public.on_block_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  delete from public.notifications
  where (recipient_id = new.blocker_id and actor_id = new.blocked_id)
     or (recipient_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end;
$$;

-- …and hides any that arrive later (e.g. a mention on a third person's post).
drop policy "Users see their notifications" on public.notifications;
create policy "Users see their notifications" on public.notifications
  for select to authenticated using (
    recipient_id = (select auth.uid()) and not private.blocked_with(actor_id)
  );
