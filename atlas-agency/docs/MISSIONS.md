# Mission engine (Step 4)

## Case library

`npm run missions:build` (run it after `content:build`) generates **120 cases**: one per stolen landmark (40 landmarks) for each grade band. A hand-written sample case brings the total to 121. Each case is a versioned `mission:*` content item tagged with its grade band and National Geography Standards. Cases are bundled into the app for offline play, and the same files are seeded into Supabase (`supabase/seed_missions.sql`). Generation is **deterministic**: a case id always produces the same case, so an assigned case is identical for every student.

| | K-2 | 3-5 | 6-8 |
|---|---|---|---|
| Stops | 3 | 4 | 5 |
| Choices per stop | 2 | 3 | 4 |
| Clues | Concrete only (flag, animal) | Difficulty 1–2 | Difficulty 2–3 (landmark, food, language, money) |
| Countries | ~40 familiar | Familiar + 100 largest | All 195 |
| Wrong choices from | Other continents | One neighbour + others | The same continent |
| Travel clue | none | "The thief flew west." | "The thief flew about 6,000 miles west." |
| Hint reveals | Continent | Continent | Capital (subregion if the capital shares the country's name) |
| Suspects / dossier clues | 2 / 1 | 3 / 2 | 4 / 2 |
| Points: stop / hint / case | 10 / −2 / 30 | 10 / −5 / 50 | 15 / −5 / 75 |
| Timer per stop | none | none | 120 s |

The build fails if any of these is broken:
- Every clue must exist and every route must avoid revisits.
- The right answer must always be one of the choices, and choices can't repeat.
- No hint may name the answer.
- Every dossier trait must belong to the culprit only.
- Every country must stay inside the band's country pool.

## Playing a case

`src/features/missions/engine.ts` is a pure reducer, and the screens only render its state. The flow is briefing → stops → flight → warrant → solved.

- **Wrong picks** are removed from the choices. The stop then earns half points, and the case can always be finished.
- **Hints** (🧭 Gizmo) cost points once per stop. A hint is also available at the warrant.
- **Timers** can be adjusted three ways (mission default × student preference 1×, 1.5×, 2× or off × assignment). Running out of time **never fails** the student: the hint appears for free.
- **Warrant:** a wrong suspect "has an alibi" and is removed, with no penalty.
- **Read-aloud** reads each screen, automatically when that preference is on. All text is in English and Spanish, and Spanish never uses a gendered word for the thief.

## Evidence, offline and the teacher's live feed

- **Grading on the device (D3):** each stop produces an `answer_events` row and each step updates a `mission_attempts` row.
- **Queue and upload:** rows go to a SQLite **outbox** first, then upload when online. Uploads are idempotent, so re-sending is safe, and attempts go up before answers.
- **Teacher feed:** the existing trigger broadcasts each answer to the class's teachers.
- **Shared devices:** every outbox row is stamped with the student who earned it, and only the signed-in student's rows upload. Before sign-in exists (steps 7–8), evidence stays on the device under `local`.
- **Points:** the solved screen shows the case's points. The authoritative points ledger, badges and review queue are derived on the server from these events in **step 5**.

## Verified

- **App tests:** all 121 cases play to completion. Each band's rules hold. Wrong-pick, hint, timeout and warrant scoring are correct. Travel directions are checked (including across the 180° line), and the outbox uploads per student.
- **Database tests** (`30_seed_mission_play.sql`): the engine's exact row shapes are accepted under a student's RLS, re-sync is a no-op, students cannot set points, and the teacher feed fires.
