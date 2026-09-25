-- Backend tests for the welcome email: a new profile asks the website to send
-- it, it's claimed once, and only the server can claim. ROLLED BACK: nothing
-- persists, and pg_net sends nothing (it only sends after a commit).
--   npm run test:db
begin;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-a000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cleo@test.invalid', '{}', '{}', now(), now());

-- Cleo finishes her profile, as the app does.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}';
insert into public.profiles (id, username, display_name) values ('00000000-0000-4000-a000-00000000000c', 'test_cleo', 'Cleo Test');
do $$ begin
  begin
    perform public.claim_welcome('00000000-0000-4000-a000-00000000000c');
    raise exception 'the app must not claim welcome emails';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert (select convert_from(body, 'utf8')::jsonb ->> 'id' from net.http_request_queue where url = 'https://dicta-orcin.vercel.app/api/welcome')
       = '00000000-0000-4000-a000-00000000000c', 'a new profile asks the website to send the welcome email';
  assert public.claim_welcome('00000000-0000-4000-a000-00000000000c') = '{"email": "cleo@test.invalid"}'::jsonb, 'the first claim gets the address';
  assert public.claim_welcome('00000000-0000-4000-a000-00000000000c') is null, 'it is sent once';
  assert public.claim_welcome(gen_random_uuid()) is null, 'unknown people get nothing';
  assert not has_function_privilege('anon', 'public.claim_welcome(uuid)', 'execute'), 'visitors cannot claim';
end $$;

rollback;
