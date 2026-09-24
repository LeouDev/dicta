-- Dicta initial schema
-- Conventions:
--   * Entity tables use UUID primary keys; join tables use composite keys
--     (a like/follow/save can only exist once).
--   * Denormalized counters are maintained by SECURITY DEFINER triggers.
--     Clients get column-level grants only, so counters, verification and
--     moderation state can never be written from the app.
--   * RLS policies wrap auth.uid() in a sub-select so Postgres evaluates it
--     once per statement instead of once per row.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  is_verified boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  posts_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,30}$'),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 50),
  constraint profiles_bio_length check (char_length(bio) <= 160)
);

create unique index profiles_username_key on public.profiles (username);
create index profiles_followers_idx on public.profiles (followers_count desc);
create index profiles_username_trgm_idx on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_name_trgm_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Blocks (declared early: visibility policies depend on it)
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- True when either user has blocked the other. SECURITY DEFINER because a
-- viewer can't read someone else's block list through RLS.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Topics (Discover categories)
-- ---------------------------------------------------------------------------

create table public.topics (
  slug text primary key,
  label text not null,
  sort_order smallint not null default 0
);

insert into public.topics (slug, label, sort_order) values
  ('motivation', 'Motivation', 1),
  ('love', 'Love', 2),
  ('life', 'Life', 3),
  ('growth', 'Growth', 4),
  ('healing', 'Healing', 5),
  ('career', 'Career', 6),
  ('friendship', 'Friendship', 7),
  ('self-worth', 'Self-worth', 8),
  ('mindset', 'Mindset', 9),
  ('relationships', 'Relationships', 10);

-- ---------------------------------------------------------------------------
-- Posts + designs
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  topic text references public.topics (slug) on delete set null,
  -- Moderation hook: 'hidden' / 'removed' posts are only visible to their author.
  status text not null default 'published',
  -- Cached render in the generated-cards bucket (optional, for sharing/feeds).
  card_image_path text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  save_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_text_length check (char_length(btrim(text)) between 1 and 500),
  constraint posts_status_valid check (status in ('published', 'hidden', 'removed'))
);

create index posts_created_idx on public.posts (created_at desc, id desc);
create index posts_author_created_idx on public.posts (author_id, created_at desc, id desc);
create index posts_topic_created_idx on public.posts (topic, created_at desc) where topic is not null;
create index posts_text_trgm_idx on public.posts using gin (text extensions.gin_trgm_ops);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- The visual design is structured data, so a card can be re-rendered at any
-- resolution or export format. `version` lets the renderer migrate old shapes.
create table public.post_designs (
  post_id uuid primary key references public.posts (id) on delete cascade,
  template text not null,
  design jsonb not null,
  version smallint not null default 1,
  background_image_path text,
  created_at timestamptz not null default now(),
  constraint post_designs_design_object check (jsonb_typeof(design) = 'object')
);

create table public.post_hashtags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag text not null,
  primary key (post_id, tag)
);

create index post_hashtags_tag_idx on public.post_hashtags (tag text_pattern_ops);

-- ---------------------------------------------------------------------------
-- Social graph + interactions
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id, created_at desc);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index likes_post_idx on public.likes (post_id, created_at desc);

create table public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index saves_user_created_idx on public.saves (user_id, created_at desc);
create index saves_post_idx on public.saves (post_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  like_count integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint comments_body_length check (char_length(btrim(body)) between 1 and 1000)
);

create index comments_post_created_idx on public.comments (post_id, created_at);
create index comments_parent_created_idx on public.comments (parent_id, created_at) where parent_id is not null;
create index comments_author_idx on public.comments (author_id);

create table public.comment_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create type public.notification_type as enum ('follow', 'like', 'comment', 'reply', 'mention', 'comment_like');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_reason_valid check (reason in ('spam', 'harassment', 'hate', 'self_harm', 'nudity', 'violence', 'misinformation', 'other')),
  constraint reports_status_valid check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  constraint reports_details_length check (details is null or char_length(details) <= 1000)
);

create index reports_status_created_idx on public.reports (status, created_at);

-- ---------------------------------------------------------------------------
-- Counter + notification triggers
-- ---------------------------------------------------------------------------

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
    update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.author_id;
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

create trigger posts_after_change
after insert or update of text or delete on public.posts
for each row execute function public.on_post_change();

create or replace function public.on_like_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id returning author_id into v_author;
    if v_author is not null and v_author <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (v_author, new.user_id, 'like', new.post_id);
    end if;
    return new;
  end if;

  update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  delete from public.notifications
  where type = 'like' and actor_id = old.user_id and post_id = old.post_id and comment_id is null;
  return old;
end;
$$;

create trigger likes_after_change
after insert or delete on public.likes
for each row execute function public.on_like_change();

create or replace function public.on_save_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set save_count = save_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.posts set save_count = greatest(save_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

create trigger saves_after_change
after insert or delete on public.saves
for each row execute function public.on_save_change();

create or replace function public.on_follow_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.following_id, new.follower_id, 'follow');
    return new;
  end if;

  update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
  delete from public.notifications
  where type = 'follow' and actor_id = old.follower_id and recipient_id = old.following_id;
  return old;
