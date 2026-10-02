// POST /api/push {"id": "<push_deliveries id>"}: sends one notification's push
// through Expo. The database calls it after a follow, like, comment or reply
// (supabase/migrations/20260927000100_push_and_purge.sql), and with
// {"message": "<messages id>"} after a direct message (…20261002000500_direct_messages.sql).
// claim_push / claim_message_push mark the push sent as they read it, so each
// goes out at most once and anyone may call this.
import { claimMessagePush, claimPush, isConfigured, removePushTokens } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

export async function POST(request) {
  const { id, message } = await request.json().catch(() => ({}));
  if (!isConfigured()) return status(503);
  const key = message ?? id;
  if (typeof key !== 'string' || !UUID.test(key)) return status(400);
  try {
    const push = message ? await claimMessagePush(message) : await claimPush(id);
    if (!push) return status(204);
    // Where a tap opens, as Activity opens it: the post, then its comments.
    const data = push.then ? { url: push.url, then: push.then } : { url: push.url };
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // Needed once "enhanced security for push notifications" is on for the Expo project.
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(push.tokens.map((to) => ({ to, body: push.body, sound: 'default', data }))),
    });
    const result = await res.json().catch(() => ({}));
    const tickets = result.data ?? [];
    if (!res.ok || result.errors) console.error(`push ${key}:`, res.status, JSON.stringify(result.errors ?? result));
    // Devices where Dicta was deleted or its notifications turned off.
    const gone = push.tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
    if (gone.length) await removePushTokens(gone);
    for (const ticket of tickets) {
      if (ticket.status === 'error' && ticket.details?.error !== 'DeviceNotRegistered') console.error(`push ${key}:`, ticket.message);
    }
    return status(204);
  } catch (error) {
    console.error(`push ${key}:`, error);
    return status(500);
  }
}

const status = (code) => new Response(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
