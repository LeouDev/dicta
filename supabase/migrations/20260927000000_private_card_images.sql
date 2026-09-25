-- Card images are now served only through the website (/card/<id>.jpg), which
-- checks the post is still visible and is purged from Vercel's cache when the
-- post or its author is deleted. A public bucket would keep serving them by
-- direct URL after that. This is a storage setting, not a table change: owners
-- still upload, list and delete in their own folder under the existing
-- policies, and the website reads with the server-only service role key.
update storage.buckets set public = false where id = 'generated-cards';