end;
$$;

create trigger follows_after_change
after insert or delete on public.follows
for each row execute function public.on_follow_change();

-- Replies are one level deep and must belong to the same post.
create or replace function public.validate_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.comments%rowtype;
begin
  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.post_id <> new.post_id then
      raise exception 'Reply must belong to the same post' using errcode = '23514';
    end if;
    if v_parent.parent_id is not null then
      new.parent_id := v_parent.parent_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_before_insert
before insert on public.comments
for each row execute function public.validate_comment();

create or replace function public.on_comment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  if tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    if old.parent_id is not null then
      update public.comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
    end if;
    return old;
  end if;

  update public.posts set comment_count = comment_count + 1 where id = new.post_id returning author_id into v_post_author;

  if new.parent_id is not null then
    update public.comments set reply_count = reply_count + 1 where id = new.parent_id returning author_id into v_parent_author;
    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (v_parent_author, new.author_id, 'reply', new.post_id, new.id);
    end if;
  end if;

  if v_post_author is not null and v_post_author <> new.author_id
     and v_post_author is distinct from v_parent_author then
    insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
    values (v_post_author, new.author_id, 'comment', new.post_id, new.id);
  end if;

  -- @mentions (skip people already notified above).
  insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
  select distinct p.id, new.author_id, 'mention'::public.notification_type, new.post_id, new.id
  from regexp_matches(new.body, '@([A-Za-z0-9_.]{3,30})', 'g') as m
  join public.profiles p on p.username = rtrim(lower(m[1]), '.')
  where p.id <> new.author_id
    and p.id is distinct from v_post_author
    and p.id is distinct from v_parent_author;

  return new;
end;
$$;

create trigger comments_after_change
after insert or delete on public.comments
for each row execute function public.on_comment_change();

create or replace function public.on_comment_like_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.comments%rowtype;
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id returning * into v_comment;
    if v_comment.author_id is not null and v_comment.author_id <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (v_comment.author_id, new.user_id, 'comment_like', v_comment.post_id, new.comment_id);
    end if;
    return new;
  end if;

  update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  delete from public.notifications
  where type = 'comment_like' and actor_id = old.user_id and comment_id = old.comment_id;
  return old;
end;
$$;

create trigger comment_likes_after_change
after insert or delete on public.comment_likes
for each row execute function public.on_comment_like_change();

-- Blocking someone also removes follows in both directions.
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
  return new;
end;
$$;

create trigger blocks_after_insert
after insert on public.blocks
for each row execute function public.on_block_insert();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates a post and its design atomically. SECURITY INVOKER: RLS still applies.
create or replace function public.create_post(
  p_text text,
  p_template text,
  p_design jsonb,
  p_topic text default null,
  p_background_image_path text default null
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

  return v_post_id;
end;
$$;

-- Share counts can't be written by clients directly.
create or replace function public.record_share(p_post_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.posts set share_count = share_count + 1
  where id = p_post_id and status = 'published' and (select auth.uid()) is not null;
$$;

-- Deletes the caller's auth user; everything they own cascades from there.
-- The app removes the user's storage files first (Storage API, own folder).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

-- Computed fields: select('*, liked_by_me, saved_by_me') via PostgREST.
create or replace function public.liked_by_me(post public.posts)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.likes where post_id = post.id and user_id = (select auth.uid()));
$$;

create or replace function public.saved_by_me(post public.posts)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.saves where post_id = post.id and user_id = (select auth.uid()));
$$;

create or replace function public.followed_by_me(profile public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.follows where following_id = profile.id and follower_id = (select auth.uid()));
$$;

create or replace function public.liked_by_me(comment public.comments)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.comment_likes where comment_id = comment.id and user_id = (select auth.uid()));
$$;

-- Home feed: people you follow + yourself, keyset-paginated.
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
    and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.created_at desc, p.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Trending: engagement weighted by recency over the last `p_days` days.
-- ponytail: scores every post in the window per request; move to a
-- cron-refreshed materialized view once weekly volume gets large.
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
  order by
    (p.like_count + 2 * p.comment_count + 3 * p.share_count + 2 * p.save_count + 1)
      / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.3) desc,
    p.id desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.topics enable row level security;
alter table public.posts enable row level security;
alter table public.post_designs enable row level security;
alter table public.post_hashtags enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- Profiles: public read, owner writes.
create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "Users create their own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Topics: read-only reference data.
create policy "Topics are public" on public.topics
  for select to anon, authenticated using (true);

-- Posts: published posts are public unless a block exists; authors always see their own.
create policy "Published posts are visible" on public.posts
  for select to anon, authenticated using (
    author_id = (select auth.uid())
    or (status = 'published' and not public.is_blocked_between((select auth.uid()), author_id))
  );
create policy "Users create their own posts" on public.posts
  for insert to authenticated with check (author_id = (select auth.uid()) and status = 'published');
create policy "Users update their own posts" on public.posts
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Users delete their own posts" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

