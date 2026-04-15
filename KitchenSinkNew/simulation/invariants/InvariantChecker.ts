/**
 * InvariantChecker - Orchestrates all invariant rules against a meal plan.
 *
 * Runs each registered `InvariantRule` and aggregates their violations into
 * a flat array. New rules can be added by implementing the `InvariantRule`
 * interface and registering them in the constructor.
 */

import { UnifiedRecipe } from '../bridge/appImports';
import { SimulationProfile, InvariantViolation } from '../profiles/types';
import { DietaryInvariant } from './DietaryInvariant';
import { RepetitionInvariant } from './RepetitionInvariant';
import { InstrumentInvariant } from './InstrumentInvariant';

// ---------------------------------------------------------------------------
// InvariantRule interface
// ---------------------------------------------------------------------------

export interface InvariantRule {
  /** Human-readable name for logging/debugging. */
  name: string;
  /** Check the plan and return any violations found. */
  check(
    plan: UnifiedRecipe[],
    profile: SimulationProfile,
    dayIndex: number,
    date: string,
  ): InvariantViolation[];
}

// ---------------------------------------------------------------------------
// InvariantChecker
// ---------------------------------------------------------------------------

export class InvariantChecker {
  private rules: InvariantRule[];

  constructor(rules?: InvariantRule[]) {
    this.rules = rules ?? [
      new DietaryInvariant(),
      new RepetitionInvariant(),
      new InstrumentInvariant(),
    ];
  }

  /**
   * Run all invariant rules against the given meal plan.
   *
   * @param plan      - The recipes in the current meal plan.
   * @param profile   - The simulation profile (includes dietary preferences).
   * @param dayIndex  - Zero-based day index in the simulation.
   * @param date      - The simulated calendar date.
   * @returns A flat array of all violations found across all rules.
   */
  check(
    plan: UnifiedRecipe[],
    profile: SimulationProfile,
    dayIndex: number,
    date: Date,
  ): InvariantViolation[] {
    const dateStr = date.toISOString().split('T')[0];
    return this.rules.flatMap(rule =>
      rule.check(plan, profile, dayIndex, dateStr),
    );
  }
}
