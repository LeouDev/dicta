-- Notifications for private accounts: someone asks to follow you, and your
-- request was accepted. In a migration of their own because a new enum value
-- can only be used once the transaction that adds it has committed.
-- Older app versions skip notification types they don't know.
alter type public.notification_type add value if not exists 'follow_request';
alter type public.notification_type add value if not exists 'follow_accept';