-- Designs follow their post's visibility (the sub-select is itself subject to posts RLS).
create policy "Designs of visible posts are visible" on public.post_designs
  for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id));
create policy "Authors add designs to their posts" on public.post_designs
  for insert to authenticated with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );
create policy "Authors update designs of their posts" on public.post_designs
  for update to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

create policy "Hashtags of visible posts are visible" on public.post_hashtags
  for select to anon, authenticated using (exists (select 1 from public.posts p where p.id = post_id));

-- Follows: public graph, you manage your own edges.
create policy "Follows are public" on public.follows
  for select to anon, authenticated using (true);
create policy "Users follow as themselves" on public.follows
  for insert to authenticated with check (
    follower_id = (select auth.uid()) and not public.is_blocked_between(follower_id, following_id)
  );
create policy "Users unfollow as themselves" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

-- Likes: public, own writes, only on posts you can see.
create policy "Likes are public" on public.likes
  for select to anon, authenticated using (true);
create policy "Users like visible posts" on public.likes
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "Users remove their likes" on public.likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Saves are private.
create policy "Users see their saves" on public.saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users save visible posts" on public.saves
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "Users remove their saves" on public.saves
  for delete to authenticated using (user_id = (select auth.uid()));

-- Comments: visible on visible posts unless blocked; authors or the post owner can delete.
create policy "Comments on visible posts are visible" on public.comments
  for select to anon, authenticated using (
    exists (select 1 from public.posts p where p.id = post_id)
    and not public.is_blocked_between((select auth.uid()), author_id)
  );
create policy "Users comment on visible posts" on public.comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and not public.is_blocked_between((select auth.uid()), p.author_id)
    )
  );
create policy "Authors and post owners delete comments" on public.comments
  for delete to authenticated using (
    author_id = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );

create policy "Comment likes are public" on public.comment_likes
  for select to anon, authenticated using (true);
create policy "Users like visible comments" on public.comment_likes
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (select 1 from public.comments c where c.id = comment_id)
  );
create policy "Users remove their comment likes" on public.comment_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Notifications: private to the recipient; created only by triggers.
create policy "Users see their notifications" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Users mark their notifications read" on public.notifications
  for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "Users delete their notifications" on public.notifications
  for delete to authenticated using (recipient_id = (select auth.uid()));

-- Blocks: private to the blocker.
create policy "Users see who they blocked" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Users block as themselves" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "Users unblock as themselves" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- Reports: write-only for users (they can see what they filed).
-- The "has a target" rule lives here, not in a CHECK, so deleting reported
-- content (which nulls the reference) keeps the report for the audit trail.
create policy "Users file reports as themselves" on public.reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and num_nonnulls(post_id, reported_user_id, comment_id) >= 1
  );
create policy "Users see their own reports" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants: RLS decides rows, grants decide columns.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.profiles, public.topics, public.posts, public.post_designs, public.post_hashtags,
  public.follows, public.likes, public.comments, public.comment_likes to anon, authenticated;
grant select on public.saves, public.notifications, public.blocks, public.reports to authenticated;

grant insert (id, username, display_name, bio, avatar_url) on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url) on public.profiles to authenticated;

grant insert (author_id, text, topic) on public.posts to authenticated;
grant update (text, topic, card_image_path) on public.posts to authenticated;
grant delete on public.posts to authenticated;

grant insert (post_id, template, design, version, background_image_path) on public.post_designs to authenticated;
grant update (template, design, version, background_image_path) on public.post_designs to authenticated;

grant insert, delete on public.follows, public.likes, public.saves, public.comment_likes, public.blocks to authenticated;
grant insert (post_id, author_id, parent_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
grant insert (reporter_id, post_id, reported_user_id, comment_id, reason, details) on public.reports to authenticated;

grant execute on function public.is_blocked_between(uuid, uuid) to anon, authenticated;
grant execute on function public.create_post(text, text, jsonb, text, text) to authenticated;
grant execute on function public.record_share(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.liked_by_me(public.posts) to anon, authenticated;
grant execute on function public.saved_by_me(public.posts) to anon, authenticated;
grant execute on function public.followed_by_me(public.profiles) to anon, authenticated;
grant execute on function public.liked_by_me(public.comments) to anon, authenticated;
grant execute on function public.home_feed(timestamptz, uuid, integer) to authenticated;
grant execute on function public.trending_posts(integer, integer, integer) to anon, authenticated;

-- Future tables/functions stay locked down until explicitly granted.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: live activity badge.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Every object lives under "<user id>/..." so ownership is the first folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-images', 'post-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('generated-cards', 'generated-cards', true, 10485760, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Users upload to their own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('avatars', 'post-images', 'generated-cards')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users update their own files" on storage.objects
  for update to authenticated using (
    bucket_id in ('avatars', 'post-images', 'generated-cards')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users delete their own files" on storage.objects
  for delete to authenticated using (
    bucket_id in ('avatars', 'post-images', 'generated-cards')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- Needed for upsert/list of own files; public buckets serve reads by URL.
create policy "Users list their own files" on storage.objects
  for select to authenticated using (
    bucket_id in ('avatars', 'post-images', 'generated-cards')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
