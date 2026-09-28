-- Fixes 20260929000000_mention_push: its block check called
-- public.is_blocked_between, which 20260925000100_private_block_helper dropped
-- (so nobody could probe other people's blocks through the API). PL/pgSQL only
-- resolves functions when it runs, so the migration applied, but every push
-- failed in claim_push. claim_push runs as its owner, so it reads blocks directly.

create or replace function public.claim_push(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.push_deliveries;
  v_tokens text[];
  v_name text;
  v_username text;
  v_quote text;
begin
  update public.push_deliveries set sent_at = now()
  where id = p_id and sent_at is null
  returning * into d;
  if not found or not exists (select 1 from public.notifications where id = d.notification_id) then
    return null;
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = d.recipient_id and b.blocked_id = d.actor_id)
       or (b.blocker_id = d.actor_id and b.blocked_id = d.recipient_id)
  ) then
    return null;
  end if;

  if not coalesce((
    select case d.type when 'follow' then s.follows when 'like' then s.likes when 'comment' then s.comments else s.replies end
    from public.push_settings s
    where s.user_id = d.recipient_id
  ), true) then
    return null;
  end if;

  select array_agg(t.token order by t.updated_at desc) into v_tokens
  from public.push_tokens t
  where t.user_id = d.recipient_id;
  if v_tokens is null then
    return null;
  end if;

  select p.display_name, p.username into v_name, v_username from public.profiles p where p.id = d.actor_id;
  if d.type = 'like' then
    select p.text into v_quote from public.posts p where p.id = d.post_id;
  elsif d.type in ('comment', 'reply', 'mention') then
    select c.body into v_quote from public.comments c where c.id = d.comment_id;
  end if;
  v_quote := btrim(regexp_replace(coalesce(v_quote, ''), '\s+', ' ', 'g'));
  if char_length(v_quote) > 80 then
    v_quote := left(v_quote, 79) || '…';
  end if;

  return jsonb_build_object(
    'tokens', to_jsonb(v_tokens),
    'body', case d.type
      when 'follow' then v_name || ' started following you.'
      when 'like' then v_name || ' liked your quote “' || v_quote || '”'
      when 'comment' then v_name || ' commented: “' || v_quote || '”'
      when 'mention' then v_name || ' mentioned you: “' || v_quote || '”'
      else v_name || ' replied: “' || v_quote || '”'
    end,
    -- The screen the notification opens, as Activity opens it.
    'url', case when d.type = 'follow' then '/user/' || v_username else '/post/' || d.post_id end,
    'then', case when d.type in ('comment', 'reply', 'mention') then '/post/' || d.post_id || '/comments' end
  );
end;
$$;
