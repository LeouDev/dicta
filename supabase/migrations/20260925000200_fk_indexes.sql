-- Cover foreign keys so cascades (deleting a post/comment/user) don't scan.
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id) where post_id is not null;
create index notifications_comment_idx on public.notifications (comment_id) where comment_id is not null;
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_post_idx on public.reports (post_id) where post_id is not null;
create index reports_reported_user_idx on public.reports (reported_user_id) where reported_user_id is not null;
create index reports_comment_idx on public.reports (comment_id) where comment_id is not null;
