/**
 * DiversityTracker - Measures week-over-week recipe novelty.
 *
 * For every day a meal plan is generated the tracker stores the set of recipe
 * IDs for that day.  At finalization it walks the recorded plan days in day
 * order and, for each day D that has a matching plan from day `D - lookbackDays`,
 * computes:
 *
 *   novelty(D) = 1 - |plan(D) ∩ plan(D - N)| / |plan(D)|
 *
 * The resulting metric captures how much today's plan differs from the plan
 * from N days ago (default N = 7, i.e. week-over-week).  Higher = more novel.
 *
 * Days that have no valid lookback match (too early in the run, or either
 * plan is empty) are counted in `skippedDays` and excluded from aggregation.
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics } from '../profiles/types';

/** Default number of days to look back when comparing plans. */
const DEFAULT_LOOKBACK_DAYS = 7;

interface PlanRecord {
  dayIndex: number;
  recipeIds: string[];
}

export class DiversityTracker implements MetricTracker {
  readonly name = 'diversity';

  /** Number of days to look back when comparing plans. */
  readonly lookbackDays: number;

  private plans: PlanRecord[] = [];

  constructor(lookbackDays: number = DEFAULT_LOOKBACK_DAYS) {
    this.lookbackDays = lookbackDays;
  }

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    if (!snapshot.mealPlanGenerated) return;

    const recipes = snapshot.stateAfter.currentMealPlan;
    const recipeIds = recipes.map(r => r.id);

    this.plans.push({ dayIndex: snapshot.dayIndex, recipeIds });
  }

  finalize(): QualityMetrics['diversity'] {
    // Index plans by their dayIndex for O(1) lookback lookups.
    const plansByDay = new Map<number, PlanRecord>();
    for (const plan of this.plans) {
      plansByDay.set(plan.dayIndex, plan);
    }

    // Iterate the recorded days in day-index order so that `perDay` is
    // deterministic regardless of record() call order.
    const orderedPlans = [...this.plans].sort(
      (a, b) => a.dayIndex - b.dayIndex,
    );

    const perDay: number[] = [];
    let skippedDays = 0;

    for (const today of orderedPlans) {
      const prior = plansByDay.get(today.dayIndex - this.lookbackDays);

      if (
        !prior ||
        today.recipeIds.length === 0 ||
        prior.recipeIds.length === 0
      ) {
        skippedDays += 1;
        continue;
      }

      const priorSet = new Set(prior.recipeIds);
      let overlap = 0;
      for (const id of today.recipeIds) {
        if (priorSet.has(id)) overlap += 1;
      }

      const novelty = 1 - overlap / today.recipeIds.length;
      perDay.push(novelty);
    }

    if (perDay.length === 0) {
      return {
        perDay: [],
        mean: NaN,
        std: NaN,
        min: NaN,
        max: NaN,
        lookbackDays: this.lookbackDays,
        skippedDays,
      };
    }

    const mean = perDay.reduce((a, b) => a + b, 0) / perDay.length;
    const std = computeStd(perDay, mean);
    const min = Math.min(...perDay);
    const max = Math.max(...perDay);

    return {
      perDay,
      mean,
      std,
      min,
      max,
      lookbackDays: this.lookbackDays,
      skippedDays,
    };
  }

  reset(): void {
    this.plans = [];
  }
}

/** Population standard deviation.  Returns NaN when fewer than 2 samples. */
function computeStd(values: number[], mean: number): number {
  if (values.length < 2) return NaN;
  const sumSq = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return Math.sqrt(sumSq / values.length);
}
