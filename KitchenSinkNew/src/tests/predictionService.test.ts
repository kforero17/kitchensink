import { UnifiedRecipe } from '../shared/interfaces';
import { Leftover } from '../types/Leftover';
import { RecipeHistoryItem } from '../utils/recipeHistory';
import { ScoredRecipe } from '../ranking/rankRecipes';
import { FeatureVector } from '../ranking/featureEngineering';

// ---- Module mocks must be declared before imports that use them ---- //

const mockGetRecipeHistory = jest.fn<Promise<RecipeHistoryItem[]>, []>();
const mockGetActiveLeftovers = jest.fn<Promise<Leftover[]>, []>();
const mockGetPantryItems = jest.fn<Promise<Array<{ id: string; name: string; quantity: number; unit: string; category: string; expirationDate?: string }>>, [string]>();
const mockGenerateRecipeCandidates = jest.fn<Promise<UnifiedRecipe[]>, [Record<string, unknown>]>();
const mockRankRecipes = jest.fn<ScoredRecipe[], [UnifiedRecipe[], Record<string, unknown>]>();
const mockGetUserFeedbackHistory = jest.fn<Promise<Array<Record<string, unknown>>>, [number?]>();

jest.mock('../utils/recipeHistory', () => ({
  getRecipeHistory: mockGetRecipeHistory,
}));

jest.mock('../services/leftoverService', () => ({
  getActiveLeftovers: mockGetActiveLeftovers,
}));

jest.mock('../services/pantryService', () => ({
  getPantryItems: mockGetPantryItems,
}));

jest.mock('../candidate-generation/candidateGenerationService', () => ({
  generateRecipeCandidates: mockGenerateRecipeCandidates,
}));

jest.mock('../ranking/rankRecipes', () => ({
  rankRecipes: mockRankRecipes,
}));

jest.mock('../ranking/feedbackSignal', () => ({
  buildFeedbackMap: jest.fn(() => new Map()),
  buildSeenRecipeIds: jest.fn(() => new Set()),
}));

jest.mock('../services/recipeFeedbackService', () => ({
  recipeFeedbackService: {
    getUserFeedbackHistory: mockGetUserFeedbackHistory,
  },
}));

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'test-user-123' },
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

import { predictTodaysMeals, PredictedMeal } from '../services/predictionService';
import { UserPreferences } from '../types/FirestoreSchema';

// ---- Helpers ---- //

function makeRecipe(overrides: Partial<UnifiedRecipe> = {}): UnifiedRecipe {
  return {
    id: overrides.id ?? 'recipe-1',
    source: 'tasty',
    title: overrides.title ?? 'Test Recipe',
    imageUrl: 'https://example.com/img.jpg',
    readyInMinutes: 30,
    servings: 4,
    ingredients: overrides.ingredients ?? [
      { name: 'chicken', amount: 1, unit: 'lb' },
      { name: 'rice', amount: 2, unit: 'cups' },
    ],
    tags: overrides.tags ?? ['dinner'],
    popularityScore: 0.7,
    ...overrides,
  };
}

function makeFeatureVector(overrides: Partial<FeatureVector> = {}): FeatureVector {
  return {
    sim: 0.6,
    pantry: 0.5,
    popularity: 0.7,
    novelty: 1,
    sourceBias: 0,
    expiryUrgency: 0,
    feedback: 0,
    temporalFit: 0.5,
    seasonalFit: 0.5,
    leftoverAware: 0,
    ...overrides,
  };
}

function makeScoredRecipe(
  recipe: UnifiedRecipe,
  features: Partial<FeatureVector> = {},
  score?: number,
): ScoredRecipe {
  const feats = makeFeatureVector(features);
  return {
    recipe,
    features: feats,
    score: score ?? 0.6,
  };
}

function makeHistoryItem(overrides: Partial<RecipeHistoryItem> = {}): RecipeHistoryItem {
  return {
    recipeId: overrides.recipeId ?? 'recipe-1',
    usedDate: overrides.usedDate ?? '2026-03-15T12:00:00.000Z',
    mealType: overrides.mealType ?? 'dinner',
    ...overrides,
  };
}

