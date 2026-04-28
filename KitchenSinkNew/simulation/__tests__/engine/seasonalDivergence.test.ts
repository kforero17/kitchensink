import { MealPlanAction } from '../../actions/MealPlanAction';
import { ActionContext } from '../../actions/ActionExecutor';
import { SimulationProfile, DayState } from '../../profiles/types';
import { UnifiedRecipe } from '../../bridge/appImports';

const WINTER_TAGS = ['soup', 'stew', 'baked', 'comfort'];
const SUMMER_TAGS = ['salad', 'grilled', 'fresh', 'bbq'];
const NEUTRAL_TAGS = ['quick', 'family', 'easy', 'classic', 'weeknight'];

function recipe(id: string, tags: string[]): UnifiedRecipe {
  return {
    id,
    source: 'tasty',
    title: id,
    imageUrl: '',
    readyInMinutes: 30,
    servings: 4,
    ingredients: [{ name: 'water', amount: 1, unit: 'cup' }],
    tags,
  };
}

function buildPool(): UnifiedRecipe[] {
  const pool: UnifiedRecipe[] = [];
  WINTER_TAGS.forEach((tag, i) => {
    pool.push(recipe(`winter-${i + 1}`, [tag]));
    pool.push(recipe(`winter-${i + 5}`, [tag, 'family']));
  });
  SUMMER_TAGS.forEach((tag, i) => {
    pool.push(recipe(`summer-${i + 1}`, [tag]));
    pool.push(recipe(`summer-${i + 5}`, [tag, 'easy']));
  });
  NEUTRAL_TAGS.forEach((tag, i) => {
    pool.push(recipe(`neutral-${i + 1}`, [tag]));
  });
  return pool;
}

function makeFirestore(pool: UnifiedRecipe[]) {
  const saved: any[] = [];
  return {
    saved,
    stub: {
      getAllRecipes: jest.fn().mockResolvedValue(pool),
      resetWeeklyMealPlanFlags: jest.fn().mockResolvedValue(undefined),
      saveRecipe: jest.fn().mockImplementation(async (_uid: string, r: any) => {
        saved.push(r);
        return r.id;
      }),
    } as any,
  };
}

function makeProfile(): SimulationProfile {
  return {
    id: 'p1',
    name: 'Tester',
    uid: 'uid-1',
    preferences: {
      dietary: {
        vegetarian: false,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
        nutFree: false,
        lowCarb: false,
        allergies: [],
        restrictions: [],
      },
      food: {
        favoriteCuisines: [],
        dislikedIngredients: [],
        favoriteIngredients: [],
        preferredCuisines: [],
      } as any,
      cooking: {
        cookingFrequency: 'daily',
        preferredCookingDuration: 'under_30_min',
        skillLevel: 'intermediate',
        mealTypes: ['dinner'],
        servingSizePreference: 4,
        weeklyMealPrepCount: 5,
        householdSize: 2,
        kitchenInstruments: ['stove_top', 'oven'],
      },
      budget: { weeklyBudget: 100, budgetFrequency: 'weekly' } as any,
    },
    engagementTier: 'high',
    startingPantry: [],
    simulationStartDate: '2026-01-01',
    seed: 1,
  };
}

function emptyDayState(): DayState {
  return {
    pantryItems: [],
    leftovers: [],
    currentMealPlan: [],
    recipeHistory: [],
    feedbackHistory: [],
    cookedToday: [],
  };
}

async function runPlan(currentDate: Date, pool: UnifiedRecipe[]): Promise<string[]> {
  const { stub } = makeFirestore(pool);
  const action = new MealPlanAction();
  const ctx: ActionContext = {
    profile: makeProfile(),
    uid: 'uid-1',
    currentDate,
    dayIndex: 0,
    firestore: stub,
    currentState: emptyDayState(),
    rng: () => 0,
  };
  const result = await action.execute(ctx);
  expect(result.success).toBe(true);
  return result.data!.recipeIds as string[];
}

function tagsOf(id: string, pool: UnifiedRecipe[]): string[] {
  const r = pool.find(x => x.id === id);
  return r ? r.tags : [];
}

function countSeason(ids: string[], pool: UnifiedRecipe[], seasonTags: string[]): number {
  return ids.filter(id =>
    tagsOf(id, pool).some(t => seasonTags.includes(t.toLowerCase())),
  ).length;
}

function overlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  const intersect = a.filter(id => setB.has(id)).length;
  return intersect / Math.max(a.length, b.length);
}

describe('MealPlanAction seasonal cold-start prior', () => {
  it('selects different recipes in winter vs summer for an empty-history persona', async () => {
    const pool = buildPool();

    const winterIds = await runPlan(new Date('2026-01-15T12:00:00Z'), pool);

    const summerIds = await runPlan(new Date('2026-07-15T12:00:00Z'), pool);

    expect(winterIds.length).toBe(5);
    expect(summerIds.length).toBe(5);
    expect(overlap(winterIds, summerIds)).toBeLessThan(0.6);

    const winterRunWinterCount = countSeason(winterIds, pool, WINTER_TAGS);
    const summerRunWinterCount = countSeason(summerIds, pool, WINTER_TAGS);
    expect(winterRunWinterCount).toBeGreaterThan(summerRunWinterCount);

    const summerRunSummerCount = countSeason(summerIds, pool, SUMMER_TAGS);
    const winterRunSummerCount = countSeason(winterIds, pool, SUMMER_TAGS);
    expect(summerRunSummerCount).toBeGreaterThan(winterRunSummerCount);
  });
});
