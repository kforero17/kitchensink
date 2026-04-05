import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { FIRESTORE_PATHS } from '../types/FirestoreSchema';
import logger from '../utils/logger';
import { safeStorage } from '../utils/asyncStorageUtils';
import { RecipeHistoryItem } from '../utils/recipeHistory';
import { UnifiedRecipe } from '../shared/interfaces';
import {
  WeeklyInsightsData,
  WeeklyWasteData,
  WeeklySpendData,
  NutritionSummary,
  StreakData,
} from '../types/InsightsData';
import { STORAGE_KEYS } from '../constants/storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEAL_PLAN_KEY = 'current_meal_plan';
const WEEKS_TO_FETCH = 8;

/** Estimated cost per item by pantry/grocery category (USD). */
const CATEGORY_COST_MAP: Record<string, number> = {
  produce: 3,
  dairy: 4,
  meat: 8,
  seafood: 10,
  bakery: 3,
  frozen: 5,
  beverages: 3,
  snacks: 4,
  condiments: 3,
  grains: 2,
  other: 3,
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Returns the Monday 00:00:00 of the ISO week that contains `date`.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday (0) should map to the previous Monday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns a short human-readable label for a week, e.g. "Mar 3".
 */
function getWeekLabel(date: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Returns an ISO-style key for a week: "YYYY-Www" (e.g. "2026-W14").
 * Used for grouping and streak counting.
 */
function weekKey(date: Date): string {
  const monday = getWeekStart(date);
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor(
    (monday.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNum = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Groups items by their ISO week key. The `getDate` callback extracts the
 * relevant Date from each item.
 */
function groupByWeek<T>(
  items: T[],
  getDate: (item: T) => Date,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = weekKey(getDate(item));
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/**
 * Looks up the estimated cost for a single item based on its category.
 */
function estimateCostByCategory(category: string): number {
  const normalized = (category || '').toLowerCase().trim();
  return CATEGORY_COST_MAP[normalized] ?? CATEGORY_COST_MAP.other;
}

/**
 * Builds a default (empty) `WeeklyInsightsData` object to return when there
 * is no data or an error occurs.
 */
function buildDefaultInsights(): WeeklyInsightsData {
  const emptyWeeks = buildEmptyWeekLabels();
  return {
    wasteAvoided: {
      thisWeekSaved: 0,
      lastWeekSaved: 0,
      weeklyTrend: emptyWeeks.map(label => ({ weekLabel: label, amountSaved: 0 })),
    },
    spendingTrends: {
      thisWeekSpend: 0,
      averageWeeklySpend: 0,
      weeklyTrend: emptyWeeks.map(label => ({ weekLabel: label, estimatedSpend: 0 })),
    },
    nutrition: null,
    streak: { currentStreak: 0, longestStreak: 0 },
    recipesThisWeek: 0,
  };
}

function buildEmptyWeekLabels(): string[] {
  const labels: string[] = [];
  for (let i = WEEKS_TO_FETCH - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    labels.push(getWeekLabel(d));
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Data fetchers (private)
// ---------------------------------------------------------------------------

/**
 * Fetches pantry items updated within the last `WEEKS_TO_FETCH` weeks and
 * computes per-week waste-avoided savings.
 *
 * Heuristic: items with status !== 'expired' that were updated in the window
 * are considered "used in time" and their estimated category cost counts as
 * savings. Items with status === 'expired' are treated as wasted.
 */
async function fetchWasteAvoided(
  uid: string,
): Promise<WeeklyInsightsData['wasteAvoided']> {
  const now = new Date();
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - WEEKS_TO_FETCH * 7);

  const snapshot = await firestore()
    .collection(FIRESTORE_PATHS.USERS)
    .doc(uid)
    .collection(FIRESTORE_PATHS.PANTRY_ITEMS)
    .where('updatedAt', '>=', firestore.Timestamp.fromDate(eightWeeksAgo))
    .get();

  const weekSavingsMap = new Map<string, number>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data) continue;

    const status = typeof data.status === 'string' ? data.status : 'normal';
    const category = typeof data.category === 'string' ? data.category : 'other';
    const cost = estimateCostByCategory(category);

    const updatedAt =
      data.updatedAt && typeof data.updatedAt.toDate === 'function'
        ? (data.updatedAt.toDate() as Date)
        : now;
    const key = weekKey(updatedAt);

    // Items NOT expired count as "saved" (used in time).
    if (status !== 'expired') {
      weekSavingsMap.set(key, (weekSavingsMap.get(key) ?? 0) + cost);
    }
  }

  // Build the ordered trend array for the last 8 weeks (oldest first).
  const weeklyTrend: WeeklyWasteData[] = [];
  for (let i = WEEKS_TO_FETCH - 1; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - i * 7);
    const monday = getWeekStart(weekDate);
    const key = weekKey(monday);
    weeklyTrend.push({
      weekLabel: getWeekLabel(monday),
      amountSaved: weekSavingsMap.get(key) ?? 0,
    });
  }

  const thisWeekKey = weekKey(now);
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekKey = weekKey(lastWeekDate);

  return {
    thisWeekSaved: weekSavingsMap.get(thisWeekKey) ?? 0,
    lastWeekSaved: weekSavingsMap.get(lastWeekKey) ?? 0,
    weeklyTrend,
  };
}

/**
 * Fetches grocery lists created in the last 8 weeks and estimates spending
 * per week based on item categories.
 */
async function fetchSpendingTrends(
  uid: string,
): Promise<WeeklyInsightsData['spendingTrends']> {
  const now = new Date();
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - WEEKS_TO_FETCH * 7);

  const snapshot = await firestore()
    .collection(FIRESTORE_PATHS.USERS)
    .doc(uid)
    .collection(FIRESTORE_PATHS.GROCERY_LISTS)
    .where('createdAt', '>=', firestore.Timestamp.fromDate(eightWeeksAgo))
    .get();

  const weekSpendMap = new Map<string, number>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data) continue;

    const createdAt =
      data.createdAt && typeof data.createdAt.toDate === 'function'
        ? (data.createdAt.toDate() as Date)
        : now;
    const key = weekKey(createdAt);

    const items = Array.isArray(data.items) ? data.items : [];
    let listCost = 0;
    for (const item of items) {
      const category =
        item && typeof item.category === 'string' ? item.category : 'other';
      listCost += estimateCostByCategory(category);
    }

    weekSpendMap.set(key, (weekSpendMap.get(key) ?? 0) + listCost);
  }

  // Build ordered trend (oldest first).
  const weeklyTrend: WeeklySpendData[] = [];
  for (let i = WEEKS_TO_FETCH - 1; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - i * 7);
    const monday = getWeekStart(weekDate);
    const key = weekKey(monday);
    weeklyTrend.push({
      weekLabel: getWeekLabel(monday),
      estimatedSpend: weekSpendMap.get(key) ?? 0,
    });
  }

  const thisWeekKey = weekKey(now);
  const totalSpend = weeklyTrend.reduce((sum, w) => sum + w.estimatedSpend, 0);

  return {
    thisWeekSpend: weekSpendMap.get(thisWeekKey) ?? 0,
    averageWeeklySpend: weeklyTrend.length > 0 ? totalSpend / weeklyTrend.length : 0,
    weeklyTrend,
  };
}

