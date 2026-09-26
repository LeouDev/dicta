// /api/report-alert: every new report emails the moderator once, with the commands to act on it.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { ORIGIN, POST_ID, fakeSupabase } from './fake-supabase.mjs';

const { POST } = await import('../api/report-alert.js');

const ID = '55555555-5555-5555-5555-555555555555';
const COMMENT_ID = '66666666-6666-6666-6666-666666666666';
const USER_ID = '77777777-7777-7777-7777-777777777777';
const alert = (body) => POST(new Request(`${ORIGIN}/api/report-alert`, { method: 'POST', body: JSON.stringify(body) }));

/** A report as the website reads it (reporter and target embedded). */
const report = (overrides = {}) => ({
  id: ID,
  reason: 'hate',
  details: 'Slur in the second line.',
  status: 'open',
  created_at: new Date().toISOString(),
  post_id: POST_ID,
  comment_id: null,
  reported_user_id: null,
  reporter: { username: 'ben' },
  person: null,
  post: { text: 'A mean quote', author: { username: 'mara' } },
  comment: null,
  ...overrides,
});

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test';
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.REPORT_ALERT_TO;
});

test('emails the moderator about a new report once, with what was reported and how to act', async () => {
  const db = fakeSupabase({ reports: { [ID]: report() } });
  assert.equal((await alert({ id: ID })).status, 204);
  assert.equal(db.emails.length, 1);
  const [email] = db.emails;
  assert.equal(email.authorization, 'Bearer re_test');
  assert.equal(email.idempotencyKey, `report-alert/${ID}`);
  assert.equal(email.from, 'Dicta <no-reply@air-rally.com>');
  assert.equal(email.to, 'support@air-rally.com');
  assert.equal(email.subject, 'Dicta report: Hate speech, a quote by @mara');
  assert.match(email.text, /^@ben reported a quote by @mara: Hate speech\.\n\nTheir note: Slur in the second line\./);
  assert.match(email.text, /“A mean quote”/);
  assert.match(email.text, new RegExp(`update posts set status = 'removed' where id = '${POST_ID}';`));
  assert.match(email.text, new RegExp(`update reports set status = 'actioned' where id = '${ID}';`));
  assert.match(email.text, /https:\/\/supabase\.com\/dashboard\/project\/x\/sql\/new/);

  // A repeat (a retry, or anyone else) sends nothing.
  assert.equal((await alert({ id: ID })).status, 204);
  assert.equal(db.emails.length, 1);
});

test('REPORT_ALERT_TO sets the recipient', async () => {
  process.env.REPORT_ALERT_TO = 'moderator@example.com';
  const db = fakeSupabase({ reports: { [ID]: report() } });
  await alert({ id: ID });
  assert.equal(db.emails[0].to, 'moderator@example.com');
});

test('comments and people get their own commands; deleted targets say so', async () => {
  const comment = report({ post_id: null, post: null, comment_id: COMMENT_ID, comment: { body: 'rude reply', author: { username: 'kai' } } });
  const person = report({ post_id: null, post: null, reported_user_id: USER_ID, person: { username: 'kai' }, details: null });
  const gone = report({ post: null });
  for (const [row, subject, command] of [
    [comment, 'a comment by @kai', `delete from comments where id = '${COMMENT_ID}';`],
    [person, '@kai', `the user with ID ${USER_ID} → Delete user`],
    [gone, 'a quote', 'The quote has already been deleted.'],
  ]) {
    const db = fakeSupabase({ reports: { [ID]: row } });
    assert.equal((await alert({ id: ID })).status, 204);
    assert.equal(db.emails[0].subject, `Dicta report: Hate speech, ${subject}`);
    assert.ok(db.emails[0].text.includes(command), command);
  }
});

test('stays quiet for old, closed or unknown reports, and refuses bad ids', async () => {
  const old = report({ created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() });
  const closed = report({ status: 'dismissed' });
  for (const row of [old, closed]) {
    const db = fakeSupabase({ reports: { [ID]: row } });
    assert.equal((await alert({ id: ID })).status, 204);
    assert.equal(db.emails.length, 0);
  }
  const db = fakeSupabase();
  assert.equal((await alert({ id: ID })).status, 204);
  assert.equal((await alert({ id: 'nope' })).status, 400);
  assert.equal(db.emails.length, 0);
});

test('reports a refused email, and needs Resend configured', async () => {
  const db = fakeSupabase({ reports: { [ID]: report() }, resend: () => ({ status: 500, body: { message: 'down' } }) });
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal((await alert({ id: ID })).status, 502);
  } finally {
    console.error = error;
  }
  assert.equal(db.emails.length, 1);
  delete process.env.RESEND_API_KEY;
  assert.equal((await alert({ id: ID })).status, 503);
});
