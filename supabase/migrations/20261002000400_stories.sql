-- Stories (1.0.3): a card that disappears after 24 hours, shown as rings at the
-- top of Home. New tables, and why:
--   stories      the card (words and design, like a post's) and when it expires.
--   story_views  who saw which story, for the ring (seen or not) and so the
--                author can see who viewed it.
-- A story is visible to the same people as its author's posts (private.can_see)
-- until it expires. Expired stories stay hidden by the policy; the app deletes
-- its own expired stories and their photos when it next opens.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  template text not null,
  design jsonb not null,
  background_image_path text,
  -- Moderation hook, like posts: 'removed' stories are only visible to their author.
  status text not null default 'published',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint stories_text_length check (char_length(btrim(text)) between 1 and 500),
  constraint stories_design_object check (jsonb_typeof(design) = 'object'),
  constraint stories_status_valid check (status in ('published', 'removed'))
);
create index stories_author_created_idx on public.stories (author_id, created_at);
create index stories_expires_idx on public.stories (expires_at);
create index stories_background_idx on public.stories (background_image_path) where background_image_path is not null;

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index story_views_viewer_idx on public.story_views (viewer_id);

alter table public.stories enable row level security;
create policy "Live stories are visible" on public.stories
  for select to authenticated using (
    author_id = (select auth.uid())
    or (status = 'published' and expires_at > now() and private.can_see(author_id))
  );
create policy "Users post their own stories" on public.stories
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Users delete their own stories" on public.stories
  for delete to authenticated using (author_id = (select auth.uid()));
grant select, delete on public.stories to authenticated;
grant insert (author_id, text, template, design, background_image_path) on public.stories to authenticated;

create trigger stories_reject_objectionable
before insert on public.stories
for each row execute function private.reject_objectionable('text', 'design.signature.text');

alter table public.story_views enable row level security;
create policy "Viewers and authors see story views" on public.story_views
  for select to authenticated using (
    viewer_id = (select auth.uid())
    or exists (select 1 from public.stories s where s.id = story_id and s.author_id = (select auth.uid()))
  );
create policy "Users record the stories they saw" on public.story_views
  for insert to authenticated with check (
    viewer_id = (select auth.uid()) and exists (select 1 from public.stories s where s.id = story_id)
  );
grant select on public.story_views to authenticated;
grant insert (story_id, viewer_id) on public.story_views to authenticated;

-- The rings at the top of Home: you first, then people you follow with a live
-- story, unseen ones first, newest first. RLS decides which stories count.
create or replace function public.story_tray()
returns table (
  author_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_verified boolean,
  latest_at timestamptz,
  unseen boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.author_id, p.username, p.display_name, p.avatar_url, p.is_verified,
         max(s.created_at) as latest_at,
         bool_or(not exists (
           select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = (select auth.uid())
         )) as unseen
  from public.stories s
  join public.profiles p on p.id = s.author_id
  where s.status = 'published'
    and s.expires_at > now()
    and (
      s.author_id = (select auth.uid())
      or s.author_id in (select following_id from public.follows where follower_id = (select auth.uid()))
    )
  group by s.author_id, p.username, p.display_name, p.avatar_url, p.is_verified
  order by (s.author_id = (select auth.uid())) desc, unseen desc, latest_at desc
  limit 100;
$$;
revoke execute on function public.story_tray() from public;
grant execute on function public.story_tray() to authenticated;
