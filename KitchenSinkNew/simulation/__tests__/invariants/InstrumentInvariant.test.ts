/**
 * Tests for InstrumentInvariant.
 *
 * Verifies that recipes requiring kitchen instruments the user does not own
 * are flagged as warning-level violations, and that recipes with no detected
 * instruments always pass.
 */

import { InstrumentInvariant } from '../../invariants/InstrumentInvariant';
import { detectInstruments } from '../../invariants/InstrumentInvariant';
import { SimulationProfile } from '../../profiles/types';
import { UnifiedRecipe, KitchenInstrument } from '../../bridge/appImports';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipe(overrides: Partial<UnifiedRecipe> = {}): UnifiedRecipe {
  return {
    id: 'recipe-1',
    source: 'tasty',
    title: 'Test Recipe',
    imageUrl: '',
    readyInMinutes: 30,
    servings: 4,
    ingredients: [],
    tags: [],
    ...overrides,
  };
}

function makeProfile(instruments: KitchenInstrument[] = []): SimulationProfile {
  return {
    id: 'profile-1',
    name: 'Test User',
    uid: 'uid-1',
    preferences: {
      dietary: {
        vegetarian: false,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
        nutFree: false,
        lowCarb: false,
        allergies: [],
        restrictions: [],
      },
      food: {
        favoriteCuisines: [],
        dislikedIngredients: [],
        favoriteIngredients: [],
      } as any,
      cooking: {
        cookingFrequency: 'daily',
        preferredCookingDuration: 'under_30_min',
        skillLevel: 'intermediate',
        mealTypes: ['dinner'],
        servingSizePreference: 4,
        weeklyMealPrepCount: 3,
        householdSize: 2,
        kitchenInstruments: instruments,
      },
      budget: {
        weeklyBudget: 100,
        budgetFrequency: 'weekly',
      } as any,
    },
    engagementTier: 'high',
    startingPantry: [],
    simulationStartDate: '2026-01-01',
    seed: 42,
  };
}

// ---------------------------------------------------------------------------
// Tests: detectInstruments
// ---------------------------------------------------------------------------

describe('detectInstruments', () => {
  it('detects oven from "baked" in title', () => {
    const recipe = makeRecipe({ title: 'Baked Salmon' });
    expect(detectInstruments(recipe)).toContain('oven');
  });

  it('detects oven from "roasted" in title', () => {
    const recipe = makeRecipe({ title: 'Roasted Vegetables' });
    expect(detectInstruments(recipe)).toContain('oven');
  });

  it('detects grill from "grilled" in title', () => {
    const recipe = makeRecipe({ title: 'Grilled Chicken' });
    expect(detectInstruments(recipe)).toContain('grill');
  });

  it('detects grill from "bbq" tag', () => {
    const recipe = makeRecipe({ tags: ['bbq', 'dinner'] });
    expect(detectInstruments(recipe)).toContain('grill');
  });

  it('detects air_fryer from "air fryer" in title', () => {
    const recipe = makeRecipe({ title: 'Air Fryer Chicken Wings' });
    expect(detectInstruments(recipe)).toContain('air_fryer');
  });

  it('detects air_fryer from "air fried" in tags', () => {
    const recipe = makeRecipe({ tags: ['air fried'] });
    expect(detectInstruments(recipe)).toContain('air_fryer');
  });

  it('detects slow_cooker from "slow cooker" in title', () => {
    const recipe = makeRecipe({ title: 'Slow Cooker Beef Stew' });
    expect(detectInstruments(recipe)).toContain('slow_cooker');
  });

  it('detects slow_cooker from "crock pot" in title', () => {
    const recipe = makeRecipe({ title: 'Crock Pot Chili' });
    expect(detectInstruments(recipe)).toContain('slow_cooker');
  });

  it('detects pressure_cooker from "pressure cooker" in title', () => {
    const recipe = makeRecipe({ title: 'Pressure Cooker Rice' });
    expect(detectInstruments(recipe)).toContain('pressure_cooker');
  });

  it('detects pressure_cooker from "instant pot" in title', () => {
    const recipe = makeRecipe({ title: 'Instant Pot Soup' });
    expect(detectInstruments(recipe)).toContain('pressure_cooker');
  });

  it('detects microwave from "microwaved" in title', () => {
    const recipe = makeRecipe({ title: 'Microwaved Mug Cake' });
    expect(detectInstruments(recipe)).toContain('microwave');
  });

  it('detects stove_top from "sauteed" in title', () => {
    const recipe = makeRecipe({ title: 'Sauteed Mushrooms' });
    expect(detectInstruments(recipe)).toContain('stove_top');
  });

  it('detects stove_top from "stir-fry" in title', () => {
    const recipe = makeRecipe({ title: 'Vegetable Stir-Fry' });
    expect(detectInstruments(recipe)).toContain('stove_top');
  });

  it('detects stove_top from "pan fried" in title', () => {
    const recipe = makeRecipe({ title: 'Pan Fried Fish' });
    expect(detectInstruments(recipe)).toContain('stove_top');
  });

  it('detects stove_top from "boiled" in tags', () => {
    const recipe = makeRecipe({ tags: ['boiled', 'eggs'] });
    expect(detectInstruments(recipe)).toContain('stove_top');
  });

  it('detects stove_top from "simmering" in title', () => {
    const recipe = makeRecipe({ title: 'Simmering Tomato Sauce' });
    expect(detectInstruments(recipe)).toContain('stove_top');
  });

  it('detects toaster_oven from "toaster oven" in title', () => {
    const recipe = makeRecipe({ title: 'Toaster Oven Pizza' });
    expect(detectInstruments(recipe)).toContain('toaster_oven');
  });

  it('returns empty array for recipe with no instrument keywords', () => {
    const recipe = makeRecipe({ title: 'Fresh Garden Salad', tags: ['salad', 'raw'] });
    expect(detectInstruments(recipe)).toHaveLength(0);
  });

  it('detects multiple instruments from a single recipe', () => {
    const recipe = makeRecipe({
      title: 'Grilled and Baked Casserole',
      tags: ['dinner'],
    });
    const instruments = detectInstruments(recipe);
    expect(instruments).toContain('grill');
    expect(instruments).toContain('oven');
  });
});

