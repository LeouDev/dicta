// POST /api/push {"id": "<push_deliveries id>"}: sends one notification's push
// through Expo. The database calls it after a follow, like, comment or reply
// (supabase/migrations/20260927000100_push_and_purge.sql). claim_push marks the
// push sent as it reads it, so each goes out at most once and anyone may call this.
import { claimPush, isConfigured, removePushTokens } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

export async function POST(request) {
  const { id } = await request.json().catch(() => ({}));
  if (!isConfigured()) return status(503);
  if (typeof id !== 'string' || !UUID.test(id)) return status(400);
  try {
    const push = await claimPush(id);
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
    if (!res.ok || result.errors) console.error(`push ${id}:`, res.status, JSON.stringify(result.errors ?? result));
    // Devices where Dicta was deleted or its notifications turned off.
    const gone = push.tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered');
    if (gone.length) await removePushTokens(gone);
    for (const ticket of tickets) {
      if (ticket.status === 'error' && ticket.details?.error !== 'DeviceNotRegistered') console.error(`push ${id}:`, ticket.message);
    }
    return status(204);
  } catch (error) {
    console.error(`push ${id}:`, error);
    return status(500);
  }
}

const status = (code) => new Response(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
