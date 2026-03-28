# Smart Grocery List — Implementation Spec

## Problem Statement
The grocery list includes everything from recipes without considering what the user already has. Users buy duplicates, waste money, and clutter their list. We need the grocery list to subtract pantry items, consolidate quantities, and group by store aisle so it only shows what's actually needed.

## Current State
- GroceryListScreen already consolidates duplicate ingredients and converts units
- Categorization exists (8 categories with keyword matching)
- ingredientMatching.ts has `normalizeIngredientName()` and `ingredientsMatch()` (similarity ≥ 0.8)
- pantryService has `getPantryItems()` returning items with name, quantity, unit, category
- GroceryListScreen does NOT reference pantry at all
- No aisle/section ordering exists

## Approach

### Change 1: Create smartGroceryList utility
**New file:** `src/utils/smartGroceryList.ts`

Core logic extracted into a pure utility (testable, no React dependencies):

```typescript
interface SmartGroceryItem {
  name: string;
  measurement: string;
  category: string;
  aisle: number;          // sort order for store layout
  recipeIds: string[];    // which recipes need this
  recipeNames: string[];
  recommendedPackage: string;
  inPantry: boolean;      // true if fully covered by pantry
  pantryNote?: string;    // e.g., "Have 1 cup, need 2 cups"
}

function buildSmartGroceryList(
  recipeIngredients: GroceryItem[],
  pantryItems: PantryItem[],
): SmartGroceryItem[]
```

Steps inside:
1. **Consolidate** — group recipe ingredients by normalized name, sum quantities within compatible unit groups (reuse existing unit conversion logic from GroceryListScreen)
2. **Subtract pantry** — for each consolidated item, find matching pantry items using `ingredientsMatch()`. If pantry has enough quantity in a compatible unit, mark `inPantry: true`. If partial, adjust measurement and add `pantryNote`.
3. **Assign aisle** — map category to aisle number for store-layout sorting
4. **Sort** — by aisle number, then alphabetically within aisle

### Change 2: Aisle mapping
**In same file:** `src/utils/smartGroceryList.ts`

```typescript
const AISLE_ORDER: Record<string, number> = {
  'Produce': 1,
  'Meat & Seafood': 2,
  'Dairy & Eggs': 3,
  'Frozen': 4,
  'Grains & Bakery': 5,
  'Pantry': 6,
  'Beverages': 7,
  'Snacks & Sweets': 8,
  'Other': 9,
};
```

### Change 3: Integrate into GroceryListScreen
**File:** `src/screens/GroceryListScreen.tsx`
- Import `buildSmartGroceryList` and `SmartGroceryItem`
- After existing ingredient consolidation logic, call `buildSmartGroceryList()` with consolidated ingredients + pantry items
- Fetch pantry items using `getPantryItems(user.uid)` (already have auth context)
- Replace flat list rendering with aisle-grouped sections
- Items fully in pantry shown dimmed with "Already have" badge (or filtered out entirely)
- Items partially in pantry show a note like "Have 2, need 1 more"
- Add aisle section headers in the UI

### Change 4: Improve ingredient normalization
**File:** `src/utils/ingredientMatching.ts`
- Expand `INGREDIENT_VARIATIONS` map with more common variations needed for pantry-grocery matching:
  - "ground beef" → "beef", "chicken breast" → "chicken", "cheddar cheese" → "cheese"
  - "green onion" / "scallion" → "green onion"
  - "bell pepper" / "green pepper" / "red pepper" → "pepper"
  - Common plurals not yet covered

### Change 5: Analytics
**File:** `src/services/analyticsService.ts`
- Add `logSmartGroceryListGenerated(params: { totalItems: number; removedByPantry: number; aisleCount: number })`

## Files to Modify (in order)
1. `src/utils/ingredientMatching.ts` — expand variation dictionary
2. `src/utils/smartGroceryList.ts` — **NEW** — core smart list logic
3. `src/screens/GroceryListScreen.tsx` — integrate smart list + aisle UI
4. `src/services/analyticsService.ts` — add analytics event
5. `src/tests/smartGroceryList.test.ts` — **NEW** — unit tests

## Design Decisions
- Expired pantry items (status='expired') are excluded from subtraction
- Partial quantities: if pantry has 1 cup and recipe needs 3 cups, grocery shows "2 cups (have 1 cup)"
- Items fully covered by pantry are shown dimmed (not hidden) so user can verify
- Use existing `ingredientsMatch()` (Jaccard ≥ 0.8) for pantry matching rather than substring — more resilient
- Aisle ordering follows typical US grocery store layout (produce first, pantry staples later)
- The consolidation logic already in GroceryListScreen (parseMeasurement, standardizeQuantity, etc.) should be reused, not duplicated

## Risks
- Unit mismatch between pantry and grocery items (pantry stores "units" vs grocery "cups") — mitigate by only subtracting when units are in the same group
- False positive ingredient matches (e.g., "pepper" matching "bell pepper" AND "black pepper") — acceptable for MVP, can refine later
