# Plan: Clean Recipe Tags

See `IMPLEMENTATION_SPEC.md` (canonical). This file mirrors it for PR visibility.

## TL;DR

The corpus has ingredient phrases polluting recipe tags (e.g. `'olive oil to drizzle over garlic'` next to `'american'`, `'dinner'`, `'vegetarian'`). Every tag-based filter (dietary veto, seasonal prior, cuisine lookup) is operating on a contaminated index.

Fix:
1. New `tagSanitizer.ts` — single shared `cleanTags()` using structural heuristics + an ingredient-noun denylist.
2. Backfill script — produces `allrecipes_firestore.cleaned.json` and optionally updates Firestore.
3. Wire the sanitizer into the dietary filter, the simulation importer, and the Tasty scraper so new pollution can't enter.

## Heuristic rules (drop a tag if any apply)

1. Contains a comma.
2. Length > 25 chars.
3. ≥ 4 whitespace words.
4. Contains preposition phrase (` to `, ` for `, ` with `, ` of `, ` over `, ` from `, ` in `).
5. Contains a measurement / prep token (`teaspoon`, `cup`, `drizzle`, `chopped`, `whipped`, `room temperature`, `lightly salted`, …).
6. Contains an ingredient-root noun (`garlic`, `butter`, `oil`, `sugar`, `flour`, `egg`, `milk`, `cheese`, `chicken`, `beef`, …) AND no allowlisted category word.

## Files

- New: `KitchenSinkNew/src/utils/tagSanitizer.ts`
- New: `KitchenSinkNew/src/utils/__tests__/tagSanitizer.test.ts`
- New: `KitchenSinkNew/scripts/clean-corpus-tags.ts`
- Modify: `KitchenSinkNew/src/utils/dietaryFilter.ts`
- Modify: `KitchenSinkNew/scripts/tasty-scraper/firestore-uploader.js`
- Modify: `KitchenSinkNew/simulation/seed-data/import-recipes.ts`

## Validation

- Unit tests in `tagSanitizer.test.ts` — 27 cases covering canonical example, all six rules, normalization, dedupe, null/undefined.
- Existing `dietaryFilter.test.ts` still passes — `cleanTags` is a strict superset of the old `normalizeTags` for all dietary vocab tokens.
- Re-run simulation harness; dietary invariant must remain at zero violations; seasonal signal distribution should sharpen.
- Dry-run report before any Firestore write — top 100 dropped tags reviewed manually.

## Implementation status

All six files done. Sanitizer + 27 unit tests pass. `dietaryFilter.ts` delegates to `cleanTags` (24 tests pass). Importer and Tasty scraper guard tags at write time. Backfill script smoke-tested on a 50-recipe slice — drops obvious pollution (`cream cheese`, `brown sugar`, `baking potatoes, baked`) while preserving real tags. JS↔TS interop in the scraper uses `ts-node/register/transpile-only`.
