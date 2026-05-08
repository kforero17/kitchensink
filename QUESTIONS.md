# Open Questions — Clean Recipe Tags

Living doc. Questions flagged during planning; append as implementation sub-agents surface more.

## Planning-phase

1. **Should `allrecipes_firestore.cleaned.json` be checked into git?**
   It's likely tens of MB. Options: (a) commit it as the new canonical corpus, (b) `.gitignore` it and document regeneration, (c) replace the original after review. Recommendation: (c) — replace the original in a follow-up commit once the dry-run report is reviewed.
c.

2. **JS ↔ TS in the Tasty scraper.**
   `scripts/tasty-scraper/firestore-uploader.js` is plain JS. Three options for using `cleanTags`:
   (a) run the scraper via `ts-node` against `tagSanitizer.ts`,
   (b) ship a small JS port of the sanitizer (duplication risk),
   (c) build TS → JS into a `dist/` and require it.
   No precedent in this repo as of planning. Defer the decision to implementation; flag here.

3. **Cuisine vocabulary completeness.**
   The `KNOWN_TAG_VOCABULARY` cuisines list is best-guess from the example plus common cuisines. We don't have a corpus-wide histogram of legitimate cuisine tags. Implementation step 5 (dry-run report) will surface any common cuisine that gets dropped — we extend the vocab if so.

4. **Should rule 6 also accept `'garlic shrimp'`-style legitimate dish descriptors?**
   The plan accepts dropping these — they aren't standardized tags and tag-based filters don't depend on them. If review feedback says otherwise, the fix is to add a small dish-descriptor allowlist.
that works

5. **Tasty corpus pollution audit.**
   `generateRecipeTags()` in the Tasty pipeline was not opened during reconnaissance. Implementation should glance at it to confirm it doesn't ingest free-text fields. If it does, rule 6 there too.

   _Resolved during implementation:_ `generateRecipeTags` infers tags from `recipe.title` and `recipe.ingredients` substrings (e.g. `'chicken'`, `'curry'`). Raw ingredient text can flow through. The new `cleanTags` wrapper at the upload site catches any pollution defensively.

## Implementation-phase

6. **Should `--apply-firestore` skip recipes whose cleaned tag count drops below a threshold?**
   Current behavior writes whatever `cleanTags` returns, including `[]`. Risk: a heavily polluted recipe could end up with zero tags in production, becoming invisible to tag-driven rankers. The dry-run report already lists these recipes for manual review. Recommendation: review the report on the full corpus before running `--apply-firestore`; if the count is non-trivial, add a `--min-tags <N>` skip filter in a follow-up.

7. **Should `cleanTags` accept a small "dish descriptor" allowlist for phrases like `'garlic shrimp'`?**
   Carried over from planning question 4. The user annotated "that works" — so dropping these is intentional. Keep as-is.

8. **JS↔TS interop choice for the Tasty scraper resolved to option (a):** `ts-node/register/transpile-only`. `ts-node` is in devDependencies. Smoke test confirms the require chain loads cleanly.
