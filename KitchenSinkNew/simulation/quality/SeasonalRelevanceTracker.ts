/**
 * SeasonalRelevanceTracker - Measures how well recipes match the current season.
 *
 * Each season has a curated set of keywords (e.g. winter -> soup, stew, comfort).
 * When a meal plan is generated, the tracker checks every recipe's tags against
 * the season's keywords and records the fraction that match.
 *
 * Final metrics:
 *   meanMatchRate  -- overall average across all plan events
 *   perSeason      -- average match rate broken down by season
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics, Season } from '../profiles/types';

const SEASONAL_TAGS: Record<Season, string[]> = {
  winter: ['soup', 'stew', 'comfort', 'warm', 'roast', 'roasted', 'baked', 'braised'],
  summer: ['salad', 'grill', 'grilled', 'fresh', 'cold', 'light', 'bbq', 'raw'],
  spring: ['fresh', 'light', 'herb', 'green', 'salad'],
  fall: ['harvest', 'squash', 'pumpkin', 'apple', 'warm', 'roast', 'roasted', 'comfort'],
};

interface SeasonEntry {
  season: Season;
  matchRate: number;
}

export class SeasonalRelevanceTracker implements MetricTracker {
  readonly name = 'seasonalRelevance';

  private entries: SeasonEntry[] = [];

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    if (!snapshot.mealPlanGenerated) return;

    const season = snapshot.season;
    const seasonTags = new Set(SEASONAL_TAGS[season]);
    const recipes = snapshot.stateAfter.currentMealPlan;

    if (recipes.length === 0) {
      this.entries.push({ season, matchRate: 0 });
      return;
    }

    let matched = 0;
    for (const recipe of recipes) {
      const hasSeasonalTag = recipe.tags.some(tag =>
        seasonTags.has(tag.toLowerCase()),
      );
      if (hasSeasonalTag) {
        matched++;
      }
    }

    this.entries.push({ season, matchRate: matched / recipes.length });
  }

  finalize(): QualityMetrics['seasonalRelevance'] {
    if (this.entries.length === 0) {
      return {
        meanMatchRate: 0,
        perSeason: { spring: 0, summer: 0, fall: 0, winter: 0 },
      };
    }

    // Overall mean.
    const meanMatchRate =
      this.entries.reduce((sum, e) => sum + e.matchRate, 0) /
      this.entries.length;

    // Per-season averages.
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
          seasonEntries.reduce((sum, e) => sum + e.matchRate, 0) /
          seasonEntries.length;
      }
    }

    return { meanMatchRate, perSeason };
  }

  reset(): void {
    this.entries = [];
  }
}
