# Dicta in production

How the live pieces behave and what still needs your accounts or credentials. Last verified 2026-09-25.

## Card images

- **Drawn on the phone.** Publishing draws the card (1080 wide, the post's format) and its link preview (1200 × 630) on the phone's GPU with the same renderer as the feed, and uploads both to the private `generated-cards` bucket as `<author>/<post>-<key>(-og).jpg`. `posts.card_image_path` points at the current card. Measured in the simulator: artwork stored 0.7–1.7 s after publishing, every template (Paper and Midnight included).
- **Server fallback.** If the phone couldn't upload (offline, app closed), the website draws what's missing on first request with the app's renderer (`web/card`), CPU only: Paper-like textures take about 45–70 s for the card on Vercel, so a link preview is drawn on its own first (about 2–3 s warm, up to 10 s cold), and the card is drawn in the background when possible.
- **Versions.** The key hashes everything drawn: engine version, text, design, author name, handle, photo and badge. When any of it changes (say, a new profile photo), the page links a new URL; until the new drawing exists the site serves the previous one for 60 s at a time and redraws in the background. Old versions are deleted a day after a redraw.
- **Text in any script.** Fonts fall back only for characters the card's own font lacks: iOS uses its system fonts; the server bundles Noto Sans, Noto Sans Arabic, SC, JP, KR and Color Emoji. Chinese and Japanese break between characters with punctuation kept off line starts; Arabic and Hebrew run right to left.

## Caching and deletion

| What | URL | Cached | When the post is deleted or hidden |
| --- | --- | --- | --- |
| Post page | `/post/<id>` | Vercel CDN 5 min, then stale-while-revalidate | Purged at once, then 404 (cached 60 s) |
| Card | `/card/<id>.jpg?v=<key>` | CDN 1 year, browsers 5 min | Purged at once, then 404 |
| Link preview | `/card/<id>/og.jpg?v=<key>` | CDN 1 year, browsers 5 min | Purged at once, then 404 |
| Stored files | `generated-cards` bucket (private) | Not publicly reachable | Deleted with the post (the app), or with the account |

Every response about a post carries the Vercel cache tag `post-<id>`. A database trigger calls `/api/purge?post=<id>` (pg_net, right after the change commits) whenever a post stops being public: deleted in the app, gone with its author's account, hidden or removed by moderation (`posts.status`), or deleted from the dashboard. The endpoint checks the post really is gone before purging, so it needs no secret. Measured: page, card and preview all 404 within 2 s of a delete.

What a purge can't reach: a browser that already loaded the image keeps its own copy up to 5 minutes; messaging apps store link previews inside conversations; search engines and other crawlers keep their own caches. Before 2026-09-25 the site redirected images to public Storage URLs; the bucket is private now, but copies of those old URLs may linger in Supabase's CDN (they only concern the five posts made before then).

Deleting a post also deletes its uploaded background photo unless another post still uses it.

## Push notifications

New followers, likes, comments and replies (never your own actions; mentions and comment likes stay in Activity):

1. A notification row is created by the existing triggers.
2. `private.queue_push` records it in `push_deliveries`, whose unique key (recipient, actor, kind, post, comment) makes like → unlike → like push once, and, if the recipient has a device, calls `https://dicta-orcin.vercel.app/api/push` through pg_net.
3. `/api/push` calls `claim_push`, which marks the push sent as it reads it (so each goes out at most once), skips it if the notification is gone or that kind is turned off, and returns the text, the devices and the screen to open. It sends through Expo and deletes devices Expo reports as `DeviceNotRegistered`.

The app asks for permission from Activity (never at launch) and in Settings → Notifications, which also has a switch per kind. Tokens are registered while signed in, removed on sign-out, and move to whoever signs in last on a device. Tapping a push opens the follower, or the post and then its comments, from the foreground or a cold start.

**Needs you:**
- **Apple push key.** Expo answers "Could not find APNs credentials for com.leoudev.dicta (@galileouuu/dicta)". Run `npx eas-cli@latest credentials -p ios`, choose production, then Push Notifications, and let EAS create the key (or upload an existing .p8). A production `eas build` offers the same.
- **Optional hardening:** turn on "Enhanced security for push notifications" in the Expo project settings, create an access token, and add it to Vercel as `EXPO_ACCESS_TOKEN` (the site already sends it when present).

Not done: Expo push receipts aren't checked, so credential errors only show in the Vercel logs of `/api/push`.

## Email

Supabase's built-in mailer is still active: 2 emails an hour, delivered only to members of your Supabase organization. Beta testers can't confirm their accounts until custom SMTP is on.

**Needs you:**
1. Pick a provider (Resend, Postmark or Amazon SES) and verify a sending domain you control, for example `air-rally.com` or a Dicta domain. Add the DNS records it gives you: SPF (TXT), DKIM (TXT or CNAME), and a DMARC record such as `v=DMARC1; p=none; rua=mailto:support@air-rally.com`.
2. In `supabase/config.toml`, uncomment `[auth.email.smtp]` and set `host`, `port`, `user`, `admin_email` (for example `no-reply@air-rally.com`) and `sender_name = "Dicta"`. Raise `[auth.rate_limit] email_sent` to 30 or more.
3. `export SUPABASE_AUTH_SMTP_PASS=<the provider's SMTP password or API key>`, then `npx supabase config diff` and, if it only shows the email changes, `npx supabase config push`. (Or enter the same values in the dashboard under Authentication → Emails → SMTP Settings.)

The branded templates (`supabase/templates`) go out with that push. Links keep Supabase's `{{ .ConfirmationURL }}`: Supabase verifies the token and redirects to `dicta://auth-callback` or `dicta://reset-password` with a PKCE `code`, which the app exchanges. Site URL is `dicta://`; `dicta://**` and `exp+dicta://**` are allowed redirects.

**Then check on an iPhone:** sign up → the email arrives → the link opens Dicta signed in. Forgot password → the link opens the new-password screen → sign in with it. Change email → both addresses confirm. A link opened on another device shows "Link expired" (PKCE ties it to the phone that asked), and a used link does too.

## Development seed

`npx supabase start` (needs Docker) creates a local database and loads `supabase/seed.sql`: 25 fictional people, 77 original quotes (some in Chinese, Japanese, Korean, Arabic and Russian), follows, likes, comments, replies and saves. `npm run seed` regenerates the file and reloads it into the local database; `SEED_KEEP_USERS=1` keeps your own local accounts. It can't reach production: the CLI is only called with `--local`, and the SQL refuses to run on any database that has accounts outside `@seed.dicta.test`. Seed accounts have no password. Never run `supabase db reset --linked` or `db push --include-seed`.

## Security

- **The app** uses only the Supabase URL and the publishable key (`sb_publishable_…`). No secret is bundled, committed, or in git history (checked all commits).
- **The website** uses the anon key to read posts (so row-level security decides what's visible) and the service-role key, server-side only, for card images and pushes.
- **Vercel:** `SUPABASE_SECRET_KEY` (unused) was removed on 2026-09-25. Still there and unused, safe for you to remove:
  ```bash
  cd web
  for name in SUPABASE_JWT_SECRET POSTGRES_URL POSTGRES_PRISMA_URL POSTGRES_URL_NON_POOLING POSTGRES_PASSWORD; do
    vercel env rm $name production --scope dicta2 --project dicta -y
  done
  ```
  The Supabase integration may add them back when it re-syncs; you can turn those off in its settings. The `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` variables hold only public values and aren't exposed by this project.
- **Database:** all 16 public tables have row-level security; every `SECURITY DEFINER` function pins `search_path`; anon has no write grants. Supabase's advisors flag three definer functions callable by signed-in users, all intentional (`delete_my_account`, `record_share`, `register_push_token`), and leaked-password protection, which needs the Pro plan.
- **Storage:** `avatars` and `post-images` are public (published content), `generated-cards` is private; people can only write to their own folder.
- **Open endpoints:** `/api/card` draws only posts the anon key can see; `/api/purge` only purges posts that are gone; `/api/push` only sends a queued push once.

`npm run test:db` runs `supabase/tests/social.sql` and `supabase/tests/push.sql` against the linked project in rolled-back transactions.
