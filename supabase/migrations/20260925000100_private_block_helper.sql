-- Move the block check out of the exposed `public` schema so it can't be
-- called via /rest/v1/rpc to probe whether two arbitrary users blocked each
-- other. The replacement only answers for the signed-in user.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and other is not null and exists (
    select 1 from public.blocks
    where (blocker_id = (select auth.uid()) and blocked_id = other)
       or (blocker_id = other and blocked_id = (select auth.uid()))
  );
$$;

revoke execute on function private.blocked_with(uuid) from public;
grant execute on function private.blocked_with(uuid) to anon, authenticated;

drop policy "Published posts are visible" on public.posts;
create policy "Published posts are visible" on public.posts
  for select to anon, authenticated using (
    author_id = (select auth.uid())
    or (status = 'published' and not private.blocked_with(author_id))
  );

drop policy "Users follow as themselves" on public.follows;
create policy "Users follow as themselves" on public.follows
  for insert to authenticated with check (
    follower_id = (select auth.uid()) and not private.blocked_with(following_id)
  );

drop policy "Comments on visible posts are visible" on public.comments;
create policy "Comments on visible posts are visible" on public.comments
  for select to anon, authenticated using (
    exists (select 1 from public.posts p where p.id = post_id)
    and not private.blocked_with(author_id)
  );

drop policy "Users comment on visible posts" on public.comments;
create policy "Users comment on visible posts" on public.comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and not private.blocked_with(p.author_id)
    )
  );

drop function public.is_blocked_between(uuid, uuid);
