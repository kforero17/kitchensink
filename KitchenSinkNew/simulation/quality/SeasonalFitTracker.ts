/**
 * SeasonalFitTracker - Measures how well planned recipes match the current
 * season using the same prior-based signal that the ranker steers by.
 *
 * For each recipe in a generated meal plan we compute `computePriorOnlyFit`
 * (from the ranker's `seasonalSignal` module) against the day's season and
 * average across the plan.  This makes the simulation metric a faithful proxy
 * for the production ranker's seasonal affinity rather than a separate
 * keyword-overlap heuristic.
 *
 * Final metrics:
 *   meanFitScore - overall average across all plan events
 *   perSeason    - average fit score broken down by season
 *   meanRankBias - reserved; null until candidate-pool plumbing is added
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics, Season } from '../profiles/types';
import { computePriorOnlyFit } from '../../src/ranking/seasonalSignal';

interface SeasonEntry {
  season: Season;
  fitScore: number;
}

export class SeasonalFitTracker implements MetricTracker {
  readonly name = 'seasonalFitScore';

  private entries: SeasonEntry[] = [];

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    if (!snapshot.mealPlanGenerated) return;

    const season = snapshot.season;
    const recipes = snapshot.stateAfter.currentMealPlan;

    if (recipes.length === 0) {
      this.entries.push({ season, fitScore: 0 });
      return;
    }

    let totalFit = 0;
    for (const recipe of recipes) {
      totalFit += computePriorOnlyFit(recipe.tags ?? [], season);
    }

    this.entries.push({ season, fitScore: totalFit / recipes.length });
  }

  finalize(): QualityMetrics['seasonalFitScore'] {
    if (this.entries.length === 0) {
      return {
        meanFitScore: 0,
        perSeason: { spring: 0, summer: 0, fall: 0, winter: 0 },
        // stubbed; computing requires candidate-pool plumbing -- see QUESTIONS.md §4
        meanRankBias: null,
      };
    }

    const meanFitScore =
      this.entries.reduce((sum, e) => sum + e.fitScore, 0) /
      this.entries.length;

    const perSeason: Record<Season, number> = {
      spring: 0,
      summer: 0,
      fall: 0,
      winter: 0,
    };

    const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];
    for (const s of seasons) {
      const seasonEntries = this.entries.filter(e => e.season === s);
      if (seasonEntries.length === 0) {
        perSeason[s] = 0;
      } else {
        perSeason[s] =
          seasonEntries.reduce((sum, e) => sum + e.fitScore, 0) /
          seasonEntries.length;
      }
    }

    // stubbed; computing requires candidate-pool plumbing -- see QUESTIONS.md §4
    return { meanFitScore, perSeason, meanRankBias: null };
  }

  reset(): void {
    this.entries = [];
  }
}
