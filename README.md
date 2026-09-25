# Dicta

**A place where thoughts become art.** Dicta is an iOS-first social network where every post is a designed quote card: you write a thought, then choose its typography, colors, background and layout. Followers see the card, not plain text.

Built with Expo SDK 57 (React Native 0.86, New Architecture, React Compiler), Expo Router, Supabase (Postgres, Auth, Storage, Realtime), TanStack Query and Zustand.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Expo + TypeScript + Router, Supabase, design tokens, navigation, auth, onboarding, profile setup, full DB schema + RLS | ✅ Done |
| 2–3 | Quote card engine (Skia), 8 templates, visual editor with live preview, drafts, publish, image export (9:16, 4:5, 1:1, original), feed + profile gallery | ✅ Done |
| 4 | Social: likes (double-tap), threaded comments, follows, saves, Activity with realtime badge, Discover (trending, creators, topics, hashtags), debounced search, post view, other profiles, share sheet (save image, copy link, share counts), settings (edit profile, log out, delete account), report + block | ✅ Done |
| 5 | Seed data, push notifications, universal links (web domain) | Next |

## Getting started

Prerequisites: Node 22+, Xcode 26+ with an iOS simulator, CocoaPods.

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable/anon key
npx expo run:ios             # builds the dev client and starts Metro
```

The app needs a **development build** (`expo run:ios` or `eas build --profile development`); Expo Go can't do Sign in with Apple for your bundle ID or open `dicta://` email links.

### Supabase

The project is linked with the local CLI (`npx supabase`, installed as a dev dependency).

```bash
npx supabase login                                  # if SUPABASE_ACCESS_TOKEN is set in your shell, unset it first
npx supabase link --project-ref <project-ref>
npm run db:push                                     # apply supabase/migrations
npm run db:types                                    # regenerate src/types/database.ts
npx supabase db advisors --linked                   # security/performance lints
```

Before running `npx supabase config push`, run `npx supabase config diff` first. It pushes every value declared in `supabase/config.toml` without asking.

### Manual configuration still required

1. **Sign in with Apple**: in the Apple Developer portal, enable the *Sign in with Apple* capability for `com.leoudev.dicta` (change `ios.bundleIdentifier` in `app.json` if you use another ID). Supabase's Apple provider is already enabled with that bundle ID as the client ID; native sign-in needs no secret.
2. **Email delivery**: Supabase's built-in mailer only sends to your team's addresses and is heavily rate limited. Configure custom SMTP (Resend, Postmark, SES…) under *Authentication → Emails* before inviting testers. Email confirmation is on.
3. **Redirect URLs**: `dicta://**` and `exp+dicta://**` are already allowed (email confirmation and password reset open the app).

## Scripts

```bash
npm test               # Jest (jest-expo), incl. real-Skia layout checks for every template × format
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint (ESLint + React Compiler rules)
npm run render:cards   # renders every template × format × sample text to .renders/*.png (slow, CPU)
npm run test:db        # backend tests (supabase/tests/social.sql) against the linked project, in one rolled-back transaction
```

`RENDER_ONLY=editorial,journal npm run render:cards` limits the templates; `RENDER_AVATAR=/path/to/photo.jpg` adds an avatar.

## Architecture

```
src/
  app/            Expo Router routes only (screens + layouts)
    (auth)/       welcome (onboarding), sign-in, sign-up, forgot-password
    (tabs)/       home, discover (+ search), activity, profile + custom BottomTabBar
    create.tsx    Create modal: write → design → post / share
    post/[id]/    post view; comments (native form sheet)
    user/[username].tsx, topic/[slug].tsx, tag/[tag].tsx
    settings/     settings, edit profile, blocked accounts
    share.tsx, report.tsx   modal routes (see Decisions)
    create-profile.tsx, auth-callback.tsx, reset-password.tsx
  components/     Reusable UI (ui/ primitives, UserAvatar, ProfileHeader, FollowButton, Toaster, BottomTabBar…)
  features/       Feature modules: quote-card (renderer), composer (editor), feed (PostCard, grid, actions),
                  comments, social (optimistic reducers), share, safety, profile (shared profile form), auth
  constants/      Design tokens (tokens.ts) and the font library (fonts.ts)
  hooks/          Queries and optimistic mutations (posts, social, notifications, discover, safety…)
  lib/            Supabase client, TanStack Query client, query keys, cache patching, action sheets
  services/       Data access (posts, comments, social, notifications, discover, safety, share, account…)
  store/          Zustand stores (auth session)
  types/          Generated Supabase types + app models
  utils/          Pure helpers (validation, formatting), unit tested
supabase/
  migrations/     Schema, RLS, triggers, RPCs, storage buckets/policies
  tests/          SQL tests for the social layer (npm run test:db)
  config.toml     Auth/storage config mirrored to the hosted project
```

### Navigation + auth

The root layout uses `Stack.Protected` guards driven by two facts: *signed in?* and *has a profile?*

- Signed out → `(auth)` (onboarding, email/Apple sign-in, password reset).
- Signed in, no profile → `create-profile` (photo, display name, unique username with live availability check).
- Signed in with profile → `(tabs)` + the Create modal.

`store/auth.ts` listens to Supabase auth events and fetches the user's profile **before** publishing a new session, so guards never flash the wrong screen. Sessions persist in `expo-sqlite`'s localStorage. Tokens refresh only while the app is in the foreground. Auth uses the PKCE flow; email links open `dicta://auth-callback` or `dicta://reset-password`, which exchange the code for a session.

### Design system

