# Atlas Agency: Architecture (Step 1)

Atlas Agency is a geography game for grades K–8. Players are junior agents tracking
**the Magpie Ring**, a crew of thieves who steal world landmarks. Each solved case
sends a landmark home. Everything here (story, characters, names, art direction) is original.

## Stack

| Concern | Choice |
|---|---|
| App | Expo SDK 58, React Native 0.88, TypeScript (strict), Expo Router (`src/app`) |
| Map | `@maplibre/maplibre-react-native` 11, Natural Earth + OpenStreetMap vector tiles packaged as PMTiles per region |
| Backend | Supabase: Postgres, Auth, RLS, Realtime (private broadcast channels), Storage, Edge Functions |
| Content | Versioned JSON in `public.content_items`, validated by Zod (`src/content/schemas.ts`) |
| Offline | `expo-sqlite` local store, plus an outbox of answer events with client UUIDs (idempotent sync) |
| Speech | `expo-speech` (on-device TTS) for read-aloud and spelling prompts, so no third-party audio service |
| i18n | `i18next` + `expo-localization`; every content string is `{ en, es }` |

## Folder structure

```
atlas-agency/
├─ app.json                  Expo config. No ad ID, no location/camera/mic/contacts permissions
├─ assets/map/               GENERATED offline world map: polygons, places, labels, glyph PBFs (docs/MAP.md)
├─ assets/fonts/             OpenDyslexic (OFL)
├─ AGENTS.md                 Expo tooling notes for coding agents
├─ .env.example              EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY
├─ content/
│  ├─ countries/source/      hand-authored clues, facts, greetings per continent (see docs/CONTENT.md)
│  ├─ countries/dist/        GENERATED countries.json + review.csv
│  ├─ flags/                 GENERATED 195 SVG flags (flag-icons, MIT)
│  ├─ natural-earth/         reduced Natural Earth extract (public domain)
│  ├─ standards/             National Geography Standards catalogue + skill mapping
│  └─ samples/               sample mission used by tests and docs
├─ docs/                     architecture, story bible, sample play, (step 9) privacy + a11y audits
├─ scripts/
│  ├─ db-test.sh             runs each SQL suite in its own scratch Postgres database
│  ├─ build-map-data.ts      Natural Earth → bundled map data + glyphs (npm run map:build)
│  ├─ map-preview.ts         browser preview of the exact app map style
│  ├─ build-countries.ts     validates content and generates seed.sql (npm run content:build)
│  └─ extract-natural-earth.py
├─ src/
│  ├─ app/                   Expo Router routes only
│  │  ├─ _layout.tsx
│  │  ├─ index.tsx
│  │  ├─ (student)/          hq, map, case/[id], review, spelling, play/[room]
│  │  └─ (teacher)/          dashboard, class/[id], assign, export
│  ├─ features/              one folder per MVP feature (logic + components + hooks)
│  │  ├─ map/  missions/  rewards/  review/  spelling/  multiplayer/  teacher/
│  ├─ content/               Zod content contract + loaders
│  ├─ offline/               SQLite store, region-pack downloader, sync outbox
│  ├─ a11y/                  preferences (font, read-aloud, timers, text scale)
│  ├─ i18n/                  en.json, es.json
│  ├─ lib/                   Supabase client (shared-device aware)
│  ├─ theme/                 Okabe–Ito colourblind-safe tokens, fonts, touch targets
│  └─ types/
└─ supabase/
   ├─ config.toml            sign-up disabled; `app` schema not exposed
   ├─ migrations/            0001 identity → 0005 RLS → 0006 step-1 decisions → 0007 optional pack tiles
   ├─ seed.sql               GENERATED: 18 NGS standards + 195 country documents
   ├─ functions/             create-students, student-sign-in, roster-sync, sync-events
   └─ tests/                 stub + helpers, 10_rls.sql (78 assertions), 20_seed.sql (18)
```

## Data model

```
schools ─┬─ profiles (role: student | teacher | school_admin, app-generated username)
         │     ├─ student_roster_labels   teacher-only "Maya R." label
         │     └─ roster_identities       Clever / ClassLink / Google / Microsoft ids (service-only)
         ├─ classes ─┬─ class_teachers
         │           ├─ class_students
         │           ├─ assignments ──► content_items(id, version)
         │           └─ spelling_brackets ─ bracket_matches
         ├─ play_groups (teacher-approved, same school) ─ play_group_members
         ├─ deletion_requests (PII-free receipts)   audit_events (exports, deletions, roster syncs)
         │
standards (NGS / TEKS) ◄── content_items(id, version, kind, grade_bands[], standard_ids[], data jsonb)
                              content_current (view)  region_packs (offline manifests)  preset_messages

student evidence (client-written):  mission_attempts, answer_events
derived (server-written only):      points_ledger → student_points, student_rewards, review_cards, mastery
multiplayer:                        match_rooms (class XOR group) ─ match_players ─ match_messages(preset id)
```

### Trust boundaries

1. **Students write evidence only.** That means `mission_attempts` and `answer_events`, with
   client-generated UUIDs so a shared iPad can replay its offline outbox safely.
2. **The server derives everything that counts.** Points, badges, stamps, avatar unlocks,
   review schedules and mastery are computed in Postgres functions (steps 4–5). Clients have no
   INSERT/UPDATE grant on those tables, so the restriction holds at the privilege level, not only through RLS.
3. **Roles cannot be self-assigned.** Auth sign-up is disabled, and profiles are created by edge functions
   running as `service_role`. `profiles.role` and `school_id` have no client UPDATE grant.
4. **Realtime is receive-only.** Clients may subscribe to `room:<id>` / `class:<id>` private
   channels they're authorised for, but have no INSERT policy on `realtime.messages`. That
   blocks free-form broadcast and presence payloads, which would otherwise be a free-text side channel.
   Fan-out happens in triggers via `realtime.send()`.
5. **No free text between kids.** `match_messages` has a `preset_message_id` and no body column.
   Messages are rate limited to 1 per 2 seconds.

### RLS summary

| Table | Student | Teacher | School admin |
|---|---|---|---|
| profiles | self + school staff | own students + school staff | whole school |
| peer_profiles() | classmates/group-mates: username + avatar | own students | school |
| student_roster_labels | none | own students | school |
| classes / class_students | classes they're in | classes they teach | school |
| answer_events, attempts | own (insert + read) | read own students | read school |
| points, rewards, review, mastery | read own | read own students | read school |
| match_* | rooms of own class / approved group | supervise own classes/groups | school |
| content_items | published | published + retired | published + retired |
| audit_events | none | none | school |
| roster_identities | none | none | none (service only) |

Cross-school access is impossible for every role: all membership triggers assert the same `school_id`.

## Running

```bash
cp .env.example .env.local      # fill in your Supabase project
npm install
npm run lint && npm run typecheck && npm test   # ESLint, TS, Jest (content, map, screens, offline)
npm run db:test                 # needs psql + local Postgres 15+ (PG* env vars)
npx expo start                  # MapLibre needs a dev build: npx expo run:ios | run:android
```