function makePrefs(): UserPreferences {
  return {
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
      favoriteIngredients: ['chicken', 'rice'],
      dislikedIngredients: [],
      preferredCuisines: ['italian'],
      allergies: [],
    },
    cooking: {
      cookingFrequency: 'daily',
      preferredCookingDuration: 'under_30_min',
      skillLevel: 'intermediate',
      mealTypes: ['breakfast', 'lunch', 'dinner'],
      servingSizePreference: 4,
      weeklyMealPrepCount: 5,
      householdSize: 2,
    },
    budget: {
      amount: 100,
      frequency: 'weekly',
    },
    createdAt: {} as never,
    updatedAt: {} as never,
  };
}

function setupDefaultMocks(
  scoredRecipes: ScoredRecipe[],
  history: RecipeHistoryItem[] = [makeHistoryItem()],
): void {
  mockGetRecipeHistory.mockResolvedValue(history);
  mockGetActiveLeftovers.mockResolvedValue([]);
  mockGetPantryItems.mockResolvedValue([]);
  mockGenerateRecipeCandidates.mockResolvedValue(
    scoredRecipes.map(sr => sr.recipe),
  );
  mockRankRecipes.mockReturnValue(scoredRecipes);
  mockGetUserFeedbackHistory.mockResolvedValue([]);
}

// ---- Tests ---- //

