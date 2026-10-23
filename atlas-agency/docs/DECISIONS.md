# Decision log

| # | Date | Decision | Where it lives |
|---|---|---|---|
| D1 | 2026-10-23 | Atlas Agency lives in its own repository (`atlas-agency`). | Repo move pending the new repo being created |
| D2 | 2026-10-23 | Student sign-in on shared devices: **class code → tap your agent name → secret picture**. Teachers create student accounts (school acts as the COPPA consent agent). Rostering SSO is added alongside, not instead. | `classes.sign_in_code`, `supabase/functions/student-sign-in` (step 7/8) |
| D3 | 2026-10-23 | **Answers are graded on the device** (works offline). Teachers see results **in real time** as each answer syncs. | `answer_events` (client-written) + `app.broadcast_answer_to_classes()` → private topic `class:<id>`, teacher-only (migration 0006) |
| D4 | 2026-10-23 | Avatar items and badges **unlock at milestones** in the game. Points are never spent and nothing can be bought. | No spend reason exists in `points_reason`; unlock rules live in `avatar_item` / `badge` content (step 5) |
| D5 | 2026-10-23 | TEKS tags follow the official TEKS as presented at https://teksguide.org/teks-guide. | Pending network access to teksguide.org; no TEKS codes are invented in the meantime |
| D6 | 2026-10-23 | Audio greetings and read-aloud use **on-device text-to-speech** (`expo-speech`). No recorded clips, no cloud TTS. | `country.greeting.ttsLang` |
| D7 | 2026-10-23 | **Cross-class play groups need the second teacher's approval.** A teacher can only add their own students; a student from another class joins only when their teacher adds them. | `group_members_insert` policy (migration 0006) |
| D8 | 2026-10-23 | Default retention: **365 days** of inactivity, configurable per school (30–1,095). | `schools.retention_days`, `app.purge_inactive_students()` |
| D9 | 2026-10-23 | The country list is the 193 UN member states plus the two UN observer states (Holy See, Palestine). Shared or disputed capitals carry a neutral `capital.note`, and alternates are accepted as answers. | `content/countries/source/*.ts` |
| D10 | 2026-10-23 | *(Proposed)* The map uses the **seven-continent model** taught in U.S. K-8 classrooms. North and South America are split by UN subregion, with Central America and the Caribbean in North America. Antarctica is a labelled continent with no countries. | `src/features/map/continents.ts` |
| D11 | 2026-10-23 | *(Proposed)* The whole-world base map is **bundled** (Natural Earth). Detail tiles come only from a **self-hosted** tile source, never a third-party tile host. | `docs/MAP.md`, migration 0007 |
| D12 | 2026-10-23 | *(Proposed)* Land outside the 195 (e.g. Greenland, Taiwan, Kosovo, Western Sahara, overseas territories) is drawn as **neutral, unlabeled, non-tappable** land. | `scripts/build-map-data.ts` |
| D13 | 2026-10-23 | Country photos will come from public-domain or Creative Commons sources (approved 2026-10-23). The card shows a placeholder until they are added. | `country.photo` (optional) |
| D14 | 2026-10-23 | **Distance tool** with a school-to-home comparison, measured in round trips (requested 2026-10-23). *(Proposed details)* The school distance is a rough value from a fixed list, never an address or GPS. It is device-only and never synced. Both units are always shown. | `src/features/map/distance.ts`, `MeasurePanel.tsx`, `a11y/preferences.ts` |
