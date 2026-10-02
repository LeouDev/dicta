-- Fixes from the review of build 10 (1.0.3), before it ships.
--
--   set_post_pinned   counts only published posts toward the three pins. A
--                     pinned post that moderation removes leaves the profile,
--                     and its author couldn't unpin it to free the slot.
--   conversation_members read and clear times come from the server's clock.
--                     The app sends the phone's time; a phone running ahead
--                     would hide new messages after clearing a chat (messages
--                     show only after cleared_at) and mark them read early.
--   update_post       saves an edit in one transaction: the words, the design
--                     and the stack's other cards. Separately, a filtered word
--                     in card 2 failed the edit after card 1 had been saved.
--                     SECURITY INVOKER, so RLS and the column grants apply as
--                     they do to the separate updates older versions make.

create or replace function public.set_post_pinned(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  -- One pin change at a time per person, so two at once can't make a fourth.
  perform 1 from public.profiles where id = (select auth.uid()) for update;
  select status into v_status from public.posts
  where id = p_post_id and author_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;

  if not p_pinned then
    update public.posts set pinned_at = null where id = p_post_id;
    return;
  end if;
  if v_status <> 'published' then
    raise exception 'Only published posts can be pinned' using errcode = '22023';
  end if;
  if (select count(*) from public.posts
      where author_id = (select auth.uid()) and pinned_at is not null and status = 'published' and id <> p_post_id) >= 3 then
    raise exception 'pin_limit' using errcode = 'check_violation';
  end if;
  update public.posts set pinned_at = coalesce(pinned_at, now()) where id = p_post_id;
end;
$$;

create or replace function private.on_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_read_at is distinct from old.last_read_at then
    new.last_read_at := now();
  end if;
  if new.cleared_at is distinct from old.cleared_at then
    new.cleared_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function private.on_member_update() from public;

create trigger conversation_members_server_times
before update on public.conversation_members
for each row execute function private.on_member_update();

create or replace function public.update_post(
  p_post_id uuid,
  p_text text,
  p_topic text,
  p_template text,
  p_design jsonb,
  p_background_image_path text default null,
  p_cards jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.posts set text = p_text, topic = p_topic
  where id = p_post_id and author_id = (select auth.uid());
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  update public.post_designs
  set template = p_template, design = p_design, background_image_path = p_background_image_path
  where post_id = p_post_id;
  perform public.set_post_cards(p_post_id, p_cards);
end;
$$;
revoke execute on function public.update_post(uuid, text, text, text, jsonb, text, jsonb) from public;
grant execute on function public.update_post(uuid, text, text, text, jsonb, text, jsonb) to authenticated;
