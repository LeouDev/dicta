// POST /api/welcome {"id": "<profile id>"}: sends the welcome email
// (emails/welcome.html) through Resend. The database calls it when a profile is
// created (supabase/migrations/20260927000300_welcome_email.sql). claim_welcome
// hands out each address once, so anyone may call this.
//
// Needs RESEND_API_KEY. WELCOME_FROM overrides the sender, e.g.
// "Dicta <onboarding@resend.dev>" to test without a verified domain.
import { readFileSync } from 'node:fs';

import { claimWelcome, isConfigured, releaseWelcome } from '../lib/supabase.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMPLATE = readFileSync(new URL('../emails/welcome.html', import.meta.url), 'utf8');
// The site's root opens Dicta when it's installed (apple-app-site-association).
const SITE = 'https://dicta-orcin.vercel.app/';

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function POST(request) {
  const { id } = await request.json().catch(() => ({}));
  if (!isConfigured() || !process.env.RESEND_API_KEY) return status(503);
  if (typeof id !== 'string' || !UUID.test(id)) return status(400);
  try {
    const claim = await claimWelcome(id);
    if (!claim) return status(204);
    // ponytail: Apple's relay only forwards mail from domains registered with Apple,
    // so hidden Sign in with Apple addresses are skipped until air-rally.com is.
    if (claim.email.endsWith('@privaterelay.appleid.com')) return status(204);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.WELCOME_FROM || 'Dicta <hello@air-rally.com>',
        to: claim.email,
        reply_to: 'support@air-rally.com',
        subject: 'Welcome to Dicta',
        html: TEMPLATE.replaceAll('{{ .SiteURL }}', SITE).replaceAll('{{ .Email }}', escapeHtml(claim.email)),
      }),
    });
    if (!res.ok) {
      console.error(`welcome ${id}:`, res.status, await res.text());
      await releaseWelcome(id);
      return status(502);
    }
    return status(204);
  } catch (error) {
    console.error(`welcome ${id}:`, error);
    return status(500);
  }
}

const status = (code) => new Response(null, { status: code, headers: { 'Cache-Control': 'no-store' } });
