/**
 * Tests for DietaryInvariant.
 *
 * Verifies tag-based dietary checks, allergy detection, and restriction
 * enforcement against recipe ingredients and titles.
 */

import { DietaryInvariant } from '../../invariants/DietaryInvariant';
import { SimulationProfile } from '../../profiles/types';
import { UnifiedRecipe } from '../../bridge/appImports';

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

function makeProfile(
  dietaryOverrides: Partial<SimulationProfile['preferences']['dietary']> = {},
): SimulationProfile {
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
        ...dietaryOverrides,
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

describe('DietaryInvariant', () => {
  const invariant = new DietaryInvariant();

  describe('tag-based dietary checks', () => {
    it('flags recipe missing vegan tag when user is vegan', () => {
      const recipe = makeRecipe({ tags: ['dinner'] });
      const profile = makeProfile({ vegan: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');

      expect(violations.length).toBeGreaterThanOrEqual(1);
      const veganViolation = violations.find(v => v.detail.includes('vegan'));
      expect(veganViolation).toBeDefined();
      expect(veganViolation!.severity).toBe('critical');
      expect(veganViolation!.type).toBe('dietary');
    });

    it('does not flag recipe with vegan tag when user is vegan', () => {
      const recipe = makeRecipe({ tags: ['vegan', 'dinner'] });
      const profile = makeProfile({ vegan: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      const veganViolation = violations.find(v => v.detail.includes('vegan'));
      expect(veganViolation).toBeUndefined();
    });

    it('flags recipe missing vegetarian tag when user is vegetarian', () => {
      const recipe = makeRecipe({ tags: ['dinner'] });
      const profile = makeProfile({ vegetarian: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('vegetarian'))).toBe(true);
    });

    it('accepts recipe with vegetarian tag for vegetarian user', () => {
      const recipe = makeRecipe({ tags: ['vegetarian'] });
      const profile = makeProfile({ vegetarian: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('vegetarian'))).toBe(false);
    });

    it('handles gluten-free with hyphen', () => {
      const recipe = makeRecipe({ tags: ['gluten-free'] });
      const profile = makeProfile({ glutenFree: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('gluten'))).toBe(false);
    });

    it('handles gluten free without hyphen', () => {
      const recipe = makeRecipe({ tags: ['gluten free'] });
      const profile = makeProfile({ glutenFree: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('gluten'))).toBe(false);
    });

    it('flags missing gluten-free tag', () => {
      const recipe = makeRecipe({ tags: ['dinner'] });
      const profile = makeProfile({ glutenFree: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('gluten'))).toBe(true);
    });

    it('handles dairy-free tag variants', () => {
      const recipe1 = makeRecipe({ id: 'r1', tags: ['dairy-free'] });
      const recipe2 = makeRecipe({ id: 'r2', tags: ['dairy free'] });
      const profile = makeProfile({ dairyFree: true });

      expect(invariant.check([recipe1], profile, 0, '2026-01-01')).toHaveLength(0);
      expect(invariant.check([recipe2], profile, 0, '2026-01-01')).toHaveLength(0);
    });

    it('handles nut-free tag variants', () => {
      const recipe = makeRecipe({ tags: ['nut-free'] });
      const profile = makeProfile({ nutFree: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('nut'))).toBe(false);
    });

    it('accepts low-carb / keto tags for lowCarb preference', () => {
      const recipe1 = makeRecipe({ id: 'r1', tags: ['low-carb'] });
      const recipe2 = makeRecipe({ id: 'r2', tags: ['low carb'] });
      const recipe3 = makeRecipe({ id: 'r3', tags: ['keto'] });
      const profile = makeProfile({ lowCarb: true });

      expect(invariant.check([recipe1], profile, 0, '2026-01-01')).toHaveLength(0);
      expect(invariant.check([recipe2], profile, 0, '2026-01-01')).toHaveLength(0);
      expect(invariant.check([recipe3], profile, 0, '2026-01-01')).toHaveLength(0);
    });

    it('case-insensitive tag matching', () => {
      const recipe = makeRecipe({ tags: ['Vegan', 'DINNER'] });
      const profile = makeProfile({ vegan: true });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('vegan'))).toBe(false);
    });
  });

  describe('allergy checks', () => {
    it('flags recipe containing allergen in ingredients', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'peanut butter', amount: 2, unit: 'tbsp' }],
      });
      const profile = makeProfile({ allergies: ['peanut'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('allergen') && v.detail.includes('peanut'))).toBe(true);
    });

    it('flags recipe with allergen in title', () => {
      const recipe = makeRecipe({
        title: 'Peanut Butter Cookies',
        ingredients: [],
      });
      const profile = makeProfile({ allergies: ['peanut'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag recipe without allergen', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'chicken breast', amount: 1, unit: 'lb' }],
      });
      const profile = makeProfile({ allergies: ['peanut'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('allergen'))).toBe(false);
    });

    it('handles empty allergies array gracefully', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'peanut', amount: 1, unit: 'cup' }],
      });
      const profile = makeProfile({ allergies: [] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('allergen'))).toBe(false);
    });
  });

  describe('restriction checks', () => {
    it('flags recipe with beef for no_red_meat restriction', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'ground beef', amount: 1, unit: 'lb' }],
      });
      const profile = makeProfile({ restrictions: ['no_red_meat'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('no_red_meat'))).toBe(true);
    });

    it('flags recipe with lamb for no_red_meat restriction', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'lamb chops', amount: 2, unit: 'pieces' }],
      });
      const profile = makeProfile({ restrictions: ['no_red_meat'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('no_red_meat'))).toBe(true);
    });

    it('flags recipe with chicken for no_poultry restriction', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'chicken breast', amount: 1, unit: 'lb' }],
      });
      const profile = makeProfile({ restrictions: ['no_poultry'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('no_poultry'))).toBe(true);
    });

    it('flags recipe with turkey for no_poultry restriction', () => {
      const recipe = makeRecipe({
        title: 'Roasted Turkey',
        ingredients: [{ name: 'turkey', amount: 1, unit: 'whole' }],
      });
      const profile = makeProfile({ restrictions: ['no_poultry'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag chicken for no_red_meat restriction', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'chicken breast', amount: 1, unit: 'lb' }],
      });
      const profile = makeProfile({ restrictions: ['no_red_meat'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('no_red_meat'))).toBe(false);
    });

    it('flags recipe with cooking tags for no_cooked_food restriction', () => {
      const recipe = makeRecipe({ tags: ['baked', 'dinner'] });
      const profile = makeProfile({ restrictions: ['no_cooked_food'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('no_cooked_food'))).toBe(true);
    });

    it('does not flag raw recipe for no_cooked_food restriction', () => {
      const recipe = makeRecipe({ tags: ['raw', 'salad'] });
      const profile = makeProfile({ restrictions: ['no_cooked_food'] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations.some(v => v.detail.includes('no_cooked_food'))).toBe(false);
    });

    it('handles empty restrictions array gracefully', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'beef', amount: 1, unit: 'lb' }],
      });
      const profile = makeProfile({ restrictions: [] });

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations).toHaveLength(0);
    });
  });

  describe('multiple recipes in plan', () => {
    it('checks every recipe in the plan', () => {
      const recipe1 = makeRecipe({ id: 'r1', title: 'Steak', tags: ['dinner'] });
      const recipe2 = makeRecipe({ id: 'r2', title: 'Salad', tags: ['vegan', 'dinner'] });
      const profile = makeProfile({ vegan: true });

      const violations = invariant.check([recipe1, recipe2], profile, 0, '2026-01-01');

      // recipe1 should be flagged (no vegan tag), recipe2 should pass
      const r1Violations = violations.filter(v => v.recipeId === 'r1');
      const r2Violations = violations.filter(v => v.recipeId === 'r2');
      expect(r1Violations.length).toBeGreaterThan(0);
      expect(r2Violations).toHaveLength(0);
    });
  });

  describe('no preferences set', () => {
    it('returns no violations when no dietary preferences are enabled', () => {
      const recipe = makeRecipe({
        ingredients: [{ name: 'beef', amount: 1, unit: 'lb' }],
        tags: ['dinner'],
      });
      const profile = makeProfile();

      const violations = invariant.check([recipe], profile, 0, '2026-01-01');
      expect(violations).toHaveLength(0);
    });
  });

  describe('violation metadata', () => {
    it('includes correct profileId, dayIndex, date, and recipeId', () => {
      const recipe = makeRecipe({ id: 'r-special', title: 'Special Dish' });
      const profile = makeProfile({ vegan: true });
      profile.id = 'prof-42';

      const violations = invariant.check([recipe], profile, 7, '2026-01-08');

      expect(violations.length).toBeGreaterThan(0);
      const v = violations[0];
      expect(v.profileId).toBe('prof-42');
      expect(v.dayIndex).toBe(7);
      expect(v.date).toBe('2026-01-08');
      expect(v.recipeId).toBe('r-special');
      expect(v.recipeTitle).toBe('Special Dish');
    });
  });
});
