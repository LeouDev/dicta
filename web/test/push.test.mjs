// /api/push: sends one claimed push to each of the recipient's devices, once,
// and forgets devices Expo says are gone.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { ORIGIN, fakeSupabase } from './fake-supabase.mjs';

const { POST } = await import('../api/push.js');

const ID = '33333333-3333-3333-3333-333333333333';
const push = (body) => POST(new Request(`${ORIGIN}/api/push`, { method: 'POST', body: JSON.stringify(body) }));
const queued = (payload) => ({ [ID]: payload });
const COMMENT = {
  tokens: ['ExponentPushToken[phone]', 'ExponentPushToken[ipad]'],
  body: 'Mara commented: “This one stays with me.”',
  url: '/post/p1',
  then: '/post/p1/comments',
};

afterEach(() => {
  delete process.env.EXPO_ACCESS_TOKEN;
});

test('sends the push to every device, opening where Activity would', async () => {
  const db = fakeSupabase({ pushes: queued(COMMENT) });
  assert.equal((await push({ id: ID })).status, 204);
  assert.deepEqual(db.sent, [
    { to: 'ExponentPushToken[phone]', body: COMMENT.body, sound: 'default', data: { url: '/post/p1', then: '/post/p1/comments' } },
    { to: 'ExponentPushToken[ipad]', body: COMMENT.body, sound: 'default', data: { url: '/post/p1', then: '/post/p1/comments' } },
  ]);

  // Claimed: a second call (a retry, or anyone else) sends nothing.
  assert.equal((await push({ id: ID })).status, 204);
  assert.equal(db.sent.length, 2);
});

test('a follow opens the follower, with nothing after', async () => {
  const db = fakeSupabase({ pushes: queued({ tokens: ['ExponentPushToken[phone]'], body: 'Mara started following you.', url: '/user/mara', then: null }) });
  await push({ id: ID });
  assert.deepEqual(db.sent[0].data, { url: '/user/mara' });
});

test('sends nothing for a push that was taken back, turned off or already sent', async () => {
  const db = fakeSupabase();
  assert.equal((await push({ id: ID })).status, 204);
  assert.deepEqual(db.sent, []);
});

test('forgets devices that can’t receive pushes anymore', async () => {
  const db = fakeSupabase({
    pushes: queued(COMMENT),
    expo: (message) =>
      message.to === 'ExponentPushToken[ipad]'
        ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: 'ticket' },
  });
  assert.equal((await push({ id: ID })).status, 204);
  assert.deepEqual(db.removedTokens, ['ExponentPushToken[ipad]']);
});

test('signs requests with the Expo access token when one is set', async () => {
  process.env.EXPO_ACCESS_TOKEN = 'expo-token';
  const db = fakeSupabase({ pushes: queued(COMMENT) });
  let auth;
  const send = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    if (String(input).startsWith('https://exp.host')) auth = init.headers.Authorization;
    return send(input, init);
  };
  await push({ id: ID });
  assert.equal(auth, 'Bearer expo-token');
  assert.equal(db.sent.length, 2);
});

test('rejects anything else', async () => {
  fakeSupabase();
  assert.equal((await push({})).status, 400);
  assert.equal((await push({ id: 'nope' })).status, 400);
  assert.equal((await POST(new Request(`${ORIGIN}/api/push`, { method: 'POST', body: 'not json' }))).status, 400);
});
