import { RecipeHistoryItem } from '../utils/recipeHistory';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface SeasonalProfile {
  tagSeasonal: Map<string, Map<Season, number>>; // tag → season → cookCount
}

const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'winter'];

// Cold-start prior, hand-curated, Northern-Hemisphere temperate-biased — see ASSUMPTIONS.md.
const SEASONAL_TAG_PRIOR: Record<string, Season> = {
  // Winter
  soup: 'winter', stew: 'winter', braised: 'winter', roast: 'winter',
  roasted: 'winter', baked: 'winter', comfort: 'winter', warm: 'winter',
  // Summer
  salad: 'summer', grilled: 'summer', grill: 'summer', bbq: 'summer',
  cold: 'summer', fresh: 'summer', light: 'summer', raw: 'summer',
  // Spring
  herb: 'spring', green: 'spring',
  // Fall
  squash: 'fall', pumpkin: 'fall', apple: 'fall', harvest: 'fall',
  cinnamon: 'fall',
};

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

interface HistoryAffinity {
  score: number;
  tagsWithData: number;
}

function computeHistoryAffinity(
  recipeTags: string[],
  profile: SeasonalProfile,
  currentSeason: Season,
): HistoryAffinity {
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

  const score = tagsWithData > 0 ? totalAffinity / tagsWithData : 0;
  return { score, tagsWithData };
}

interface PriorAffinity {
  score: number;
  matchedTags: number;
}

function computePriorAffinity(recipeTags: string[], season: Season): PriorAffinity {
  let total = 0;
  let matchedTags = 0;

  for (const tag of recipeTags) {
    const priorSeason = SEASONAL_TAG_PRIOR[tag.toLowerCase()];
    if (!priorSeason) continue;
    total += priorSeason === season ? 1 : 0;
    matchedTags++;
  }

  const score = matchedTags > 0 ? total / matchedTags : 0;
  return { score, matchedTags };
}

/**
 * Computes how well a recipe's tags fit the current season.
 *
 * Combines a personalized history-based signal with a hand-curated cold-start
 * prior so the ranker can steer by season even with no cooking history.
 *
 * Returns a score in [0, 1]. Falls back to 0.5 when neither source has signal.
 */
export function computeSeasonalFit(
  recipeTags: string[],
  profile: SeasonalProfile,
  currentSeason: Season,
): number {
  if (recipeTags.length === 0) return 0.5;

  const history = computeHistoryAffinity(recipeTags, profile, currentSeason);
  const prior = computePriorAffinity(recipeTags, currentSeason);

  const hasHistorySignal = history.tagsWithData >= 2;
  const hasPriorSignal = prior.matchedTags > 0;

  if (!hasHistorySignal && !hasPriorSignal) return 0.5;
  if (!hasHistorySignal) return prior.score;
  if (!hasPriorSignal) return history.score;
  return 0.7 * history.score + 0.3 * prior.score;
}

/**
 * Returns the prior-based seasonal affinity in isolation (no history).
 * Returns 0.5 when no recipe tag is in the prior.
 */
export function computePriorOnlyFit(tags: string[], season: Season): number {
  const prior = computePriorAffinity(tags, season);
  if (prior.matchedTags === 0) return 0.5;
  return prior.score;
}