`constants/tokens.ts` is the single source for colors (light and dark semantic tokens), the 8pt spacing scale, radii, typography, shadows, animation springs and touch targets. App chrome uses San Francisco for UI text and DM Serif Display for editorial titles. Quote card designs carry their own colors and never follow the app theme.

`constants/fonts.ts` defines the font library used by the card editor: Editorial (DM Serif Display), Elegant (Cormorant Garamond), Classic (Libre Baskerville), Modern (Inter), Minimal (DM Sans), Bold (Archivo Black), Typewriter (Courier Prime) and Handwritten (Caveat). All are Google Fonts under the **SIL Open Font License 1.1**, which allows bundling in commercial apps. Only the listed weights ship, imported per weight to keep the bundle small.

### Quote card engine

A post is **structured data** (`text` + `QuoteDesign`), never a flattened image. One renderer draws it everywhere:

```
QuoteDesign (JSON in post_designs.design)          CardAuthor (live from profiles)
        │  parseQuoteDesign(): validate, clamp, fill template defaults
        ▼
layoutCard({ text, design, author, width, format, fonts })   ← pure, synchronous (Skia Paragraph API)
        │  → CardLayout: positioned paragraphs, per-line tilt, header, signature, texture params
        ▼
<QuoteCanvas layout avatar backgroundImage />                ← pure Skia drawing tree, no async, no layout
        ├── <QuoteCard>         on screen: feed, profile grid, editor preview, template thumbnails
        └── exportCardImage()   offscreen drawAsImage at 1080px → PNG → iOS share sheet
```

- **Design units.** Designs are authored on a virtual canvas 1000 units wide; every size scales with the render width, so a 358pt feed card and a 1080px export are the same composition.
- **Formats adapt, they don't stretch.** Width sets the type scale; the format only changes the canvas height the design flows into. Stories keep clear of Instagram's top/bottom UI, and text shrinks to fit (binary search on the font scale) when a format is shorter. It never grows past the chosen size.
- **Editorial "hand-set" look.** Each laid-out line is re-set as its own paragraph and tilted ±1.5° around its center, deterministically seeded from the text, so a post never changes between renders.
- **Textures are procedural** (one SkSL shader: paper, grain, noise, canvas, film), evaluated in design units, so there are no image assets and they stay crisp at any resolution. Grain and noise multiply on light cards and screen on dark ones.
- **Fonts** are the same OFL files the app UI uses, registered once into a Skia font provider under their expo-font names; system fallback covers emoji and other scripts.
- **Images** (avatars, photo backgrounds) are decoded once and shared through an LRU cache.
- **Templates** are full style presets (`templates.ts`). Switching keeps the format, signature and chosen photo; font size auto-suggests from text length until the person drags the size slider.

Files: `src/features/quote-card/` (`types`, `templates`, `serialize`, `geometry`, `layout`, `quote-canvas`, `quote-card`, `export`, `textures`, `fonts`, `images`, `palettes`) and `src/features/composer/` (editor: `store`, `write-step`, `design-step`, the six control panels, `color-picker-sheet`, `export-sheet`, `photo`, `validate`).

### Database

Tables: `profiles`, `posts`, `post_designs` (the structured card design as JSONB with a `version`), `post_hashtags`, `topics`, `follows`, `likes`, `saves`, `comments` (one-level replies), `comment_likes`, `notifications`, `blocks` and `reports`.

- **RLS on every table.** Public profiles and posts. Saves, notifications and blocks are private. Blocked users can't see or comment on each other's content.
- **Column-level grants.** Clients can only write user-editable columns, so counters, `is_verified` and moderation `status` are server-owned.
- **Triggers** maintain like, comment, save, follow and post counts, create notifications (like, comment, reply, mention, follow, comment like) and index hashtags.
- **RPCs:** `create_post` (post and design in one transaction), `home_feed` (keyset pagination), `trending_posts`, `record_share` and `delete_my_account`. Discovery and search: `trending_hashtags`, `search_hashtags`, `search_profiles`, `search_posts` and `suggested_creators` (security invoker, so RLS and blocks apply; search input is escaped for `LIKE`). Computed fields `liked_by_me`, `saved_by_me` and `followed_by_me` work directly in PostgREST selects.
- **Blocking** removes follows and notifications between the two people, and hides each other's posts, comments, profiles in search and notifications.
- **Storage:** public-read buckets `avatars/`, `post-images/` and `generated-cards/`. Users can only write under their own `<user-id>/` folder. Buckets enforce MIME types and size limits.
- **Realtime** is enabled on `notifications` for the Activity badge.

### Decisions

- **JS tabs with a custom tab bar** instead of native tabs, so the Create button can be visually distinct and open a modal.
- **`post_designs` is a separate table**, as specified, written atomically through `create_post`.
- **The publishable key** goes in `EXPO_PUBLIC_SUPABASE_ANON_KEY`; the legacy anon JWT also works. Never ship a secret or service-role key.
- **Social writes are optimistic.** Taps update every cached copy of a post, comment or profile at once (`lib/cache.ts`); requests for the same target run in order (mutation `scope`), so the last tap wins, and failures roll back with a quiet toast. Counts are owned by database triggers, never computed by the client.
- **Share and Report are modal routes, not React Native `Modal`s.** An RN `Modal` presents from the root view controller and silently fails while the editor or the comments sheet is up; native-stack modals stack correctly. The toast renders in a `FullWindowOverlay` so it shows above sheets.
- **Account deletion** runs through a `SECURITY DEFINER` RPC that deletes the auth user and cascades from there. The app removes the user's storage files first. No service-role key is ever needed on device.

## Building for iOS

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build --platform ios --profile development   # dev client for devices
eas build --platform ios --profile production    # App Store build
eas submit --platform ios
```

Set `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment variables for each environment.
