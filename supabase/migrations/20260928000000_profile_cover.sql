-- Profile cover photos: the background photo at the top of a profile, set in
-- Edit profile. The file lives in avatars/<uid>/ like the profile photo, so
-- the existing storage policies and account deletion already cover it.
alter table public.profiles add column cover_url text;

-- Profiles are updated column by column (see the initial schema).
grant update (cover_url) on public.profiles to authenticated;
