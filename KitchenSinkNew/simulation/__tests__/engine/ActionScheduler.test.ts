/**
 * Tests for ActionScheduler.
 *
 * Verifies eligibility rules, probability gating, execution order,
 * and tier-specific behaviour for all action types.
 */

import { scheduleActions, ACTION_PROBABILITIES, EXECUTION_ORDER } from '../../engine/ActionScheduler';
import { DayState, ActionType, EngagementTier } from '../../profiles/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a minimal DayState for testing. */
function makeDayState(overrides: Partial<DayState> = {}): DayState {
  return {
    pantryItems: [],
    leftovers: [],
    currentMealPlan: [],
    recipeHistory: [],
    feedbackHistory: [],
    cookedToday: [],
    ...overrides,
  };
}

/** RNG that always returns a fixed value. */
function fixedRng(value: number): () => number {
  return () => value;
}

/** RNG that returns values from a predetermined sequence (cycling). */
function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

/** Extract just the action types from a scheduled actions array. */
function actionTypes(scheduled: { type: ActionType }[]): ActionType[] {
  return scheduled.map(a => a.type);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActionScheduler', () => {
  describe('scheduleActions', () => {
    // ----- Execution order -----

    it('returns actions in canonical execution order', () => {
      // rng=0 means every probability check passes
      const state = makeDayState({
        currentMealPlan: [{ id: 'r1', title: 'Test', tags: [], ingredients: [], servings: 4 } as any],
      });
      const result = scheduleActions('high', 0, state, fixedRng(0));
      const types = actionTypes(result);

      // Verify ordering: each action should appear at or after its canonical position
      for (let i = 1; i < types.length; i++) {
        const prevOrder = EXECUTION_ORDER.indexOf(types[i - 1]);
        const currOrder = EXECUTION_ORDER.indexOf(types[i]);
        expect(currOrder).toBeGreaterThan(prevOrder);
      }
    });

    // ----- generate_meal_plan eligibility -----

    describe('generate_meal_plan eligibility', () => {
      it('is eligible on day 0 for high tier (day % 7 === 0)', () => {
        const result = scheduleActions('high', 0, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).toContain('generate_meal_plan');
      });

      it('is eligible on day 7 for high tier', () => {
        const result = scheduleActions('high', 7, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).toContain('generate_meal_plan');
      });

      it('is NOT eligible on day 3 for high tier', () => {
        const result = scheduleActions('high', 3, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).not.toContain('generate_meal_plan');
      });

      it('is eligible on day 0 for medium tier (day % 7 === 0)', () => {
        const result = scheduleActions('medium', 0, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).toContain('generate_meal_plan');
      });

      it('is eligible on day 0 for low tier (day % 14 === 0)', () => {
        const result = scheduleActions('low', 0, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).toContain('generate_meal_plan');
      });

      it('is NOT eligible on day 7 for low tier (7 % 14 !== 0)', () => {
        const result = scheduleActions('low', 7, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).not.toContain('generate_meal_plan');
      });

      it('is eligible on day 14 for low tier', () => {
        const result = scheduleActions('low', 14, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).toContain('generate_meal_plan');
      });
    });

    // ----- grocery_restock eligibility -----

    describe('grocery_restock eligibility', () => {
      it('is eligible on day 0 (weekly)', () => {
        const result = scheduleActions('high', 0, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).toContain('grocery_restock');
      });

      it('is NOT eligible on day 3', () => {
        const result = scheduleActions('high', 3, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).not.toContain('grocery_restock');
      });
    });

    // ----- log_leftover / give_feedback depend on cook_recipe -----

    describe('log_leftover and give_feedback dependencies', () => {
      it('log_leftover is NOT scheduled when cook_recipe is not scheduled', () => {
        // rng=1.0 means nothing passes probability checks
        const result = scheduleActions('high', 1, makeDayState(), fixedRng(1.0));
        expect(actionTypes(result)).not.toContain('log_leftover');
        expect(actionTypes(result)).not.toContain('cook_recipe');
      });

      it('log_leftover and give_feedback can appear when cook_recipe is scheduled', () => {
        // rng=0 ensures all probability checks pass
        const result = scheduleActions('high', 1, makeDayState(), fixedRng(0));
        const types = actionTypes(result);
        expect(types).toContain('cook_recipe');
        expect(types).toContain('log_leftover');
        expect(types).toContain('give_feedback');
      });

      it('log_leftover appears after cook_recipe in execution order', () => {
        const result = scheduleActions('high', 1, makeDayState(), fixedRng(0));
        const types = actionTypes(result);
        const cookIdx = types.indexOf('cook_recipe');
        const leftoverIdx = types.indexOf('log_leftover');
        expect(leftoverIdx).toBeGreaterThan(cookIdx);
      });
    });

    // ----- swap_recipe eligibility -----

    describe('swap_recipe eligibility', () => {
      it('is NOT eligible when meal plan is empty', () => {
        const result = scheduleActions('high', 1, makeDayState(), fixedRng(0));
        expect(actionTypes(result)).not.toContain('swap_recipe');
      });

      it('is eligible when meal plan has recipes', () => {
        const state = makeDayState({
          currentMealPlan: [{ id: 'r1', title: 'Test', tags: [], ingredients: [], servings: 4 } as any],
        });
        const result = scheduleActions('high', 1, state, fixedRng(0));
        expect(actionTypes(result)).toContain('swap_recipe');
      });
    });

    // ----- Probability gating -----

    describe('probability gating', () => {
      it('high rng value means nothing gets scheduled (except guaranteed actions)', () => {
        // rng=0.999 -- even the highest probabilities (1.0) use strict <, so 0.999 < 1.0 passes
        // Use 1.0 to truly block everything
        const result = scheduleActions('high', 0, makeDayState(), fixedRng(1.0));
        expect(result).toHaveLength(0);
      });

      it('low rng value means eligible actions all pass', () => {
        const state = makeDayState({
          currentMealPlan: [{ id: 'r1', title: 'Test', tags: [], ingredients: [], servings: 4 } as any],
        });
        const result = scheduleActions('high', 0, state, fixedRng(0));
        // On day 0 for high tier: generate_meal_plan, cook_recipe, log_leftover,
        // give_feedback, update_pantry, grocery_restock, swap_recipe, check_insights
        expect(result.length).toBe(8);
      });

      it('actions with 0.0 probability are never scheduled', () => {
        // Low tier: swap_recipe=0.0, check_insights=0.0
        const state = makeDayState({
          currentMealPlan: [{ id: 'r1', title: 'Test', tags: [], ingredients: [], servings: 4 } as any],
        });
        const result = scheduleActions('low', 0, state, fixedRng(0));
        const types = actionTypes(result);
        expect(types).not.toContain('swap_recipe');
        expect(types).not.toContain('check_insights');
      });
    });

    // ----- Tier-specific behaviour -----

    describe('tier-specific behaviour', () => {
      it('medium tier has lower probabilities than high tier for most actions', () => {
        const high = ACTION_PROBABILITIES.high;
        const medium = ACTION_PROBABILITIES.medium;
        const actionsToCheck: ActionType[] = ['cook_recipe', 'log_leftover', 'give_feedback', 'update_pantry'];

        for (const action of actionsToCheck) {
          expect(medium[action]).toBeLessThan(high[action]);
        }
      });

      it('low tier has lower probabilities than medium tier for most actions', () => {
        const medium = ACTION_PROBABILITIES.medium;
        const low = ACTION_PROBABILITIES.low;
        const actionsToCheck: ActionType[] = ['cook_recipe', 'log_leftover', 'give_feedback', 'update_pantry'];

        for (const action of actionsToCheck) {
          expect(low[action]).toBeLessThanOrEqual(medium[action]);
        }
      });
    });

    // ----- Determinism -----

    describe('determinism', () => {
      it('same rng sequence produces same schedule', () => {
        const state = makeDayState({
          currentMealPlan: [{ id: 'r1', title: 'Test', tags: [], ingredients: [], servings: 4 } as any],
        });
        const values = [0.1, 0.5, 0.3, 0.9, 0.2, 0.4, 0.6, 0.8];

        const result1 = scheduleActions('high', 0, state, sequenceRng(values));
        const result2 = scheduleActions('high', 0, state, sequenceRng(values));

        expect(actionTypes(result1)).toEqual(actionTypes(result2));
      });
    });

    // ----- Edge cases -----

    describe('edge cases', () => {
      it('day 0 is both a meal plan day and grocery day', () => {
        const result = scheduleActions('high', 0, makeDayState(), fixedRng(0));
        const types = actionTypes(result);
        expect(types).toContain('generate_meal_plan');
        expect(types).toContain('grocery_restock');
      });

      it('returns ScheduledAction objects with correct probability values', () => {
        const result = scheduleActions('high', 0, makeDayState(), fixedRng(0));
        const mealPlanAction = result.find(a => a.type === 'generate_meal_plan');
        expect(mealPlanAction).toBeDefined();
        expect(mealPlanAction!.probability).toBe(1.0);
      });
    });
  });
});
