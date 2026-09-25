// /api/welcome: sends the welcome email once per person, filled in, from the right sender.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { ORIGIN, fakeSupabase } from './fake-supabase.mjs';

const { POST } = await import('../api/welcome.js');

const ID = '44444444-4444-4444-4444-444444444444';
const welcome = (body) => POST(new Request(`${ORIGIN}/api/welcome`, { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test';
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.WELCOME_FROM;
});

test('sends the welcome email once, filled in', async () => {
  const db = fakeSupabase({ welcome: { [ID]: 'mara@example.com' } });
  assert.equal((await welcome({ id: ID })).status, 204);
  assert.equal(db.emails.length, 1);
  const [email] = db.emails;
  assert.equal(email.authorization, 'Bearer re_test');
  assert.equal(email.from, 'Dicta <hello@air-rally.com>');
  assert.equal(email.to, 'mara@example.com');
  assert.equal(email.reply_to, 'support@air-rally.com');
  assert.equal(email.subject, 'Welcome to Dicta');
  assert.match(email.html, /href="https:\/\/dicta-orcin\.vercel\.app\/"/);
  assert.match(email.html, /created a Dicta account with mara@example\.com\./);
  assert.match(email.html, /src="https:\/\/dicta-orcin\.vercel\.app\/email\/emblem\.png"/);
  assert.doesNotMatch(email.html, /\{\{/, 'no placeholder left');

  // Claimed: a repeat (a retry, or anyone else) sends nothing.
  assert.equal((await welcome({ id: ID })).status, 204);
  assert.equal(db.emails.length, 1);
});

test('uses WELCOME_FROM, for testing before the domain is verified', async () => {
  process.env.WELCOME_FROM = 'Dicta <onboarding@resend.dev>';
  const db = fakeSupabase({ welcome: { [ID]: 'mara@example.com' } });
  await welcome({ id: ID });
  assert.equal(db.emails[0].from, 'Dicta <onboarding@resend.dev>');
});

test('lets a refused email be sent later', async () => {
  let refuse = true;
  const db = fakeSupabase({
    welcome: { [ID]: 'mara@example.com' },
    resend: () => (refuse ? { status: 403, body: { message: 'The air-rally.com domain is not verified.' } } : { status: 200, body: { id: 'email' } }),
  });
  assert.equal((await welcome({ id: ID })).status, 502);
  refuse = false;
  assert.equal((await welcome({ id: ID })).status, 204);
  assert.equal(db.emails.length, 2);
});

test('skips hidden Sign in with Apple addresses', async () => {
  const db = fakeSupabase({ welcome: { [ID]: 'x1y2z3@privaterelay.appleid.com' } });
  assert.equal((await welcome({ id: ID })).status, 204);
  assert.deepEqual(db.emails, []);
});

test('does nothing until Resend is set up, and rejects anything else', async () => {
  delete process.env.RESEND_API_KEY;
  const db = fakeSupabase({ welcome: { [ID]: 'mara@example.com' } });
  assert.equal((await welcome({ id: ID })).status, 503);
  assert.equal(db.welcomed.size, 0, 'nothing claimed');

  process.env.RESEND_API_KEY = 're_test';
  assert.equal((await welcome({})).status, 400);
  assert.equal((await welcome({ id: 'nope' })).status, 400);
  assert.equal((await welcome({ id: '55555555-5555-5555-5555-555555555555' })).status, 204);
  assert.deepEqual(db.emails, []);
});
