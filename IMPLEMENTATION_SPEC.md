# Implementation Spec: Clean Recipe Tags

## Problem Statement

The recipe corpus stored at `KitchenSinkNew/allrecipes_firestore.json` (~19K recipes) and mirrored into Firestore has tag pollution: ingredient phrases scraped from Allrecipes leaked into the `tags: string[]` field alongside legitimate tags.

Concrete example from the corpus — "Roasted Garlic Butter":
```
['american', 'bulb garlic', 'dinner', 'lightly salted whipped butter',
 'olive oil to drizzle over garlic', 'vegetarian']
```
Three of those six entries are ingredient phrases, not tags.

This contaminates every tag-driven filter and ranker:
- Dietary hard-veto (`src/utils/dietaryFilter.ts`, recently merged in `28d8b01`).
- Seasonal tag prior (`src/ranking/seasonalSignal.ts`, open PR #12 `b62927f`).
- Cuisine and meal-type lookups (`src/data/recipeDatabase.ts`).
- Feature engineering (`src/ranking/featureEngineering.ts`).

Cleaning the tag set is a prerequisite for any of these filters to behave correctly.

## Goals

1. **Backfill** — cleanse tags in the existing corpus (JSON file + Firestore `recipes` collection) so all consumers see a clean index immediately.
2. **Guard** — apply the same cleansing at every write path so new scrapes cannot reintroduce pollution.
3. **Reuse** — one sanitizer module, used by scrapers, the bulk importer, and the dietary normalizer (DRY).

Out of scope: splitting tags into structured categories (`{ cuisine, mealType, dietary }`); inferring missing tags from name/ingredients; retroactively backfilling Tasty corpus (the Tasty pipeline produces tags via `generateRecipeTags()` from structured fields, not free-text scraping — addressed defensively by the shared guard but not retroactively).

## Approach

**Two-pronged fix.** A shared sanitizer module is the single source of truth. A one-time backfill script rewrites the corpus. A handful of write-path call sites adopt the sanitizer. The dietary filter's existing `normalizeTags()` delegates to the sanitizer.

### Detecting ingredient-phrase pollution

Hybrid: structural heuristics drop obvious ingredient phrases; everything else is preserved (we don't enforce a strict allowlist because that would drop legitimate but uncatalogued tags).

A tag is dropped if **any** of these is true:
1. Contains a comma (`,`) — real tags do not have commas.
2. Length exceeds 25 characters — real tags are short ("comfort food", "gluten-free", "low-carb").
3. Has 4 or more whitespace-separated words.
4. Contains a preposition phrase: ` to `, ` for `, ` with `, ` of `, ` over `, ` from `, ` in ` (post-trim, lowercased, padded with spaces).
5. Contains a measurement / preparation token: `teaspoon`, `tablespoon`, `tbsp`, `tsp`, `cup`, `ounce`, `oz`, `gram`, `lb`, `pound`, `drizzle`, `chopped`, `grated`, `sliced`, `diced`, `minced`, `peeled`, `melted`, `softened`, `whipped`, `room temperature`, `unsalted`, `lightly salted`.
6. Contains an ingredient-root noun (`garlic`, `butter`, `oil`, `sugar`, `flour`, `egg`, `milk`, `salt`, `pepper`, `onion`, `tomato`, `cheese`, `chicken`, `beef`, `pork`, `fish`, `shrimp`, `bread`, `rice`, `pasta`) AND no token from `KNOWN_TAG_VOCABULARY` (the positive-signal allowlist below).

Validated against the user's example:
- `'american'` ✓ keep (rule 6 sees no ingredient noun).
- `'bulb garlic'` ✗ drop (rule 6 — `garlic` is an ingredient noun, no allowlist token).
- `'dinner'` ✓ keep.
- `'lightly salted whipped butter'` ✗ drop (rule 5 — `lightly salted`, `whipped`).
- `'olive oil to drizzle over garlic'` ✗ drop (rule 3 — 6 words; rule 4 — ` to `, ` over `; rule 5 — `drizzle`).
- `'vegetarian'` ✓ keep.

### Canonical vocabulary (`KNOWN_TAG_VOCABULARY`)

Built from existing code references plus light corpus inspection:

- **Dietary:** `vegan`, `vegetarian`, `gluten-free`, `dairy-free`, `nut-free`, `low-carb`, `keto`, `paleo`, `pescatarian`, `kosher`, `halal`.
- **Meal type:** `breakfast`, `lunch`, `dinner`, `snacks`, `snack`, `dessert`, `appetizer`, `side dish`, `main course`, `brunch`.
- **Cuisine:** `american`, `italian`, `mexican`, `asian`, `chinese`, `japanese`, `thai`, `indian`, `french`, `mediterranean`, `greek`, `middle eastern`, `southern`, `tex-mex`, `cajun`, `korean`, `vietnamese`, `spanish`, `german`, `british`.
- **Cooking style/method:** `baked`, `grilled`, `fried`, `roasted`, `slow cooker`, `instant pot`, `air fryer`, `one pot`, `no cook`, `make ahead`.
- **Dish character:** `comfort food`, `healthy`, `quick`, `easy`, `kid friendly`, `holiday`, `summer`, `winter`, `spring`, `fall`.

The sanitizer does **not** require tags to match this vocab; it uses it only as a positive signal that overrides rule 6.

### Algorithm (single function)

```ts
export function cleanTags(raw: readonly string[] | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of raw) {
    const norm = t.trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;
    if (isLikelyIngredientPhrase(norm)) continue;
    seen.add(norm);
    result.push(norm);
  }
  return result;
}
```

Same function handles trim + lowercase + dedupe + filter, replacing `dietaryFilter.normalizeTags`.

## Files to Create

1. **`KitchenSinkNew/src/utils/tagSanitizer.ts`**
   - Exports: `cleanTags`, `isLikelyIngredientPhrase`, `KNOWN_TAG_VOCABULARY`, `INGREDIENT_NOUN_DENYLIST`, `MEASUREMENT_TOKENS`.
   - Single source of truth. No dependencies beyond stdlib strings.
2. **`KitchenSinkNew/src/utils/__tests__/tagSanitizer.test.ts`**
   - Given/When/Then style.
   - Cases: the "Roasted Garlic Butter" example end-to-end; per-rule positive/negative; null/undefined input; case-insensitive dedupe; preserves order.
3. **`KitchenSinkNew/scripts/clean-corpus-tags.ts`**
   - Reads `KitchenSinkNew/allrecipes_firestore.json`, applies `cleanTags`, writes `KitchenSinkNew/allrecipes_firestore.cleaned.json`.
   - Emits a report to stdout: total tags before/after, top 100 dropped tags by frequency, recipes whose tag count fell below 2 (for manual review).
   - Has a `--apply-firestore` flag that batch-updates the Firestore `recipes` collection (uses existing Firestore admin pattern from `simulation/seed-data/import-recipes.ts`).
   - Default is dry-run safe: only writes the `.cleaned.json` and the report; does not touch Firestore unless flagged.

## Files to Modify

1. **`KitchenSinkNew/src/utils/dietaryFilter.ts`** (line 54)
   - Replace inline `normalizeTags` with `import { cleanTags } from './tagSanitizer'`. Either rename `normalizeTags` to delegate, or remove it and update its 1-2 callers in this file. DRY win.
2. **`KitchenSinkNew/scripts/tasty-scraper/firestore-uploader.js`** (around line 22)
   - After `tags = generateRecipeTags(scrapedRecipe)`, run through `cleanTags`. JS file consumes TS via build output if needed; resolution flagged in `QUESTIONS.md`.
3. **`KitchenSinkNew/simulation/seed-data/import-recipes.ts`** (lines 11–25)
   - Defensively apply `cleanTags` per recipe during import. Belt-and-suspenders: even if the cleaned JSON is the input, this guarantees no polluted recipe ever lands in the simulation Firestore.

Note: after the backfill script runs and the `.cleaned.json` is the canonical corpus, the importer's defensive cleaning is a no-op for that source — but it remains correct insurance.

## Test Strategy

- **Unit:** `tagSanitizer.test.ts` covers each rule and the canonical example.
- **Regression:** add one fixture-based test in `dietaryFilter.test.ts` proving a polluted recipe still filters identically once tags are cleaned (i.e., dietary signal survives).
- **End-to-end via simulation:** run the existing simulation harness (`KitchenSinkNew/simulation`) against the cleaned corpus. `DietaryInvariant` should remain at zero violations (post-`28d8b01`); seasonal signal distribution should sharpen. Report deltas in the PR body.

No mocking of Firestore data models. Real arrays of strings as test inputs.

## Implementation Order

1. Create `tagSanitizer.ts` with vocab tables, `isLikelyIngredientPhrase`, `cleanTags`.
2. Write `tagSanitizer.test.ts`. Iterate rules until the canonical example and ~20 hand-picked corpus pollutants drop while known-good tags survive.
3. Wire `dietaryFilter.ts` to use the sanitizer (delete or shrink `normalizeTags`).
4. Wire `simulation/seed-data/import-recipes.ts` and `scripts/tasty-scraper/firestore-uploader.js`.
5. Write `scripts/clean-corpus-tags.ts`. Run dry-run, eyeball the dropped-tag report.
6. Commit cleaned JSON (or document the regeneration step in the PR — see QUESTIONS).
7. Run `npm test` (jest) and the simulation; capture deltas.

## Risks

- **Over-aggressive heuristics drop legitimate tags.** Mitigation: dry-run report lists every dropped tag with frequencies before the user opts in to the Firestore write.
- **Recipes with all-polluted tags end up empty.** Mitigation: report flags recipes whose tag count drops below 2 for manual inspection. Out-of-scope to backfill them; flag for follow-up.
- **JS/TS interop in scrapers.** The Tasty scraper is plain JS. Worst case we duplicate the small denylist constants there; better case we run via `ts-node`. See QUESTIONS.
- **Cleaned JSON in git.** `allrecipes_firestore.cleaned.json` is large. Consider gitignoring it and making the cleanup script reproducible from the original. See QUESTIONS.
