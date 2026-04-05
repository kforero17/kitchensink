import { RecipeHistoryItem } from '../utils/recipeHistory';

export interface TemporalProfile {
  dayMealFrequency: Map<number, Map<string, number>>; // day 0=Sun..6=Sat, mealType → frequency
  dayActivity: Map<number, number>; // day → total recipes cooked
  totalWeeks: number;
}

const MEAL_TYPE_TAGS = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'snacks']);

const MINIMUM_WEEKS_THRESHOLD = 4;

/**
 * Builds a temporal profile from recipe usage history.
 * Aggregates how often the user cooks each meal type on each day of the week.
 */
export function buildTemporalProfile(history: RecipeHistoryItem[]): TemporalProfile {
  const dayMealFrequency = new Map<number, Map<string, number>>();
  const dayActivity = new Map<number, number>();

  // Initialise all 7 days
  for (let d = 0; d < 7; d++) {
    dayMealFrequency.set(d, new Map<string, number>());
    dayActivity.set(d, 0);
  }

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const item of history) {
    const date = new Date(item.usedDate);
    const day = date.getDay(); // 0=Sun, 6=Sat

    // Track date range
    if (minDate === null || date < minDate) {
      minDate = date;
    }
    if (maxDate === null || date > maxDate) {
      maxDate = date;
    }

    // Increment day activity
    dayActivity.set(day, (dayActivity.get(day) ?? 0) + 1);

    // Increment meal type frequency for this day
    const mealType = normalizeMealType(item.mealType);
    if (mealType) {
      const mealMap = dayMealFrequency.get(day)!;
      mealMap.set(mealType, (mealMap.get(mealType) ?? 0) + 1);
    }
  }

  const totalWeeks = computeTotalWeeks(minDate, maxDate);

  return { dayMealFrequency, dayActivity, totalWeeks };
}

/**
 * Computes how well a recipe fits the user's temporal cooking patterns for a given day.
 *
 * Returns a score in [0, 1]. Higher means the user historically cooks this meal type
 * on the target day. Returns 0.5 when there is insufficient history (< 4 weeks).
 */
export function computeTemporalFit(
  recipeTags: string[],
  profile: TemporalProfile,
  targetDay: number,
): number {
  if (profile.totalWeeks < MINIMUM_WEEKS_THRESHOLD) {
    return 0.5;
  }

  const mealType = extractMealType(recipeTags);
  if (!mealType) {
    return 0.5;
  }

  const totalActivityOnDay = profile.dayActivity.get(targetDay) ?? 0;
  if (totalActivityOnDay === 0) {
    return 0.0;
  }

  const mealFrequency = profile.dayMealFrequency.get(targetDay)?.get(mealType) ?? 0;

  return mealFrequency / totalActivityOnDay;
}

// ---------- helpers ---------- //

/**
 * Normalises a meal type string. Maps 'snacks' to 'snack' for consistency.
 * Returns null if the meal type is not recognised.
 */
function normalizeMealType(mealType: string): string | null {
  const lower = mealType.toLowerCase().trim();
  if (lower === 'snacks') {
    return 'snack';
  }
  if (MEAL_TYPE_TAGS.has(lower)) {
    return lower;
  }
  return null;
}

/**
 * Extracts the meal type from recipe tags. Returns the first recognised
 * meal type tag, normalised ('snacks' -> 'snack'). Returns null if none found.
 */
function extractMealType(tags: string[]): string | null {
  for (const tag of tags) {
    const normalised = normalizeMealType(tag);
    if (normalised) {
      return normalised;
    }
  }
  return null;
}

/**
 * Computes the number of weeks spanned by the date range.
 * Returns 0 for null inputs. Minimum 1 week if there is any range.
 */
function computeTotalWeeks(minDate: Date | null, maxDate: Date | null): number {
  if (!minDate || !maxDate) {
    return 0;
  }
  const diffMs = maxDate.getTime() - minDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.ceil(diffDays / 7));
}
