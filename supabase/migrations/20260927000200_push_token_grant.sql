-- register_push_token is for signed-in people only (for anyone else it fails
-- anyway: a device needs an owner). New functions get EXECUTE for PUBLIC from
-- Postgres itself, which the per-schema default privileges in the initial
-- schema can't take away, so each function revokes it explicitly.
revoke execute on function public.register_push_token(text) from public;