/**
 * Reads the current meal plan from AsyncStorage, matches this week's recipe
 * ids, and aggregates nutrition data. Falls back to Firestore for any recipes
 * not found locally.
 */
async function fetchNutritionSummary(
  thisWeekRecipeIds: string[],
): Promise<NutritionSummary | null> {
  if (thisWeekRecipeIds.length === 0) {
    return null;
  }

  // Try to load the current meal plan from AsyncStorage (it contains full
  // recipe objects with nutrition data).
  let recipes: UnifiedRecipe[] = [];
  try {
    const mealPlanData = await safeStorage.getItem(MEAL_PLAN_KEY);
    if (mealPlanData) {
      const parsed = JSON.parse(mealPlanData);
      if (Array.isArray(parsed)) {
        recipes = parsed as UnifiedRecipe[];
      }
    }
  } catch {
    // Fall through -- we will try Firestore next.
  }

  // Filter to only recipes used this week.
  const idSet = new Set(thisWeekRecipeIds);
  const matched: UnifiedRecipe[] = recipes.filter(r => r && idSet.has(r.id));

  // If the meal plan didn't cover some ids, try fetching from Firestore.
  if (matched.length < thisWeekRecipeIds.length) {
    const uid = auth().currentUser?.uid;
    if (uid) {
      const foundIds = new Set(matched.map(r => r.id));
      const missingIds = thisWeekRecipeIds.filter(id => !foundIds.has(id));
      try {
        for (const recipeId of missingIds) {
          const doc = await firestore()
            .collection(FIRESTORE_PATHS.USERS)
            .doc(uid)
            .collection(FIRESTORE_PATHS.RECIPES)
            .doc(recipeId)
            .get();
          if (doc.exists) {
            const data = doc.data();
            if (data?.nutrition) {
              matched.push({
                id: recipeId,
                nutrition: data.nutrition,
              } as UnifiedRecipe);
            }
          }
        }
      } catch (err) {
        logger.error('[insightsService] Error fetching recipe nutrition from Firestore', err);
      }
    }
  }

  // Aggregate macros from matched recipes that have nutrition data.
  const withNutrition = matched.filter(r => r.nutrition);
  if (withNutrition.length === 0) {
    return null;
  }

  let totalCalories = 0;
  let proteinGrams = 0;
  let fatGrams = 0;
  let carbsGrams = 0;

  for (const recipe of withNutrition) {
    const n = recipe.nutrition!;
    totalCalories += typeof n.calories === 'number' ? n.calories : 0;
    proteinGrams += typeof n.protein === 'number' ? n.protein : 0;
    fatGrams += typeof n.fat === 'number' ? n.fat : 0;
    carbsGrams += typeof n.carbs === 'number' ? n.carbs : 0;
  }

  return {
    totalCalories,
    avgCaloriesPerDay: Math.round(totalCalories / 7),
    proteinGrams,
    fatGrams,
    carbsGrams,
  };
}

