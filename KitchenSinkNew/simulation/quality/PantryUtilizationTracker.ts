/**
 * PantryUtilizationTracker - Measures how well meal plans leverage pantry items.
 *
 * For each plan-generation event the tracker counts how many pantry items are
 * referenced by at least one recipe ingredient (using token overlap on
 * normalised names).  The per-plan utilization is:
 *
 *   utilization = matchedPantryItems / totalPantryItems
 *
 * At finalization the tracker returns the mean utilization, a linear-regression
 * trend slope (positive = improving over time), and the per-plan array.
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics } from '../profiles/types';
import { normalizeIngredientName } from '../bridge/appImports';

export class PantryUtilizationTracker implements MetricTracker {
  readonly name = 'pantryUtilization';

  private perPlan: number[] = [];

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    if (!snapshot.mealPlanGenerated) return;

    const pantry = snapshot.stateAfter.pantryItems;
    const recipes = snapshot.stateAfter.currentMealPlan;

    if (pantry.length === 0) {
      // Nothing to utilise -- treat as perfect utilization.
      this.perPlan.push(1.0);
      return;
    }

    // Build a set of normalised ingredient-name tokens across all recipes.
    const recipeTokens = new Set<string>();
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        const tokens = tokenize(normalizeIngredientName(ing.name));
        for (const t of tokens) {
          recipeTokens.add(t);
        }
      }
    }

    // Count pantry items that share at least one meaningful token with recipes.
    let matched = 0;
    for (const item of pantry) {
      const pantryTokens = tokenize(normalizeIngredientName(item.name));
      const hasOverlap = pantryTokens.some(t => recipeTokens.has(t));
      if (hasOverlap) {
        matched++;
      }
    }

    this.perPlan.push(matched / pantry.length);
  }

  finalize(): QualityMetrics['pantryUtilization'] {
    if (this.perPlan.length === 0) {
      return { mean: 0, trend: 0, perPlan: [] };
    }

    const mean =
      this.perPlan.reduce((a, b) => a + b, 0) / this.perPlan.length;
    const trend = linearRegressionSlope(this.perPlan);

    return { mean, trend, perPlan: [...this.perPlan] };
  }

  reset(): void {
    this.perPlan = [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a normalised ingredient name into meaningful tokens.
 * Filters out very short words (<=2 chars) that add noise.
 */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/**
 * Compute the slope of a simple linear regression (OLS) of `ys` against their
 * zero-based index.
 *
 *   slope = (n * SUM(x*y) - SUM(x) * SUM(y)) / (n * SUM(x^2) - (SUM(x))^2)
 */
function linearRegressionSlope(ys: number[]): number {
  const n = ys.length;
  if (n <= 1) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i];
    sumXY += i * ys[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}
