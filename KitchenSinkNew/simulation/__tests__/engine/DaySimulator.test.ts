/**
 * Tests for DaySimulator.
 *
 * Uses mocked dependencies (SimFirestore, ActionRegistry, InvariantChecker,
 * QualityTracker) to verify the orchestration logic without real Firestore
 * or action implementations.
 */

import { DaySimulator } from '../../engine/DaySimulator';
import { ActionRegistry } from '../../actions/ActionRegistry';
import { InvariantChecker } from '../../invariants/InvariantChecker';
import { QualityTracker } from '../../quality/QualityTracker';
import { SimulationProfile, DayState, ActionResult } from '../../profiles/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Minimal mock for SimFirestore. */
function mockFirestore(overrides: Record<string, any> = {}) {
  return {
    getPantryItems: jest.fn().mockResolvedValue([]),
    getLeftovers: jest.fn().mockResolvedValue([]),
    getHistory: jest.fn().mockResolvedValue([]),
    getUserFeedback: jest.fn().mockResolvedValue([]),
    getUserRecipes: jest.fn().mockResolvedValue([]),
    addLeftover: jest.fn().mockResolvedValue('leftover-id-1'),
    addPantryItem: jest.fn().mockResolvedValue('pantry-id-1'),
    ...overrides,
  } as any;
}

/** Minimal mock for ActionRegistry. */
function mockActionRegistry(executors: Record<string, (ctx: any) => Promise<ActionResult>> = {}) {
  const registry = {
    get: jest.fn().mockImplementation((type: string) => {
      if (executors[type]) {
        return { type, execute: executors[type] };
      }
      throw new Error(`No executor registered for action type: ${type}`);
    }),
    has: jest.fn().mockImplementation((type: string) => type in executors),
    registeredTypes: jest.fn().mockReturnValue(Object.keys(executors)),
  } as any;
  return registry;
}

/** Minimal mock for InvariantChecker. */
function mockInvariantChecker(violations: any[] = []) {
  return {
    check: jest.fn().mockReturnValue(violations),
  } as any;
}

/** Minimal mock for QualityTracker. */
function mockQualityTracker() {
  return {
    record: jest.fn(),
    getSnapshots: jest.fn().mockReturnValue([]),
    getAllViolations: jest.fn().mockReturnValue([]),
    reset: jest.fn(),
  } as any;
}

function makeProfile(overrides: Partial<SimulationProfile> = {}): SimulationProfile {
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
        kitchenInstruments: ['stove_top', 'oven'],
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
    ...overrides,
  };
}