// ---------------------------------------------------------------------------
// Tests: InstrumentInvariant.check
// ---------------------------------------------------------------------------

describe('InstrumentInvariant', () => {
  const invariant = new InstrumentInvariant();

  it('returns no violations when user has all required instruments', () => {
    const recipe = makeRecipe({ title: 'Baked Salmon' });
    const profile = makeProfile(['oven', 'stove_top']);

    const violations = invariant.check([recipe], profile, 0, '2026-01-01');
    expect(violations).toHaveLength(0);
  });

  it('flags recipe requiring oven when user does not have one', () => {
    const recipe = makeRecipe({ title: 'Baked Salmon' });
    const profile = makeProfile(['stove_top', 'microwave']);

    const violations = invariant.check([recipe], profile, 0, '2026-01-01');
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain('oven');
    expect(violations[0].severity).toBe('warning');
    expect(violations[0].type).toBe('instrument');
  });

  it('flags multiple missing instruments for a single recipe', () => {
    const recipe = makeRecipe({ title: 'Grilled and Baked Dish' });
    const profile = makeProfile(['stove_top']); // Missing both grill and oven

    const violations = invariant.check([recipe], profile, 0, '2026-01-01');
    expect(violations.length).toBe(2);
    const details = violations.map(v => v.detail);
    expect(details.some(d => d.includes('grill'))).toBe(true);
    expect(details.some(d => d.includes('oven'))).toBe(true);
  });

  it('skips check entirely when user has no instruments specified', () => {
    const recipe = makeRecipe({ title: 'Baked Salmon' });
    const profile = makeProfile([]); // Empty instruments list

    const violations = invariant.check([recipe], profile, 0, '2026-01-01');
    expect(violations).toHaveLength(0);
  });

  it('always passes recipes with no detected instruments', () => {
    const recipe = makeRecipe({ title: 'Fresh Salad', tags: ['raw', 'healthy'] });
    const profile = makeProfile(['stove_top']); // Limited instruments

    const violations = invariant.check([recipe], profile, 0, '2026-01-01');
    expect(violations).toHaveLength(0);
  });

  it('checks all recipes in the plan', () => {
    const recipe1 = makeRecipe({ id: 'r1', title: 'Baked Salmon' });
    const recipe2 = makeRecipe({ id: 'r2', title: 'Grilled Chicken' });
    const profile = makeProfile(['stove_top']); // Missing oven and grill

    const violations = invariant.check([recipe1, recipe2], profile, 0, '2026-01-01');
    expect(violations.length).toBe(2);
    expect(violations.some(v => v.recipeId === 'r1')).toBe(true);
    expect(violations.some(v => v.recipeId === 'r2')).toBe(true);
  });

  it('includes correct metadata in violations', () => {
    const recipe = makeRecipe({ id: 'r-oven', title: 'Baked Ziti' });
    const profile = makeProfile(['stove_top']);
    profile.id = 'prof-77';

    const violations = invariant.check([recipe], profile, 3, '2026-01-04');

    expect(violations).toHaveLength(1);
    expect(violations[0].profileId).toBe('prof-77');
    expect(violations[0].dayIndex).toBe(3);
    expect(violations[0].date).toBe('2026-01-04');
    expect(violations[0].recipeId).toBe('r-oven');
    expect(violations[0].recipeTitle).toBe('Baked Ziti');
  });
});
