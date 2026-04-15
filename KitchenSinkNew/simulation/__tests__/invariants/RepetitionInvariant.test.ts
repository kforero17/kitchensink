/**
 * Tests for RepetitionInvariant.
 *
 * Verifies that duplicate recipe IDs within a single meal plan are detected
 * and reported as warning-level violations.
 */

import { RepetitionInvariant } from '../../invariants/RepetitionInvariant';
import { SimulationProfile } from '../../profiles/types';
import { UnifiedRecipe } from '../../bridge/appImports';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipe(id: string, title: string = `Recipe ${id}`): UnifiedRecipe {
  return {
    id,
    source: 'tasty',
    title,
    imageUrl: '',
    readyInMinutes: 30,
    servings: 4,
    ingredients: [],
    tags: [],
  };
}

function makeProfile(): SimulationProfile {
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
        kitchenInstruments: [],
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
// Tests
// ---------------------------------------------------------------------------

describe('RepetitionInvariant', () => {
  const invariant = new RepetitionInvariant();
  const profile = makeProfile();

  it('returns no violations for a plan with unique recipes', () => {
    const plan = [makeRecipe('r1'), makeRecipe('r2'), makeRecipe('r3')];
    const violations = invariant.check(plan, profile, 0, '2026-01-01');
    expect(violations).toHaveLength(0);
  });

  it('detects a single duplicate recipe', () => {
    const plan = [makeRecipe('r1'), makeRecipe('r2'), makeRecipe('r1', 'Duplicate R1')];
    const violations = invariant.check(plan, profile, 0, '2026-01-01');

    expect(violations).toHaveLength(1);
    expect(violations[0].recipeId).toBe('r1');
    expect(violations[0].type).toBe('repetition');
    expect(violations[0].severity).toBe('warning');
  });

  it('detects multiple occurrences of the same duplicate', () => {
    const plan = [makeRecipe('r1'), makeRecipe('r1'), makeRecipe('r1')];
    const violations = invariant.check(plan, profile, 0, '2026-01-01');

    // Second and third occurrences are violations
    expect(violations).toHaveLength(2);
    expect(violations.every(v => v.recipeId === 'r1')).toBe(true);
  });

  it('detects duplicates of different recipes', () => {
    const plan = [
      makeRecipe('r1'),
      makeRecipe('r2'),
      makeRecipe('r1'),
      makeRecipe('r2'),
    ];
    const violations = invariant.check(plan, profile, 0, '2026-01-01');

    expect(violations).toHaveLength(2);
    const violatedIds = violations.map(v => v.recipeId).sort();
    expect(violatedIds).toEqual(['r1', 'r2']);
  });

  it('returns no violations for an empty plan', () => {
    const violations = invariant.check([], profile, 0, '2026-01-01');
    expect(violations).toHaveLength(0);
  });

  it('returns no violations for a single-recipe plan', () => {
    const violations = invariant.check([makeRecipe('r1')], profile, 0, '2026-01-01');
    expect(violations).toHaveLength(0);
  });

  it('includes correct metadata in violations', () => {
    const plan = [makeRecipe('r1'), makeRecipe('r1')];
    profile.id = 'prof-99';

    const violations = invariant.check(plan, profile, 5, '2026-01-06');

    expect(violations).toHaveLength(1);
    expect(violations[0].profileId).toBe('prof-99');
    expect(violations[0].dayIndex).toBe(5);
    expect(violations[0].date).toBe('2026-01-06');
    expect(violations[0].detail).toContain('r1');
  });
});
