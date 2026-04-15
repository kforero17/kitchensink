/**
 * DiversityTracker - Measures recipe diversity over sliding 14-day windows.
 *
 * For every day a meal plan is generated the tracker stores the set of recipe
 * IDs and their cuisine tags.  At finalization it walks a sliding window of
 * size `WINDOW_SIZE` across the recorded plan-days and computes:
 *
 *   diversity = uniqueRecipeIds / totalRecipeSlots
 *
 * The result exposes mean, min, max across all windows plus the per-window
 * breakdown.
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics } from '../profiles/types';

/** Number of plan-generation events per sliding window. */
const WINDOW_SIZE = 14;

/**
 * Known cuisine keywords used to extract cuisine tags from a recipe's generic
 * tag list.  We lowercase both sides when matching.
 */
const CUISINE_KEYWORDS: ReadonlySet<string> = new Set([
  'italian', 'mexican', 'chinese', 'japanese', 'indian', 'thai',
  'french', 'greek', 'korean', 'vietnamese', 'spanish', 'mediterranean',
  'middle eastern', 'american', 'british', 'german', 'african',
  'caribbean', 'brazilian', 'turkish', 'ethiopian', 'peruvian',
  'moroccan', 'lebanese', 'cuban', 'filipino', 'indonesian',
  'malaysian', 'cajun', 'creole', 'southern', 'tex-mex',
  'latin', 'asian', 'european', 'nordic', 'hawaiian',
]);

interface PlanRecord {
  dayIndex: number;
  recipeIds: string[];
  cuisines: string[];
}

export class DiversityTracker implements MetricTracker {
  readonly name = 'diversity';

  private plans: PlanRecord[] = [];

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    if (!snapshot.mealPlanGenerated) return;

    const recipes = snapshot.stateAfter.currentMealPlan;
    const recipeIds = recipes.map(r => r.id);

    const cuisines: string[] = [];
    for (const recipe of recipes) {
      for (const tag of recipe.tags) {
        const lower = tag.toLowerCase();
        if (CUISINE_KEYWORDS.has(lower) && !cuisines.includes(lower)) {
          cuisines.push(lower);
        }
      }
    }

    this.plans.push({ dayIndex: snapshot.dayIndex, recipeIds, cuisines });
  }

  finalize(): QualityMetrics['diversity'] {
    if (this.plans.length === 0) {
      return { mean: 1.0, min: 1.0, max: 1.0, perWindow: [] };
    }

    const perWindow: number[] = [];

    // Slide a window of WINDOW_SIZE plan events across all recorded plans.
    const windowCount = Math.max(1, this.plans.length - WINDOW_SIZE + 1);

    for (let start = 0; start < windowCount; start++) {
      const end = Math.min(start + WINDOW_SIZE, this.plans.length);
      const windowPlans = this.plans.slice(start, end);

      const allIds: string[] = [];
      for (const plan of windowPlans) {
        allIds.push(...plan.recipeIds);
      }

      if (allIds.length === 0) {
        perWindow.push(1.0);
        continue;
      }

      const uniqueCount = new Set(allIds).size;
      perWindow.push(uniqueCount / allIds.length);
    }

    const mean = perWindow.reduce((a, b) => a + b, 0) / perWindow.length;
    const min = Math.min(...perWindow);
    const max = Math.max(...perWindow);

    return { mean, min, max, perWindow };
  }

  reset(): void {
    this.plans = [];
  }
}
