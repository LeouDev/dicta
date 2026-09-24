# Dicta

**A place where thoughts become art.** Dicta is an iOS-first social network where every post is a designed quote card: you write a thought, then choose its typography, colors, background and layout. Followers see the card, not plain text.

Built with Expo SDK 57 (React Native 0.86, New Architecture, React Compiler), Expo Router, Supabase (Postgres, Auth, Storage, Realtime), TanStack Query and Zustand.

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Expo + TypeScript + Router, Supabase, design tokens, navigation, auth, onboarding, profile setup, full DB schema + RLS | ✅ Done |
| 2 | QuoteCard renderer, feed, profile gallery, seed data | Next |
| 3 | Editor: templates, fonts, colors, backgrounds, layout, live preview, drafts, publish | |
| 4 | Likes, comments, follows, saves, notifications (schema + triggers already live) | |
| 5 | Share sheet + image export (9:16, 1:1, 4:5, original) | |
| 6–8 | Performance, accessibility pass, polish + testing | |

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
npm test            # Jest (jest-expo)
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (ESLint + React Compiler rules)
```

## Architecture

```
src/
  app/            Expo Router routes only (screens + layouts)
    (auth)/       welcome (onboarding), sign-in, sign-up, forgot-password
    (tabs)/       home, discover, activity, profile + custom BottomTabBar
    create.tsx    Create modal (editor lands in Phase 3)
    create-profile.tsx, auth-callback.tsx, reset-password.tsx
  components/     Reusable UI (ui/ primitives, UserAvatar, ProfileHeader, BottomTabBar…)
  features/       Feature-scoped UI (auth/…)
  constants/      Design tokens (tokens.ts) and the font library (fonts.ts)
  hooks/          useTheme, useMyProfile, useDebouncedValue
  lib/            Supabase client, TanStack Query client, query keys
  services/       Data access (auth, profiles) + friendly error mapping
  store/          Zustand stores (auth session)
  types/          Generated Supabase types + app models
  utils/          Pure helpers (validation, formatting), unit tested
supabase/
  migrations/     Schema, RLS, triggers, RPCs, storage buckets/policies
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

### Database

Tables: `profiles`, `posts`, `post_designs` (the structured card design as JSONB with a `version`), `post_hashtags`, `topics`, `follows`, `likes`, `saves`, `comments` (one-level replies), `comment_likes`, `notifications`, `blocks` and `reports`.

- **RLS on every table.** Public profiles and posts. Saves, notifications and blocks are private. Blocked users can't see or comment on each other's content.
- **Column-level grants.** Clients can only write user-editable columns, so counters, `is_verified` and moderation `status` are server-owned.
- **Triggers** maintain like, comment, save, follow and post counts, create notifications (like, comment, reply, mention, follow, comment like) and index hashtags.
- **RPCs:** `create_post` (post and design in one transaction), `home_feed` (keyset pagination), `trending_posts`, `record_share` and `delete_my_account`. Computed fields `liked_by_me`, `saved_by_me` and `followed_by_me` work directly in PostgREST selects.
- **Storage:** public-read buckets `avatars/`, `post-images/` and `generated-cards/`. Users can only write under their own `<user-id>/` folder. Buckets enforce MIME types and size limits.
- **Realtime** is enabled on `notifications` for the Activity badge.

### Decisions

- **JS tabs with a custom tab bar** instead of native tabs, so the Create button can be visually distinct and open a modal.
- **`post_designs` is a separate table**, as specified, written atomically through `create_post`.
- **The publishable key** goes in `EXPO_PUBLIC_SUPABASE_ANON_KEY`; the legacy anon JWT also works. Never ship a secret or service-role key.
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
