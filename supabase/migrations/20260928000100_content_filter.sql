-- Apple's guideline 1.2 asks apps with user content to filter objectionable
-- material before it's posted. The check lives in the database so it holds
-- for any client: quotes, card signatures, comments, display names and bios
-- are rejected when they contain a blocked word (whole words, so longer
-- words that merely contain one are fine). Add words from the dashboard:
-- insert into private.blocked_terms values ('word');
create table private.blocked_terms (
  term text primary key,
  constraint blocked_terms_plain check (term ~ '^[a-z0-9]+( [a-z0-9]+)*$')
);
alter table private.blocked_terms enable row level security;

-- Hate slurs and explicit sexual terms, base64-encoded so the repository
-- doesn't display them. Everyday swearing, which quotes often use, is allowed.
insert into private.blocked_terms (term)
select convert_from(decode(t, 'base64'), 'utf8')
from unnest(array[
  'bmlnZ2Vy',
  'bmlnZ2E=',
  'Y2hpbms=',
  'Z29vaw==',
  'c3BpYw==',
  'd2V0YmFjaw==',
  'a2lrZQ==',
  'cmFnaGVhZA==',
  'dG93ZWxoZWFk',
  'YmVhbmVy',
  'ZmFnZ290',
  'dHJhbm55',
  'cmV0YXJk',
  'cmV0YXJkZWQ=',
  'cG9ybg==',
  'cG9ybm8=',
  'cG9ybmh1Yg==',
  'eHZpZGVvcw==',
  'eGhhbXN0ZXI=',
  'b25seWZhbnM=',
  'Ymxvd2pvYg==',
  'aGFuZGpvYg==',
  'Y3Vtc2hvdA==',
  'Z2FuZ2Jhbmc=',
  'Y3JlYW1waWU=',
  'YnVra2FrZQ==',
  'cmltam9i',
  'aGVudGFp',
  'bG9saWNvbg==',
  'bWlsZg==',
  'ZGlsZG8=',
  'Y3VudA==',
  'c2x1dA==',
  'd2hvcmU='
]) as t
on conflict do nothing;

create or replace function private.is_objectionable(p_text text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_text is not null and exists (
    select 1 from private.blocked_terms b
    where p_text ~* ('\m' || b.term || 's?\M')
  );
$$;

revoke execute on function private.is_objectionable(text) from public;
grant execute on function private.is_objectionable(text) to authenticated, service_role;

-- Trigger arguments name the text fields to check, as dotted paths into the row.
create or replace function private.reject_objectionable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  field text;
begin
  foreach field in array tg_argv loop
    if private.is_objectionable(to_jsonb(new) #>> string_to_array(field, '.')) then
      raise exception 'objectionable_content' using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

create trigger posts_reject_objectionable
before insert or update of text on public.posts
for each row execute function private.reject_objectionable('text');

create trigger post_designs_reject_objectionable
before insert or update of design on public.post_designs
for each row execute function private.reject_objectionable('design.signature.text');

create trigger comments_reject_objectionable
before insert or update of body on public.comments
for each row execute function private.reject_objectionable('body');

create trigger profiles_reject_objectionable
before insert or update of display_name, bio on public.profiles
for each row execute function private.reject_objectionable('display_name', 'bio');
