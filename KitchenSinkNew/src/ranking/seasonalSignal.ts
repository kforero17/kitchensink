import { RecipeHistoryItem } from '../utils/recipeHistory';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface SeasonalProfile {
  tagSeasonal: Map<string, Map<Season, number>>; // tag → season → cookCount
}

const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];

/**
 * Determines the meteorological season for a given date.
 * Mar-May = spring, Jun-Aug = summer, Sep-Nov = fall, Dec-Feb = winter.
 */
export function getSeason(date: Date): Season {
  const month = date.getMonth(); // 0-indexed: 0=Jan, 11=Dec
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

/**
 * Builds a seasonal profile from cooking history, counting how often each tag
 * was cooked in each season.
 */
export function buildSeasonalProfile(
  history: RecipeHistoryItem[],
  recipeTagLookup: Map<string, string[]>,
): SeasonalProfile {
  const tagSeasonal = new Map<string, Map<Season, number>>();

  for (const item of history) {
    const tags = recipeTagLookup.get(item.recipeId);
    if (!tags || tags.length === 0) continue;

    const season = getSeason(new Date(item.usedDate));

    for (const tag of tags) {
      let seasonMap = tagSeasonal.get(tag);
      if (!seasonMap) {
        seasonMap = new Map<Season, number>();
        tagSeasonal.set(tag, seasonMap);
      }
      seasonMap.set(season, (seasonMap.get(season) ?? 0) + 1);
    }
  }

  return { tagSeasonal };
}

/**
 * Computes how well a recipe's tags fit the current season based on the user's
 * historical cooking patterns.
 *
 * Returns a score in [0, 1]. Higher means the recipe's tags align with what the
 * user historically cooks in the given season.
 *
 * Falls back to 0.5 when the profile has fewer than 2 tags with seasonal data
 * that overlap with the recipe's tags.
 */
export function computeSeasonalFit(
  recipeTags: string[],
  profile: SeasonalProfile,
  currentSeason: Season,
): number {
  if (recipeTags.length === 0) return 0.5;

  let totalAffinity = 0;
  let tagsWithData = 0;

  for (const tag of recipeTags) {
    const seasonMap = profile.tagSeasonal.get(tag);
    if (!seasonMap) continue;

    let totalCooks = 0;
    for (const s of SEASONS) {
      totalCooks += seasonMap.get(s) ?? 0;
    }

    if (totalCooks === 0) continue;

    const seasonCooks = seasonMap.get(currentSeason) ?? 0;
    totalAffinity += seasonCooks / totalCooks;
    tagsWithData++;
  }

  if (tagsWithData < 2) return 0.5;

  return totalAffinity / tagsWithData;
}
