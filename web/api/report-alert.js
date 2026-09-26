// POST /api/report-alert {"id": "<report id>"}: emails the moderator about a new
// report, with what was reported and the SQL to act on it, so the Terms'
// 24-hour promise doesn't rest on remembering to look. The database calls it
// when a report is filed (supabase/migrations/20260928000200_report_alert.sql).
//
// Anyone may call it: it only reads reports that are open and under an hour
// old, and Resend's idempotency key turns any repeat into a no-op.
//
// Needs RESEND_API_KEY. REPORT_ALERT_TO overrides the recipient.
import { fetchReport, isConfigured, sqlEditorUrl } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRESH_MS = 60 * 60 * 1000;
// As the app names them (src/services/safety.ts).
const REASONS = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  self_harm: 'Self-harm or suicide',
  nudity: 'Nudity or sexual content',
  violence: 'Violence or threats',
  misinformation: 'False information',
  other: 'Something else',
};

export async function POST(request) {
  const { id } = await request.json().catch(() => ({}));
  if (!isConfigured() || !process.env.RESEND_API_KEY) return status(503);
  if (typeof id !== 'string' || !UUID.test(id)) return status(400);
  try {
    const report = await fetchReport(id);
    if (!report || report.status !== 'open' || Date.now() - Date.parse(report.created_at) > FRESH_MS) return status(204);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `report-alert/${id}`,
      },
      body: JSON.stringify({
        from: 'Dicta <no-reply@air-rally.com>',
        to: process.env.REPORT_ALERT_TO || 'support@air-rally.com',
        ...alert(report),
      }),
    });
    // 409: this report's alert already went out (Resend remembers the key for a day).
    if (!res.ok && res.status !== 409) {
      console.error(`report alert ${id}:`, res.status, await res.text());
      return status(502);
    }
    return status(204);
  } catch (error) {
    console.error(`report alert ${id}:`, error);
    return status(500);
  }
}

/** Subject and plain-text body: what was reported, by whom, and the commands to act on it. */
export function alert(report) {
  const reason = REASONS[report.reason] ?? report.reason;
  const reporter = report.reporter ? `@${report.reporter.username}` : 'Someone';
  const close = `Then close the report:\nupdate reports set status = 'actioned' where id = '${report.id}';\n(or 'dismissed' when nothing breaks the Terms)`;

  let what, body;
  if (report.post_id) {
    what = report.post ? `a quote by @${report.post.author?.username}` : 'a quote';
    body = report.post
      ? `“${report.post.text}”\n\nTo take it down everywhere, the website included:\nupdate posts set status = 'removed' where id = '${report.post_id}';`
      : 'The quote has already been deleted.';
  } else if (report.comment_id) {
    what = report.comment ? `a comment by @${report.comment.author?.username}` : 'a comment';
    body = report.comment
      ? `“${report.comment.body}”\n\nTo remove it:\ndelete from comments where id = '${report.comment_id}';`
      : 'The comment has already been deleted.';
  } else {
    what = report.person ? `@${report.person.username}` : 'a person';
    body = report.person
      ? `To remove them and everything they posted: Authentication → Users → the user with ID ${report.reported_user_id} → Delete user.`
      : 'The account has already been deleted.';
  }

  const note = report.details ? `\n\nTheir note: ${report.details}` : '';
  const text = [
    `${reporter} reported ${what}: ${reason}.${note}`,
    body,
    close,
    `Run these in the SQL editor: ${sqlEditorUrl()}\nThe Terms promise a review within 24 hours.`,
  ].join('\n\n');
  return { subject: `Dicta report: ${reason}, ${what}`, text };
}

const status = (code) => new Response(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
