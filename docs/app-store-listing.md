# App Store listing: Dicta 1.0

Ready to paste into App Store Connect → **Dicta: Thoughts as Art**. Lengths are within Apple's limits. Screenshots: 5, in `~/Downloads/Dicta App Store screenshots/`, to upload in order: `6.5-inch (use this)` at 1284 × 2778 for the slot App Store Connect shows, and the same five at 1320 × 2868 in `6.9-inch (optional)` for Media Manager's 6.9-inch slot.

## App Information

| Field | Value |
| --- | --- |
| Name | Dicta: Thoughts as Art |
| Subtitle (30) | Turn your words into art |
| Primary category | Social Networking |
| Secondary category | Graphics & Design |
| Privacy Policy URL | https://dicta-orcin.vercel.app/privacy |
| Content rights | Yes, it shows third-party content (people's posts); the Terms give Dicta the rights it needs |
| Age rating | 13+ (answers below) |

## Version 1.0

**Promotional text** (170)

> Write a thought, pick a design, and share it anywhere, even as a sticker on your Instagram story. No ads, no tracking.

**Keywords** (100; words already in the name and subtitle are left out)

> quote,quotes,maker,poetry,poem,journal,writing,typography,aesthetic,captions,affirmations,card,story

**Description**

> Dicta turns what you think into something worth sharing. Write a thought, pick a design, and it becomes a quote card, a beautiful one.
>
> DESIGNED, NOT JUST TYPED
> • 18 templates, from paper-and-ink Editorial to Midnight, Typewriter, Pager and Photograph
> • 13 hand-picked fonts, your own colors, gradients and photos
> • Cards lay themselves out: the text sizes itself to fit, in any language, from English to Chinese and Arabic
>
> A FEED OF THOUGHTS
> • Follow people whose words move you
> • Double-tap to like, comment, reply and save
> • Discover trending quotes, topics, hashtags and creators
>
> SHARE IT EVERYWHERE
> • Put your card on your Instagram or Facebook story as a sticker, over its own colors
> • Post to Threads and X with a link that shows the card
> • Save it in Story, Post, Square or original size, or copy a link anyone can open
>
> YOUR GALLERY
> • A profile with your cover photo, your cards and the people who follow you
> • Notifications for new followers, likes, comments and replies, only the kinds you choose
>
> SAFE BY DESIGN
> • Report or block anyone from the ⋯ menu
> • Slurs and explicit words can't be posted, and every report is reviewed
> • Sign in with Apple or email, and delete your account any time in Settings
>
> Dicta shows no ads and doesn't track you.
>
> Terms of Use: https://dicta-orcin.vercel.app/terms
> Privacy Policy: https://dicta-orcin.vercel.app/privacy

| Field | Value |
| --- | --- |
| Support URL | https://dicta-orcin.vercel.app/support |
| Marketing URL | https://dicta-orcin.vercel.app |
| Copyright | 2026 Leou Alven Comendador |
| Price | Free |
| Build | Build 5 (the first with the terms agreement and the filter message; see the checklist) |

## App Privacy

Every item: **collected, linked to the user, used for App Functionality only, not used for tracking.**

| Category | Type | What it is in Dicta |
| --- | --- | --- |
| Contact Info | Email Address | Sign-in and account emails |
| Contact Info | Name | The display name people choose |
| User Content | Photos or Videos | Profile photo, cover photo, card backgrounds |
| User Content | Other User Content | Quotes, card designs, comments, bio |
| Identifiers | User ID | The account ID |
| Identifiers | Device ID | The push-notification token, only if notifications are on |
| Usage Data | Product Interaction | Likes, follows and saves |

Not collected: location (photos are re-saved without it), contacts, health, financial info, browsing or search history, purchases, diagnostics, sensitive info. **Tracking: No.**

## Age Rating

| Question | Answer |
| --- | --- |
| Parental controls / age assurance | No |
| Unrestricted web access | No (links open in Safari) |
| User-generated content | Yes |
| Messaging and chat | No (comments are public; there are no private messages) |
| Social media (a feed that spreads posts to many people) | Yes |
| Advertising | No |
| Violence, sexual content, profanity, horror, drugs, gambling, medical, mature themes | None (the app itself provides none; user posts are filtered and moderated) |

The feed makes the minimum **13+**, which matches the Terms ("at least 13").

## App Review Information

- **Sign-in required:** yes. Use the demo account (see the checklist): email and password in the sign-in fields.
- **Contact:** your name, phone and email.
- **Notes** (3,154 of 4,000 bytes; the same text answered Apple's Guideline 2.1 "Information Needed" request of 26 September 2026 (reply sent at 13:58), which asked for it in both the reply and the Notes, with a screen recording, linked as an unlisted YouTube video):

```text
1. Screen recording
Unlisted video, recorded on an iPhone running the latest iOS: https://youtu.be/ZC6x5jPEHCo
It starts at launch and shows signing up (with the confirmation email), creating and sharing a post, liking and reporting a post, blocking a person, signing out and back in, and deleting the account.

2. Purpose and audience
Dicta is a social app where every post is a designed quote card. People write a short thought, quote or poem, choose a design (18 templates, 13 fonts, their own colors and photos) and publish it to a feed where others can like, comment, save, follow and share it. It's for people 13 and older who write or collect words: poetry, affirmations, favorite lines. Today they type in one app, design the image in another and post it somewhere else; Dicta does all three in seconds and gives the words a home of their own. It's free, with no ads and no tracking.

3. How to use it
- Sign in with the demo account in the Sign-In Information fields. It follows a few people, so the feed has posts. You can also create an account with email (a confirmation email is sent) or Sign in with Apple.
- Create: tap + in the tab bar, write a thought, tap Design, pick a template, tap Post.
- Share: tap the share icon under a card. The Instagram and Facebook Stories buttons appear when those apps are installed.
- Report: the ... menu on any post or profile, or press and hold a comment.
- Block: the ... menu on a post or profile.
- Delete account: Profile > Settings (gear icon) > Delete account.

4. External services
- Supabase: database, sign-in (email and password, Sign in with Apple) and photo storage.
- Vercel: the website that shows shared posts and link previews, and the server functions that send notifications, emails and moderation alerts.
- Resend: email (sign-up confirmation, password reset, welcome, moderation alerts).
- Expo Push Service and Apple Push Notification service: push notifications.
- Sharing: Instagram and Facebook Stories through Meta's documented Sharing to Stories URL scheme (a Meta app ID only; no Meta SDK or login), Threads and X through their public post links.
No AI services, analytics, advertising or payments.

5. Regions
The app works the same in every region where it's offered. It isn't offered in China mainland.

6. Regulated industry or protected material
Neither applies. People post their own words and photos (the Terms require the rights to what they post), the fonts are open source (SIL Open Font License), and reports handle any claims.

User-generated content (Guideline 1.2)
- Filtering: quotes, comments, display names and bios containing slurs or explicit sexual terms are rejected by the server.
- Reporting: every report is emailed to the moderator at once and reviewed within 24 hours; content that breaks the Terms is removed, and so are the people who post it.
- Blocking: blocked people's posts disappear for both sides immediately.
- Terms: new users agree to the Terms of Use, which state zero tolerance for objectionable content and abusive users, when they create their profile.
- Contact: support@air-rally.com, also on https://dicta-orcin.vercel.app/support
```
