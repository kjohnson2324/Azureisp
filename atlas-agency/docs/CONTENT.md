# Country content (Step 2)

All 195 countries (193 UN member states plus the two UN observer states, the Holy See and
Palestine) ship as version 1 of `country:<ISO2>` documents in `public.content_items`.

| Per country | Source |
|---|---|
| English and Spanish country name | Unicode CLDR via Node `Intl.DisplayNames`, with a few kid-friendly overrides |
| Capital (en/es), alternates, notes on shared or disputed capitals | Hand-authored |
| Capital coordinates, region, subregion, map label point | Natural Earth 10m (public domain) |
| Flag SVG | `flag-icons` 7.6.0 (MIT), copied to `content/flags/` |
| Flag description (also the flag's alt text) | Hand-authored |
| Languages, currency name | CLDR names from ISO codes, with explicit names where CLDR is missing or unclear |
| Greeting text + on-device TTS voice | Hand-authored (D6: on-device text-to-speech) |
| 2 facts | Hand-authored, chosen to stay true over time (no population counts or current leaders) |
| 5 clues: flag + 4 of landmark, food, animal, language, currency | Hand-authored; the flag clue is generated from the flag description |

## Build

```bash
npm run content:check   # validate only
npm run content:build   # writes content/countries/dist/*, content/flags/*.svg, supabase/seed.sql
```

The build fails if any of these rules is broken:

- Each country gets exactly 5 clues, one per skill, and each clue matches the Zod contract in `src/content/schemas.ts`.
- No clue contains the country's English or Spanish name, or a distinctive word from it. (This caught "Kinyarwanda" giving away Rwanda.)
- English clues start with "The thief". Spanish clues drop the subject and never use *ladrón/ladrona*, so gender never reveals the culprit.
- Clues have a length limit for young readers.
- Every capital has coordinates, either matched by name to a Natural Earth capital point or set explicitly with a comment.
- There are exactly 195 countries with no duplicates, and each one is listed under the continent Natural Earth gives it.

## Difficulty and grade bands

Defaults by skill are flag 1, animal 1, landmark 2, food 2, language 2 and currency 3, where 1 = K-2, 2 = 3-5 and 3 = 6-8.
Every country has at least two difficulty-1 clues, so K-2 missions can visit any country.

## Standards

The 18 National Geography Standards are seeded and every clue carries NGS tags by skill
(`content/standards/ngs.ts`). **TEKS tags are pending (D5):** they will be mapped from the
official TEKS once `teksguide.org` is reachable from this environment. No TEKS codes have been guessed.

## Review before classroom use

The clues and facts were written by hand from general knowledge. They passed automated checks,
but a person has not yet checked them for factual accuracy. `content/countries/dist/review.csv`
lists all 975 clues and 390 facts in English and Spanish, one per row, for an educator or
fact-checker to work through. Corrections go into `content/countries/source/*.ts`. A corrected
country becomes version 2, because published versions are immutable.

## Third-party notices

- **Natural Earth**: public domain. https://www.naturalearthdata.com
- **flag-icons**: MIT License, © 2013 Panayiotis Lipiridis. See `content/flags/LICENSE`.
- **Unicode CLDR**: country, language and currency names. Unicode License v3, © 1991-2025 Unicode, Inc. https://www.unicode.org/license.txt
