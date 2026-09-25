-- Welcome email, sent once when someone finishes creating their profile (after
-- confirming their email, or right after Sign in with Apple). Supabase Auth has
-- no welcome template, so the website's server sends it through Resend
-- (web/api/welcome.js), called by pg_net once the profile commits.
--
-- welcome_emails is the one new table: it remembers who was welcomed, so the
-- endpoint (public, like /api/push) sends at most once per person however
-- often it's called. Server only: RLS on, no policies, no grants.

create table public.welcome_emails (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.welcome_emails enable row level security;

-- The address to welcome, claimed so it's sent once; null if it was claimed
-- before, or the person has no profile or no email.
create or replace function public.claim_welcome(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    return null;
  end if;
  insert into public.welcome_emails (user_id) values (p_user) on conflict do nothing;
  if not found then
    return null;
  end if;
  select u.email into v_email from auth.users u where u.id = p_user;
  if coalesce(v_email, '') = '' then
    return null;
  end if;
  return jsonb_build_object('email', v_email);
end;
$$;
revoke execute on function public.claim_welcome(uuid) from public, anon, authenticated;
grant execute on function public.claim_welcome(uuid) to service_role;

create or replace function private.queue_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://dicta-orcin.vercel.app/api/welcome',
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;
revoke execute on function private.queue_welcome() from public;

create trigger profiles_after_insert_welcome
after insert on public.profiles
for each row execute function private.queue_welcome();
