# Sample play-through: "The Case of the Vanishing Tower"

Source data: `content/samples/mission.vanishing-tower.json` (grade band 3–5, NGS 1 · 4 · 10).
Player: **Agent BraveOtter42**, Room 12 Geography, read-aloud ON, untimed.

```
╔══════════════════════════════════════════════════════════════════╗
║  ATLAS AGENCY · CASE FILE #014          Grade band 3–5   ★ 1,240  ║
╚══════════════════════════════════════════════════════════════════╝

🦉 CHIEF WREN
   "Agent BraveOtter42, the Eiffel Tower has vanished from Paris
    overnight! A Magpie Ring calling card was left behind. Follow the
    clues, track the thief, and bring the tower home."           🔊

   Suspects:  Velvet Vex · Professor Pocket · Lady Lumen · Sticky Fitz

──────────────────────────────────────────────────────────────────
 STOP 1 of 4 · 📍 PARIS, FRANCE (crime scene)
──────────────────────────────────────────────────────────────────
 🔍 Clue (currency): "The thief swapped euros for pounds, but not
                      British ones."                              🔊
 🔍 Clue (landmark): "The thief asked how to reach the pyramids at
                      Giza."                                       🔊

 Where did the thief go next?
   [ 🇪🇬 Egypt ]   [ 🇲🇽 Mexico ]   [ 🇮🇳 India ]

 > Egypt                                     ✅ Correct!   +10 ★
   🛂 Map flies to Cairo · "Ahlan!" (Hello!)                     🔊

──────────────────────────────────────────────────────────────────
 STOP 2 of 4 · 📍 CAIRO, EGYPT
──────────────────────────────────────────────────────────────────
 🔍 Clue (language): "The thief practiced saying 'Obrigado', which is
                      Portuguese for thank you."
 🔍 Clue (flag):     "A green field, a yellow diamond, and a blue
                      globe full of stars."

 Where did the thief go next?
   [ 🇵🇹 Portugal ]   [ 🇧🇷 Brazil ]   [ 🇦🇷 Argentina ]

 > Portugal                                  ❌ Not quite. The trail
                                                went cold here.
   🧭 GIZMO (hint, −5 ★): "Portuguese is spoken on two continents.
                            Which one has a green and yellow flag?"
 > Brazil                                    ✅ Correct!   +10 ★
   📒 Memory Vault: "flag:BR" and "language:BR" queued for review
      (missed once, so they come back tomorrow)

──────────────────────────────────────────────────────────────────
 STOP 3 of 4 · 📍 BRASÍLIA, BRAZIL
──────────────────────────────────────────────────────────────────
 🔍 Clue (currency): "The thief needed yen for the next trip."
 🔍 Clue (food):     "The thief was craving onigiri, rice balls
                      wrapped in seaweed."

   [ 🇨🇳 China ]   [ 🇰🇷 South Korea ]   [ 🇯🇵 Japan ]

 > Japan                                     ✅ Correct!   +10 ★

──────────────────────────────────────────────────────────────────
 STOP 4 of 4 · 📍 TOKYO, JAPAN · ISSUE THE WARRANT
──────────────────────────────────────────────────────────────────
 🔍 Witness: "The thief hurried past a snow monkey soaking in a
              hot spring."
 🗂  Dossier: "The thief checked a brass pocket watch every five
              minutes." · "The thief wore a coat with far too many
              pockets."

 Who is the thief?
   [ Velvet Vex ] [ Professor Pocket ] [ Lady Lumen ] [ Sticky Fitz ]

 > Professor Pocket                          ✅ CASE SOLVED!  +50 ★

╔══════════════════════════════════════════════════════════════════╗
║  🗼 The Eiffel Tower is back in Paris!                            ║
║                                                                  ║
║  Clues solved   3 × 10 ★ ........................... +30         ║
║  Hint used      1 ×  5 ★ ...........................  −5         ║
║  Case solved    .................................... +50         ║
║  ──────────────────────────────────────────────────────          ║
║  Earned this case ...................................  75 ★       ║
║  Total ............................................ 1,315 ★       ║
║                                                                  ║
║  🛂 New passport stamp: FRANCE                                    ║
║  🏅 Badge unlocked: "Globe Trotter" (4 continents in one case)    ║
║  📒 2 items added to your Memory Vault for tomorrow               ║
╚══════════════════════════════════════════════════════════════════╝

 Professor Pocket: "Oh, bother. I was only going to borrow it until
                   Tuesday!"  (helps carry the tower home)

 [ ▶ Next case ]   [ 📒 Review now ]   [ 🗺 Explore Japan ]
```

## What the teacher sees afterwards (dashboard row)

| Student | Case | Stops right first try | Hints | Weakest skill | Review queue |
|---|---|---|---|---|---|
| Maya R. (BraveOtter42) | Vanishing Tower | 3 / 4 | 1 | Flags: South America | flag:BR, language:BR |

## What was written to the database

```jsonc
// answer_events (student-written, client UUIDs, synced from the offline outbox)
{ "context": "mission", "item_id": "question:dest-EG", "skill": "currency", "country_code": "EG", "correct": true  }
{ "context": "mission", "item_id": "question:dest-BR", "skill": "flag",     "country_code": "BR", "correct": false }
{ "context": "mission", "item_id": "question:dest-BR", "skill": "flag",     "country_code": "BR", "correct": true, "hint_used": true }
// points_ledger (server-derived; students have no write grant)
{ "reason": "clue_solved", "delta": 10 } ×3   { "reason": "hint_used", "delta": -5 }   { "reason": "mission_solved", "delta": 50 }
// review_cards (server-derived): flag:BR → box 1, due tomorrow
```
