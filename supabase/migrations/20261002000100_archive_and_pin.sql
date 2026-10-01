-- Archive and pin (1.0.3).
--
-- Archive: status 'archived'. The post keeps its likes, comments and saves but
-- only its author sees it, exactly like the moderation states: the posts
-- policy already shows non-published posts to their author alone, and the
-- website purge already fires when a post leaves 'published'. Unarchiving puts
-- it back where it was.
--
-- Pin: posts.pinned_at, when the author pinned it to the top of their profile
-- (up to 3). Stored on the post so everyone sees the same pins in the same order.
--
-- Clients can't write status or pins (column grants, see the initial schema):
-- both change through the functions below, which only touch the caller's posts.

alter table public.posts drop constraint posts_status_valid;
alter table public.posts add constraint posts_status_valid check (status in ('published', 'hidden', 'removed', 'archived'));

alter table public.posts add column pinned_at timestamptz;
create index posts_author_pinned_idx on public.posts (author_id, pinned_at desc) where pinned_at is not null;

-- posts_count counts what a profile shows: archiving takes a post out of it and
-- unarchiving puts it back, so deleting an archived post mustn't count it again.
create or replace function public.on_post_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.author_id;
  elsif tg_op = 'DELETE' then
    if old.status <> 'archived' then
      update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.author_id;
    end if;
    return old;
  end if;

  -- Re-index hashtags on insert and on text edits.
  if tg_op = 'INSERT' or new.text is distinct from old.text then
    delete from public.post_hashtags where post_id = new.id;
    insert into public.post_hashtags (post_id, tag)
    select distinct new.id, lower(m[1])
    from regexp_matches(new.text, '#([A-Za-z0-9_]{2,40})', 'g') as m
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Archives one of your posts, or brings it back. Archiving unpins it. Doing
-- what's already done is fine; moderated (hidden or removed) posts stay as they are.
create or replace function public.set_post_archived(p_post_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  select status into v_status from public.posts
  where id = p_post_id and author_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if v_status = (case when p_archived then 'archived' else 'published' end) then
    return;
  end if;
  if v_status not in ('published', 'archived') then
    raise exception 'This post can''t be changed' using errcode = '42501';
  end if;

  update public.posts
  set status = case when p_archived then 'archived' else 'published' end,
      pinned_at = case when p_archived then null else pinned_at end
  where id = p_post_id;
  update public.profiles
  set posts_count = greatest(posts_count + case when p_archived then -1 else 1 end, 0)
  where id = (select auth.uid());
end;
$$;

-- Pins one of your published posts to the top of your profile (up to 3), or unpins it.
create or replace function public.set_post_pinned(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  -- One pin change at a time per person, so two at once can't make a fourth.
  perform 1 from public.profiles where id = (select auth.uid()) for update;
  select status into v_status from public.posts
  where id = p_post_id and author_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;

  if not p_pinned then
    update public.posts set pinned_at = null where id = p_post_id;
    return;
  end if;
  if v_status <> 'published' then
    raise exception 'Only published posts can be pinned' using errcode = '22023';
  end if;
  if (select count(*) from public.posts
      where author_id = (select auth.uid()) and pinned_at is not null and id <> p_post_id) >= 3 then
    raise exception 'pin_limit' using errcode = 'check_violation';
  end if;
  update public.posts set pinned_at = coalesce(pinned_at, now()) where id = p_post_id;
end;
$$;

revoke execute on function public.set_post_archived(uuid, boolean) from public;
revoke execute on function public.set_post_pinned(uuid, boolean) from public;
grant execute on function public.set_post_archived(uuid, boolean) to authenticated;
grant execute on function public.set_post_pinned(uuid, boolean) to authenticated;

-- Feeds, trending and search list published posts only. RLS lets authors see
-- all their own posts, so without this your archived (or moderated) posts
-- would show up for you in them.
create or replace function public.home_feed(
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
)
returns setof public.posts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.posts p
  where (
      p.author_id = (select auth.uid())
      or p.author_id in (select following_id from public.follows where follower_id = (select auth.uid()))
    )
    and p.status = 'published'
    and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.created_at desc, p.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.trending_posts(
  p_days integer default 7,
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof public.posts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.posts p
  where p.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
    and p.status = 'published'
  order by
    (p.like_count + 2 * p.comment_count + 3 * p.share_count + 2 * p.save_count + 1)
      / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.3) desc,
    p.id desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

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
    and p.status = 'published'
    and p.text ilike '%' || private.search_term(p_query) || '%' escape '\'
  order by p.like_count desc, p.created_at desc, p.id
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

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
    and p.status = 'published'
  group by h.tag
  order by post_count desc, h.tag
  limit least(greatest(p_limit, 1), 50);
$$;

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
    and p.status = 'published'
    and h.tag like lower(private.search_term(p_query)) || '%' escape '\'
  group by h.tag
  order by post_count desc, h.tag
  limit least(greatest(p_limit, 1), 50);
$$;