describe('predictTodaysMeals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return predictions grouped by meal type', async () => {
    const breakfastRecipe = makeRecipe({ id: 'b1', title: 'Pancakes', tags: ['breakfast'] });
    const lunchRecipe = makeRecipe({ id: 'l1', title: 'Caesar Salad', tags: ['lunch'] });
    const dinnerRecipe = makeRecipe({ id: 'd1', title: 'Grilled Chicken', tags: ['dinner'] });

    const scored = [
      makeScoredRecipe(breakfastRecipe, { sim: 0.8, pantry: 0.7, temporalFit: 0.7, seasonalFit: 0.6 }, 0.7),
      makeScoredRecipe(lunchRecipe, { sim: 0.7, pantry: 0.6, temporalFit: 0.6, seasonalFit: 0.5 }, 0.6),
      makeScoredRecipe(dinnerRecipe, { sim: 0.6, pantry: 0.5, temporalFit: 0.5, seasonalFit: 0.5 }, 0.5),
    ];

    setupDefaultMocks(scored);

    const results = await predictTodaysMeals(makePrefs());

    const mealTypes = results.map(r => r.mealType);
    expect(mealTypes).toContain('breakfast');
    expect(mealTypes).toContain('lunch');
    expect(mealTypes).toContain('dinner');
    expect(results.length).toBe(3);
  });

  it('should exclude predictions below the confidence threshold of 0.3', async () => {
    const dinnerRecipe = makeRecipe({ id: 'd1', title: 'Weak Recipe', tags: ['dinner'] });

    const scored = [
      makeScoredRecipe(dinnerRecipe, {
        sim: 0.1,
        pantry: 0.05,
        popularity: 0.1,
        novelty: 0,
        expiryUrgency: 0,
        feedback: 0,
        temporalFit: 0.1,
        seasonalFit: 0.1,
        leftoverAware: 0,
      }, 0.05),
    ];

    setupDefaultMocks(scored);

    const results = await predictTodaysMeals(makePrefs());

    expect(results.length).toBe(0);
  });

  it('should return empty array when history is empty', async () => {
    mockGetRecipeHistory.mockResolvedValue([]);

    const results = await predictTodaysMeals(makePrefs());

    expect(results).toEqual([]);
  });

  it('should return empty array when no candidates are available', async () => {
    mockGetRecipeHistory.mockResolvedValue([makeHistoryItem()]);
    mockGenerateRecipeCandidates.mockResolvedValue([]);
    mockGetActiveLeftovers.mockResolvedValue([]);
    mockGetPantryItems.mockResolvedValue([]);
    mockGetUserFeedbackHistory.mockResolvedValue([]);

    const results = await predictTodaysMeals(makePrefs());

    expect(results).toEqual([]);
  });

  it('should include temporal reason when temporalFit is high', async () => {
    const dinnerRecipe = makeRecipe({ id: 'd1', title: 'Pasta', tags: ['dinner'] });

    const scored = [
      makeScoredRecipe(dinnerRecipe, {
        sim: 0.7,
        pantry: 0.6,
        temporalFit: 0.8,
        seasonalFit: 0.3,
      }, 0.6),
    ];

    setupDefaultMocks(scored);

    const wednesday = new Date('2026-04-01T12:00:00'); // Wednesday
    const results = await predictTodaysMeals(makePrefs(), wednesday);

    const dinnerPrediction = results.find(r => r.mealType === 'dinner');
    expect(dinnerPrediction).toBeDefined();
    expect(dinnerPrediction!.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Wednesdays')]),
    );
  });

  it('should include seasonal reason when seasonalFit is high', async () => {
    const dinnerRecipe = makeRecipe({ id: 'd1', title: 'Summer Salad', tags: ['dinner'] });

    const scored = [
      makeScoredRecipe(dinnerRecipe, {
        sim: 0.7,
        pantry: 0.5,
        temporalFit: 0.3,
        seasonalFit: 0.8,
      }, 0.6),
    ];

    setupDefaultMocks(scored);

    const summerDate = new Date('2026-07-15');
    const results = await predictTodaysMeals(makePrefs(), summerDate);

    const dinnerPrediction = results.find(r => r.mealType === 'dinner');
    expect(dinnerPrediction).toBeDefined();
    expect(dinnerPrediction!.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('summer')]),
    );
  });

  it('should include leftover reason when leftoverAware score is positive', async () => {
    const dinnerRecipe = makeRecipe({ id: 'd1', title: 'Chicken Fried Rice', tags: ['dinner'] });

    const leftover: Leftover = {
      id: 'lo-1',
      recipeId: 'prev-recipe',
      recipeName: 'Grilled Chicken',
      originalServings: 4,
      remainingServings: 2,
      cookedDate: '2026-04-04',
      estimatedExpiryDate: '2026-04-07',
      mealType: 'dinner',
      status: 'available',
    };

    const scored = [
      makeScoredRecipe(dinnerRecipe, {
        sim: 0.7,
        pantry: 0.5,
        temporalFit: 0.3,
        seasonalFit: 0.3,
        leftoverAware: 0.6,
      }, 0.6),
    ];

    mockGetRecipeHistory.mockResolvedValue([makeHistoryItem()]);
    mockGetActiveLeftovers.mockResolvedValue([leftover]);
    mockGetPantryItems.mockResolvedValue([]);
    mockGenerateRecipeCandidates.mockResolvedValue([dinnerRecipe]);
    mockRankRecipes.mockReturnValue(scored);
    mockGetUserFeedbackHistory.mockResolvedValue([]);

    const results = await predictTodaysMeals(makePrefs());

    const dinnerPrediction = results.find(r => r.mealType === 'dinner');
    expect(dinnerPrediction).toBeDefined();
    expect(dinnerPrediction!.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('leftover')]),
    );
  });

  it('should include expiry reason when expiryUrgency is high', async () => {
    const dinnerRecipe = makeRecipe({
      id: 'd1',
      title: 'Chicken Stir Fry',
      tags: ['dinner'],
      ingredients: [
        { name: 'chicken breast', amount: 1, unit: 'lb' },
        { name: 'broccoli', amount: 2, unit: 'cups' },
      ],
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const expiryDate = tomorrow.toISOString().split('T')[0];

    const pantryItems = [
      { id: 'p1', name: 'chicken breast', quantity: 1, unit: 'lb', category: 'meats', expirationDate: expiryDate },
    ];

    const scored = [
      makeScoredRecipe(dinnerRecipe, {
        sim: 0.7,
        pantry: 0.6,
        temporalFit: 0.3,
        seasonalFit: 0.3,
        expiryUrgency: 0.8,
      }, 0.6),
    ];

    mockGetRecipeHistory.mockResolvedValue([makeHistoryItem()]);
    mockGetActiveLeftovers.mockResolvedValue([]);
    mockGetPantryItems.mockResolvedValue(pantryItems);
    mockGenerateRecipeCandidates.mockResolvedValue([dinnerRecipe]);
    mockRankRecipes.mockReturnValue(scored);
    mockGetUserFeedbackHistory.mockResolvedValue([]);

    const results = await predictTodaysMeals(makePrefs());

    const dinnerPrediction = results.find(r => r.mealType === 'dinner');
    expect(dinnerPrediction).toBeDefined();
    expect(dinnerPrediction!.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('expiring soon')]),
    );
  });

  it('should only return one recipe per meal type', async () => {
    const dinner1 = makeRecipe({ id: 'd1', title: 'Pasta Bolognese', tags: ['dinner'] });
    const dinner2 = makeRecipe({ id: 'd2', title: 'Grilled Steak', tags: ['dinner'] });

    const scored = [
      makeScoredRecipe(dinner1, { sim: 0.8, pantry: 0.7 }, 0.8),
      makeScoredRecipe(dinner2, { sim: 0.7, pantry: 0.6 }, 0.7),
    ];

    setupDefaultMocks(scored);

    const results = await predictTodaysMeals(makePrefs());

    const dinnerResults = results.filter(r => r.mealType === 'dinner');
    expect(dinnerResults.length).toBe(1);
    expect(dinnerResults[0].recipe.id).toBe('d1');
  });

  it('should use the provided targetDate for day and season calculations', async () => {
    const dinnerRecipe = makeRecipe({ id: 'd1', title: 'Winter Stew', tags: ['dinner'] });

    const scored = [
      makeScoredRecipe(dinnerRecipe, {
        sim: 0.7,
        pantry: 0.5,
        temporalFit: 0.8,
        seasonalFit: 0.8,
      }, 0.6),
    ];

    setupDefaultMocks(scored);

    const winterSaturday = new Date('2026-01-17T12:00:00'); // Saturday in winter
    const results = await predictTodaysMeals(makePrefs(), winterSaturday);

    expect(mockRankRecipes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        targetDay: 6,
        currentSeason: 'winter',
      }),
    );

    const dinnerPrediction = results.find(r => r.mealType === 'dinner');
    expect(dinnerPrediction).toBeDefined();
    expect(dinnerPrediction!.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Saturdays'),
        expect.stringContaining('winter'),
      ]),
    );
  });

  it('should produce confidence values between 0 and 1', async () => {
    const breakfastRecipe = makeRecipe({ id: 'b1', title: 'Oatmeal', tags: ['breakfast'] });
    const dinnerRecipe = makeRecipe({ id: 'd1', title: 'Chicken', tags: ['dinner'] });

    const scored = [
      makeScoredRecipe(breakfastRecipe, {
        sim: 1.0,
        pantry: 1.0,
        popularity: 1.0,
        novelty: 1.0,
        expiryUrgency: 1.0,
        feedback: 1.0,
        temporalFit: 1.0,
        seasonalFit: 1.0,
        leftoverAware: 1.0,
      }, 1.0),
      makeScoredRecipe(dinnerRecipe, {
        sim: 0.4,
        pantry: 0.3,
        popularity: 0.5,
        novelty: 0,
        expiryUrgency: 0,
        feedback: 0,
        temporalFit: 0.4,
        seasonalFit: 0.4,
        leftoverAware: 0,
      }, 0.3),
    ];

    setupDefaultMocks(scored);

    const results = await predictTodaysMeals(makePrefs());

    for (const prediction of results) {
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    }
  });
});
