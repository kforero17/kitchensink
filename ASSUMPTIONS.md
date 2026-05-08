# Assumptions — Clean Recipe Tags

Living doc. Planning-phase assumptions start here; append as implementation sub-agents surface more.

## Planning-phase

1. **`allrecipes_firestore.json` is the canonical corpus dump.** Tasty data is structured at scrape time and less polluted; this PR does not retroactively backfill Tasty recipes, only guards them at write time.
2. **Heuristic filtering is preferable to strict allowlisting.** A strict allowlist would drop legitimate but uncatalogued tags. Heuristics + an ingredient-noun denylist + a positive-signal category vocabulary preserves unknowns while killing obvious pollution.
3. **Tag schema stays flat (`string[]`).** Splitting into structured categories (`{ cuisine, mealType, dietary }`) is out of scope; would touch every reader and is a separate refactor.
4. **The simulation harness (`KitchenSinkNew/simulation`) is the integration validator.** Loads the corpus, exercises every tag-based filter. Post-fix invariants and signal distributions are the success metric.
5. **Tag normalization (lowercase + trim + dedupe) folds into `cleanTags`.** The existing `normalizeTags` in `dietaryFilter.ts` is replaced by a shared sanitizer, eliminating drift between dietary filtering and other tag consumers.
6. **Cleaned JSON ships separately from the in-place file.** Script writes `allrecipes_firestore.cleaned.json` rather than mutating the original — preserves a re-runnable source of truth and lets reviewers diff the result.
7. **Dry-run by default for Firestore writes.** The cleanup script does not touch Firestore unless `--apply-firestore` is passed, mirroring the safety pattern of one-time data migrations.

## Implementation-phase

8. **Rule 3 threshold is "4+ words drops" (`words.length > 3`).** This lets `'garlic shrimp american'` survive rule 3 so rule 6's allowlist override is what saves it, matching the spec's narrative.
9. **Measurement-token matching uses plain substring `String.includes`.** Catches both single-word (`tablespoon` inside `tablespoons`) and multi-word (`lightly salted`, `room temperature`) tokens. Spec allowed either word-boundary or substring for single-word entries.
10. **Ingredient nouns matched with `\b<noun>\b` regex word boundaries.** Prevents `'onion'` from misfiring inside `'onions'` etc. The corollary cases (`'onions for garnish'`, `'chopped onions'`) are dropped via rules 4 and 5 respectively.
11. **JS↔TS interop chose option (a): `ts-node/register/transpile-only` in `firestore-uploader.js`.** `ts-node` is a confirmed devDependency in `KitchenSinkNew/package.json`. Keeps `tagSanitizer.ts` as a single source of truth (no JS port, no `dist/` build step).
12. **Backfill script adds a `clean:tags` npm script.** Uses `tsx` (already in devDependencies) for execution: `tsx scripts/clean-corpus-tags.ts`.
13. **Backfill script Firestore mode auto-detects emulator vs production.** `FIRESTORE_EMULATOR_HOST` env var → emulator (no creds); otherwise `admin.credential.applicationDefault()` (requires `GOOGLE_APPLICATION_CREDENTIALS`).
14. **Backfill batches Firestore updates at 400/batch.** Firestore caps at 500; 100-write headroom.
15. **Backfill uses `batch.update(ref, { tags })` — only the `tags` field is touched on production docs.** No risk of clobbering unrelated fields.
16. **Importer applies the sanitizer via spread-copy:** `const cleaned = { ...recipe, tags: cleanTags(recipe.tags) }` then `batch.set(ref, cleaned)`. Single mutation point, doesn't refactor surrounding logic.