function fixedRng(value: number): () => number {
  return () => value;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DaySimulator', () => {
  describe('simulateDay', () => {
    it('returns a valid DaySnapshot with correct metadata', async () => {
      const firestore = mockFirestore();
      const actions = mockActionRegistry();
      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      const profile = makeProfile({ engagementTier: 'low' });
      // Day 3 for low tier: no meal plan, no grocery
      const snapshot = await sim.simulateDay(
        profile,
        3,
        new Date('2026-04-03'),
        fixedRng(1.0), // high value = nothing passes probability
      );

      expect(snapshot.profileId).toBe('profile-1');
      expect(snapshot.dayIndex).toBe(3);
      expect(snapshot.date).toBe('2026-04-03');
      expect(snapshot.season).toBe('spring');
      expect(snapshot.violations).toEqual([]);
      expect(snapshot.mealPlanGenerated).toBe(false);
    });

    it('loads state from Firestore on each day', async () => {
      const firestore = mockFirestore();
      const actions = mockActionRegistry();
      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      const profile = makeProfile({ engagementTier: 'low' });
      await sim.simulateDay(profile, 3, new Date('2026-04-03'), fixedRng(1.0));

      expect(firestore.getPantryItems).toHaveBeenCalledWith('uid-1');
      expect(firestore.getLeftovers).toHaveBeenCalledWith('uid-1');
      expect(firestore.getHistory).toHaveBeenCalledWith('uid-1');
      expect(firestore.getUserFeedback).toHaveBeenCalledWith('uid-1');
      expect(firestore.getUserRecipes).toHaveBeenCalledWith('uid-1');
    });

    it('records snapshot via QualityTracker', async () => {
      const firestore = mockFirestore();
      const actions = mockActionRegistry();
      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      const profile = makeProfile({ engagementTier: 'low' });
      const snapshot = await sim.simulateDay(
        profile,
        3,
        new Date('2026-04-03'),
        fixedRng(1.0),
      );

      expect(quality.record).toHaveBeenCalledTimes(1);
      expect(quality.record).toHaveBeenCalledWith(snapshot);
    });

    it('executes cook_recipe and updates cookedToday in state', async () => {
      const mealPlanRecipe = {
        id: 'r1',
        title: 'Test Pasta',
        tags: [],
        ingredients: [],
        servings: 4,
        isWeeklyMealPlan: true,
      };

      const firestore = mockFirestore({
        getUserRecipes: jest.fn().mockResolvedValue([mealPlanRecipe]),
      });

      const actions = mockActionRegistry({
        cook_recipe: jest.fn().mockResolvedValue({
          type: 'cook_recipe',
          success: true,
          data: { recipeId: 'r1', recipeTitle: 'Test Pasta', mealType: 'dinner', date: '2026-01-01' },
        }),
        update_pantry: jest.fn().mockResolvedValue({
          type: 'update_pantry',
          success: true,
        }),
        check_insights: jest.fn().mockResolvedValue({
          type: 'check_insights',
          success: true,
        }),
      });

      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      // Day 1 for high tier: cook_recipe eligible, rng=0 ensures it passes
      const profile = makeProfile({ engagementTier: 'high' });
      const snapshot = await sim.simulateDay(
        profile,
        1,
        new Date('2026-01-01'),
        fixedRng(0),
      );

      expect(snapshot.recipesCooked).toBe(1);
      const cookAction = snapshot.actionsExecuted.find(a => a.type === 'cook_recipe');
      expect(cookAction).toBeDefined();
      expect(cookAction!.success).toBe(true);
    });

    it('handles log_leftover inline without registry executor', async () => {
      const mealPlanRecipe = {
        id: 'r1',
        title: 'Test Pasta',
        tags: [],
        ingredients: [],
        servings: 4,
        isWeeklyMealPlan: true,
      };

      const firestore = mockFirestore({
        getUserRecipes: jest.fn().mockResolvedValue([mealPlanRecipe]),
        addLeftover: jest.fn().mockResolvedValue('left-1'),
      });

      const actions = mockActionRegistry({
        cook_recipe: jest.fn().mockResolvedValue({
          type: 'cook_recipe',
          success: true,
          data: { recipeId: 'r1', recipeTitle: 'Test Pasta', mealType: 'dinner', date: '2026-01-01' },
        }),
        give_feedback: jest.fn().mockResolvedValue({
          type: 'give_feedback',
          success: true,
        }),
        update_pantry: jest.fn().mockResolvedValue({
          type: 'update_pantry',
          success: true,
        }),
        check_insights: jest.fn().mockResolvedValue({
          type: 'check_insights',
          success: true,
        }),
      });

      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      const profile = makeProfile({ engagementTier: 'high' });
      const snapshot = await sim.simulateDay(
        profile,
        1,
        new Date('2026-01-01'),
        fixedRng(0),
      );

      // log_leftover should be in the executed actions
      const leftoverAction = snapshot.actionsExecuted.find(a => a.type === 'log_leftover');
      expect(leftoverAction).toBeDefined();
      expect(leftoverAction!.success).toBe(true);

      // Should have called addLeftover on firestore
      expect(firestore.addLeftover).toHaveBeenCalledWith(
        'uid-1',
        expect.objectContaining({
          recipeId: 'r1',
          recipeName: 'Test Pasta',
          originalServings: 4,
          remainingServings: 3,
          status: 'available',
        }),
      );
    });

    it('runs invariant checker when meal plan is generated', async () => {
      const mealPlanRecipe = {
        id: 'r1',
        title: 'Test Pasta',
        tags: [],
        ingredients: [],
        servings: 4,
        isWeeklyMealPlan: true,
      };

      const firestore = mockFirestore({
        getUserRecipes: jest.fn().mockResolvedValue([mealPlanRecipe]),
      });

      const actions = mockActionRegistry({
        generate_meal_plan: jest.fn().mockResolvedValue({
          type: 'generate_meal_plan',
          success: true,
          data: { recipesGenerated: 7 },
        }),
        cook_recipe: jest.fn().mockResolvedValue({
          type: 'cook_recipe',
          success: true,
          data: { recipeId: 'r1', recipeTitle: 'Test Pasta', mealType: 'dinner', date: '2026-01-01' },
        }),
        update_pantry: jest.fn().mockResolvedValue({
          type: 'update_pantry',
          success: true,
        }),
        grocery_restock: jest.fn().mockResolvedValue({
          type: 'grocery_restock',
          success: true,
        }),
        check_insights: jest.fn().mockResolvedValue({
          type: 'check_insights',
          success: true,
        }),
      });

      const testViolation = {
        profileId: 'profile-1',
        dayIndex: 0,
        date: '2026-01-01',
        type: 'dietary' as const,
        recipeId: 'r1',
        recipeTitle: 'Test Pasta',
        detail: 'Missing vegan tag',
        severity: 'critical' as const,
      };
      const checker = mockInvariantChecker([testViolation]);
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      // Day 0 for high tier: generate_meal_plan fires
      const profile = makeProfile({ engagementTier: 'high' });
      const snapshot = await sim.simulateDay(
        profile,
        0,
        new Date('2026-01-01'),
        fixedRng(0),
      );

      expect(snapshot.mealPlanGenerated).toBe(true);
      expect(checker.check).toHaveBeenCalled();
      expect(snapshot.violations).toEqual([testViolation]);
    });

    it('does not run invariant checker when no meal plan is generated', async () => {
      const firestore = mockFirestore();
      const actions = mockActionRegistry({
        cook_recipe: jest.fn().mockResolvedValue({
          type: 'cook_recipe',
          success: true,
          data: { recipeId: 'r1' },
        }),
      });
      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      // Day 3: no meal plan day
      const profile = makeProfile({ engagementTier: 'high' });
      const snapshot = await sim.simulateDay(
        profile,
        3,
        new Date('2026-01-04'),
        fixedRng(1.0),
      );

      expect(snapshot.mealPlanGenerated).toBe(false);
      expect(checker.check).not.toHaveBeenCalled();
    });

    it('handles action execution errors gracefully', async () => {
      const firestore = mockFirestore();
      const actions = mockActionRegistry({
        cook_recipe: jest.fn().mockRejectedValue(new Error('Boom!')),
        update_pantry: jest.fn().mockResolvedValue({
          type: 'update_pantry',
          success: true,
        }),
        check_insights: jest.fn().mockResolvedValue({
          type: 'check_insights',
          success: true,
        }),
      });
      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);

      const profile = makeProfile({ engagementTier: 'high' });
      // Day 1 so cook_recipe is eligible, rng=0 so it fires
      const snapshot = await sim.simulateDay(
        profile,
        1,
        new Date('2026-01-02'),
        fixedRng(0),
      );

      // The day should complete even if cook_recipe throws
      const cookAction = snapshot.actionsExecuted.find(a => a.type === 'cook_recipe');
      expect(cookAction).toBeDefined();
      expect(cookAction!.success).toBe(false);
      expect(cookAction!.error).toContain('Boom!');
    });

    it('returns ActionResult with error for unregistered action types', async () => {
      // A registry that has cook_recipe but nothing else
      const firestore = mockFirestore();
      const registry = mockActionRegistry({});
      // Override has to return true for cook_recipe but without actual executor
      // Actually, let's test with a clean scenario where scheduleActions fires
      // an action the registry doesn't have. We'll use a low-tier day 3
      // where only cook_recipe/update_pantry/check_insights are eligible.
      // But has() returns false for those, so they'll get the "No executor" error.

      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, registry, checker, quality);

      const profile = makeProfile({ engagementTier: 'high' });
      const snapshot = await sim.simulateDay(
        profile,
        1,
        new Date('2026-01-02'),
        fixedRng(0),
      );

      // All actions should fail with "No executor registered"
      for (const action of snapshot.actionsExecuted) {
        if (action.type !== 'log_leftover') {
          expect(action.success).toBe(false);
          expect(action.error).toContain('No executor registered');
        }
      }
    });

    it('computes correct season in snapshot', async () => {
      const firestore = mockFirestore();
      const actions = mockActionRegistry();
      const checker = mockInvariantChecker();
      const quality = mockQualityTracker();
      const sim = new DaySimulator(firestore, actions, checker, quality);
      const profile = makeProfile({ engagementTier: 'low' });

      const springSnapshot = await sim.simulateDay(profile, 3, new Date('2026-04-15'), fixedRng(1.0));
      expect(springSnapshot.season).toBe('spring');

      const summerSnapshot = await sim.simulateDay(profile, 3, new Date('2026-07-15'), fixedRng(1.0));
      expect(summerSnapshot.season).toBe('summer');

      const fallSnapshot = await sim.simulateDay(profile, 3, new Date('2026-10-15'), fixedRng(1.0));
      expect(fallSnapshot.season).toBe('fall');

      const winterSnapshot = await sim.simulateDay(profile, 3, new Date('2026-01-15'), fixedRng(1.0));
      expect(winterSnapshot.season).toBe('winter');
    });
  });
});