/**
 * Computes the current and longest cooking streak (consecutive weeks with
 * at least one recipe cooked).
 */
function computeStreaks(history: RecipeHistoryItem[]): StreakData {
  if (history.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Collect unique week keys from the history.
  const weekKeys = new Set<string>();
  for (const item of history) {
    const d = new Date(item.usedDate);
    if (!isNaN(d.getTime())) {
      weekKeys.add(weekKey(d));
    }
  }

  if (weekKeys.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Walk backwards from the current week to compute streaks.
  const now = new Date();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (let i = 0; i < 52; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = weekKey(d);

    if (weekKeys.has(key)) {
      streak++;
      if (streak > longestStreak) {
        longestStreak = streak;
      }
      // The current streak is the unbroken run starting from this week (i === 0).
      if (i === streak - 1) {
        currentStreak = streak;
      }
    } else {
      streak = 0;
    }
  }

  return { currentStreak, longestStreak };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches and aggregates all data required for the Weekly Insights Dashboard.
 *
 * Returns a fully populated `WeeklyInsightsData` object. On any error the
 * function returns a safe default with zeroed values rather than throwing.
 */
export async function fetchWeeklyInsights(): Promise<WeeklyInsightsData> {
  try {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      logger.warn('[insightsService] No authenticated user, returning defaults');
      return buildDefaultInsights();
    }

    // Load recipe history from AsyncStorage.
    let recipeHistory: RecipeHistoryItem[] = [];
    try {
      const historyData = await safeStorage.getItem(STORAGE_KEYS.RECIPE_HISTORY);
      if (historyData) {
        const parsed = JSON.parse(historyData);
        if (Array.isArray(parsed)) {
          recipeHistory = parsed as RecipeHistoryItem[];
        }
      }
    } catch {
      logger.error('[insightsService] Failed to parse recipe history');
    }

    // Determine this week's recipe ids and count.
    const thisWeekStart = getWeekStart(new Date());
    const thisWeekRecipes = recipeHistory.filter(item => {
      const d = new Date(item.usedDate);
      return !isNaN(d.getTime()) && d >= thisWeekStart;
    });
    const thisWeekRecipeIds = thisWeekRecipes.map(r => r.recipeId);

    // Fire independent data fetches in parallel.
    const [wasteAvoided, spendingTrends, nutrition] = await Promise.all([
      fetchWasteAvoided(uid),
      fetchSpendingTrends(uid),
      fetchNutritionSummary(thisWeekRecipeIds),
    ]);

    const streak = computeStreaks(recipeHistory);

    return {
      wasteAvoided,
      spendingTrends,
      nutrition,
      streak,
      recipesThisWeek: thisWeekRecipeIds.length,
    };
  } catch (error) {
    logger.error('[insightsService] Unexpected error fetching weekly insights', error);
    return buildDefaultInsights();
  }
}
