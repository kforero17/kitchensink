/**
 * ActionScheduler - Determines which actions fire on a given simulation day.
 *
 * Uses engagement-tier-specific probabilities and eligibility rules to decide
 * which actions a simulated user performs. A seeded RNG ensures deterministic
 * behaviour across runs with the same seed.
 */

import { EngagementTier, ActionType, DayState } from '../profiles/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScheduledAction {
  type: ActionType;
  probability: number;
}

// ---------------------------------------------------------------------------
// Probability tables
// ---------------------------------------------------------------------------

const ACTION_PROBABILITIES: Record<EngagementTier, Record<ActionType, number>> = {
  high: {
    generate_meal_plan: 1.0,
    cook_recipe: 0.85,
    log_leftover: 0.70,
    give_feedback: 0.80,
    update_pantry: 0.90,
    grocery_restock: 0.95,
    swap_recipe: 0.20,
    check_insights: 0.70,
  },
  medium: {
    generate_meal_plan: 1.0,
    cook_recipe: 0.55,
    log_leftover: 0.25,
    give_feedback: 0.30,
    update_pantry: 0.40,
    grocery_restock: 0.60,
    swap_recipe: 0.05,
    check_insights: 0.10,
  },
  low: {
    generate_meal_plan: 0.5,
    cook_recipe: 0.25,
    log_leftover: 0.05,
    give_feedback: 0.05,
    update_pantry: 0.10,
    grocery_restock: 0.20,
    swap_recipe: 0.0,
    check_insights: 0.0,
  },
};

/**
 * The canonical execution order for actions within a single day.
 * Actions are always returned (and should be executed) in this order.
 */
const EXECUTION_ORDER: readonly ActionType[] = [
  'generate_meal_plan',
  'cook_recipe',
  'log_leftover',
  'give_feedback',
  'update_pantry',
  'grocery_restock',
  'swap_recipe',
  'check_insights',
] as const;

// ---------------------------------------------------------------------------
// Eligibility helpers
// ---------------------------------------------------------------------------

function isMealPlanDay(tier: EngagementTier, dayIndex: number): boolean {
  if (tier === 'low') {
    return dayIndex % 14 === 0;
  }
  return dayIndex % 7 === 0;
}

function isGroceryDay(dayIndex: number): boolean {
  return dayIndex % 7 === 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine which actions should fire on a given simulation day.
 *
 * @param tier        - The user's engagement tier (high / medium / low).
 * @param dayIndex    - Zero-based day index within the simulation.
 * @param currentState - The mutable day state at the point of scheduling.
 * @param rng         - Seeded PRNG returning values in [0, 1).
 * @returns Actions to execute, in canonical execution order.
 */
export function scheduleActions(
  tier: EngagementTier,
  dayIndex: number,
  currentState: DayState,
  rng: () => number,
): ScheduledAction[] {
  const probabilities = ACTION_PROBABILITIES[tier];
  const scheduled: ScheduledAction[] = [];

  // Track whether cook_recipe and generate_meal_plan are scheduled so
  // dependent actions (log_leftover, give_feedback) can check eligibility.
  let cookScheduled = false;

  for (const actionType of EXECUTION_ORDER) {
    const probability = probabilities[actionType];

    // --- Eligibility gates ---
    if (!isEligible(actionType, tier, dayIndex, currentState, cookScheduled)) {
      continue;
    }

    // --- Probability roll ---
    if (rng() < probability) {
      scheduled.push({ type: actionType, probability });

      if (actionType === 'cook_recipe') {
        cookScheduled = true;
      }
    }
  }

  return scheduled;
}

/**
 * Determine whether an action is eligible to fire on this day,
 * independent of its probability roll.
 */
function isEligible(
  actionType: ActionType,
  tier: EngagementTier,
  dayIndex: number,
  currentState: DayState,
  cookScheduled: boolean,
): boolean {
  switch (actionType) {
    case 'generate_meal_plan':
      return isMealPlanDay(tier, dayIndex);

    case 'cook_recipe':
      // Any day, capped at 1 per day (only one cook_recipe in schedule)
      return true;

    case 'log_leftover':
      // Only if cook_recipe was scheduled this day
      return cookScheduled;

    case 'give_feedback':
      // Only if cook_recipe was scheduled this day
      return cookScheduled;

    case 'update_pantry':
      return true;

    case 'grocery_restock':
      return isGroceryDay(dayIndex);

    case 'swap_recipe':
      return currentState.currentMealPlan.length > 0;

    case 'check_insights':
      return true;

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { ACTION_PROBABILITIES, EXECUTION_ORDER };
