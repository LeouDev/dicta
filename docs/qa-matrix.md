# QA matrix: Phase 6 (2026-09-25)

Run on the iPhone 17e simulator (iOS 26.5) with a fresh development build, signed in as **A** = Alven (@leoualven.comendador). **B** = @galileouuu, whose side was checked in the database. All test posts, comments and the like were removed afterwards; the one test report stays in `reports` (status `open`, details "qa test report from phase 6, please ignore") so you can see it.

PASS = exercised end to end this phase. NOT TESTED = not run this phase; the reason is given. No failures remain: the one found (the feed) is fixed and re-checked.

| Area | Result | How it was checked |
| --- | --- | --- |
| Authentication | PASS | Session restored across cold starts. A fresh email sign-in wasn't re-run: the test account's password isn't known to me. |
| Apple Sign In | NOT TESTED | Needs an Apple ID on a device. |
| Email confirmation | PASS | 2026-09-26, TestFlight build 2 on your iPhone: sign-up with a new address, the email's link opened Dicta and moved on to profile setup (build 1 stayed on "Confirming your email"). From build 4, an address that already has an account says so instead of waiting for an email. |
| Password reset | PASS (email) | 2026-09-26: a reset email reached Gmail through Resend. Not yet started from "Forgot password?" on a phone, which is what makes the link work. |
| Profile | PASS | Own and other profiles; post, follower and following counts updated after deleting posts, following, blocking and unblocking. |
| Publishing | PASS | Six posts in six scripts across Editorial, Midnight, Typewriter and Minimal. Artwork stored 0.7–1.7 s after publishing; keys match the website's. |
| Drafts | NOT TESTED | Not re-run this phase. |
| Feed | PASS after fix | **Found:** new posts landed above the visible area (FlashList kept the old first post in place). Fixed and re-checked. Timestamps went "11m" → "18m" with no refetch. |
| Likes | PASS | Like → row, count 1, B notified, push queued. Unlike → row and notification removed. Re-like pushes nothing new (database test). |
| Double tap | NOT TESTED | The simulator tool can't tap twice within 260 ms. |
| Comments | PASS | Comment → row, count 1, B notified, push queued. Deleting it removed the notification and reset the count. |
| Replies | PASS | Backend only: reply notification and push in the database test. Reply UI not re-run. |
| Follows | PASS | Re-follow from B's profile: A following, B's follower count 1, B notified. |
| Saves | NOT TESTED | Not re-run this phase. |
| Activity | PASS | A's side: push prompt card, empty state. B's rows exist in the database; B's badge needs B's phone. |
| Discover | NOT TESTED | Not re-run this phase. |
| Search | NOT TESTED | Not re-run this phase. |
| Sharing | PASS | Share screen opens with format choices. |
| Save Image | PASS | Story (1080 × 1920) and Original (1080 × 1350) of the Arabic post saved to Photos; right-to-left order and joined letters correct. |
| Copy Link | NOT TESTED | The link format (`/post/<id>`) was checked on the website; the button wasn't tapped. |
| Instagram / Facebook Stories | NOT TESTED on a phone | 2026-09-26, simulator with the install check bypassed: the pasteboard held the sticker (PNG 1208 × 1478, transparent corners), the background (JPEG 1080 × 1920), the app ID and the post link. Opening Instagram needs the app: build 3 on your iPhone. |
| Threads / X | PASS (simulator) | Threads opened its composer on threads.com in Safari (not signed in there). The URLs have a unit test; on a phone with the apps installed, they open instead. |
| Deep links | PASS | `dicta://user/…` opens the profile; a push opens the post and then its comments, from the foreground and from a cold start. Universal links were verified on your iPhone earlier. |
| Website | PASS | Page, card and preview for every production post. The first post's new card finished in the background about 70 s later (Paper texture, CPU). |
| Link preview | PASS | Preview images for all six scripts, without missing-glyph boxes. iMessage checked by you earlier; WhatsApp not checked. |
| Notifications: permission, tokens, settings, taps | PASS | Asked from Activity, not at launch. Token registered. Likes switch saved to the database and restored. Pushes open the right screen. |
| Notifications: delivery to a phone | PASS | 2026-09-26, TestFlight build 1 on your iPhone: Alven liked your post in the simulator; the push was queued, sent through Expo within a second, and arrived on the phone. Tapping it opened the post. |
| Block | PASS | Follows both ways and notifications between A and B removed; B's posts left A's feed; B listed in Blocked accounts. |
| Unblock | PASS | Unblocked; following again works. |
| Report | PASS | Row in `reports`: reason, details, post, status `open`. |
| Logout | NOT TESTED | Would sign out the test account (password unknown). Removing the push token on logout has a unit test. |
| Delete account | NOT TESTED | Destructive; needs a throwaway account, which needs email (SMTP). The website purge now comes from the database trigger, which also fires for posts deleted along with an account. |
| Dark mode | PASS | Profile and feed in dark appearance. |
| VoiceOver | NOT TESTED | Labels exist (for example "posted 5 minutes ago"); needs a device. |
| Keyboard | PASS | Comment box sits above the keyboard; the report form scrolls "Send report" above it. |
| Photos permission | NOT TESTED | Saving worked; access was already granted, so the prompt didn't show. The wording was reviewed (library and add-only). |
| Offline / error states | NOT TESTED | The simulator shares the Mac's network. |
| Multilingual text | PASS | Six sentences checked in the iOS feed and composer, website card, link preview and export. Server check found zero missing glyphs. |
| Deletion from the web | PASS | Five deletes: page, card and preview returned 404 within 2 s; pg_net logged 5 purges (204); stored files gone; no orphaned files. |
| Seed | PASS | Generator tests (6/6). Not loaded into a database: Docker isn't installed here. |
| Welcome email | PASS | 2026-09-26: arrived in Gmail's inbox from Dicta <hello@air-rally.com>, emblem and design intact. Sent once per person (database test). |

## Automated tests

| Suite | Result |
| --- | --- |
| Jest (app) | 222 / 222 in 22 suites, including the frozen 13-card render fingerprint |
| Website (`cd web && npm test`) | 34 / 34 |
| Seed (`npm run test:seed`) | 6 / 6 |
| Database (`supabase/tests/push.sql`, `welcome.sql`) | Passed on the live database (2026-09-26), in rolled-back transactions |
| Database (`supabase/tests/social.sql`) | Passed on the live database (2026-09-26) |
| TypeScript / ESLint / expo-doctor | Clean / 0 errors (2 old warnings) / 21 of 21 checks |
