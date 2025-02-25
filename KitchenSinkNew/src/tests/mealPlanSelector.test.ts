import {
  validateRecipe,
  meetsAllDietaryRequirements,
  calculateFoodPreferenceScore,
  calculateCookingHabitScore,
  calculateBudgetScore,
  calculateVarietyScore,
  computeRecipeScore,
  generateMealPlan,
  RecipeValidationError
} from '../utils/mealPlanSelector';
import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences, CookingDuration } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { RecipeHistoryItem } from '../utils/recipeHistory';
import { calculateIngredientOverlapScore } from '../utils/ingredientOverlap';

// Mock the getRecipeHistory function
jest.mock('../utils/recipeHistory', () => ({
  getRecipeHistory: jest.fn().mockResolvedValue([]),
  calculateVarietyPenalty: jest.fn().mockReturnValue(0),
  RecipeHistoryItem: jest.fn(),
}));

describe('Meal Plan Selector Tests', () => {
  const mockRecipe: Recipe = {
    id: 'test1',
    name: 'Test Recipe',
    description: 'A test recipe',
    prepTime: '20 mins',
    cookTime: '30 mins',
    servings: 4,
    ingredients: [
      { item: 'ingredient1', measurement: '1 cup' },
      { item: 'ingredient2', measurement: '2 tbsp' }
    ],
    instructions: [
      'Step 1',
      'Step 2',
      'Step 3'
    ],
    tags: ['dinner', 'vegetarian'],
    estimatedCost: 10.50
  };

  describe('validateRecipe', () => {
    it('validates a valid recipe', () => {
      expect(() => validateRecipe(mockRecipe)).not.toThrow();
    });

    it('throws on missing required fields', () => {
      const invalidRecipe = { ...mockRecipe };
      delete (invalidRecipe as any).id;
      
      expect(() => validateRecipe(invalidRecipe as Recipe))
        .toThrow(RecipeValidationError);
    });

    it('throws on negative cooking time', () => {
      const invalidRecipe = { 
        ...mockRecipe,
        cookTime: '-10 mins' 
      };
      
      expect(() => validateRecipe(invalidRecipe))
        .toThrow(RecipeValidationError);
    });
  });

  describe('meetsAllDietaryRequirements', () => {
    it('returns true when all requirements are met', () => {
      const dietaryPreferences: DietaryPreferences = {
        vegetarian: true,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
        nutFree: false,
        lowCarb: false,
        allergies: [],
        restrictions: []
      };

      expect(meetsAllDietaryRequirements(mockRecipe, dietaryPreferences)).toBe(true);
    });

    it('returns false when diet requirement is not met', () => {
      const dietaryPreferences: DietaryPreferences = {
        vegetarian: false,
        vegan: true,  // Recipe is not vegan
        glutenFree: false,
        dairyFree: false,
        nutFree: false,
        lowCarb: false,
        allergies: [],
        restrictions: []
      };

      expect(meetsAllDietaryRequirements(mockRecipe, dietaryPreferences)).toBe(false);
    });

    it('returns false when recipe contains allergens', () => {
      const dietaryPreferences: DietaryPreferences = {
        vegetarian: true,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
        nutFree: false,
        lowCarb: false,
        allergies: ['ingredient1'],  // Recipe contains this allergen
        restrictions: []
      };

      expect(meetsAllDietaryRequirements(mockRecipe, dietaryPreferences)).toBe(false);
    });
  });

  describe('calculateFoodPreferenceScore', () => {
    it('returns higher score for recipes with favorite ingredients', () => {
      const preferences: FoodPreferences = {
        favoriteIngredients: ['ingredient1'],
        dislikedIngredients: []
      };

      const score = calculateFoodPreferenceScore(mockRecipe, preferences);
      expect(score).toBeGreaterThan(0);
    });

    it('returns lower score for recipes with disliked ingredients', () => {
      const preferences: FoodPreferences = {
        favoriteIngredients: [],
        dislikedIngredients: ['ingredient1']
      };

      const scoreWithDisliked = calculateFoodPreferenceScore(mockRecipe, preferences);
      
      const preferencesWithoutDisliked: FoodPreferences = {
        favoriteIngredients: [],
        dislikedIngredients: []
      };
      
      const scoreWithoutDisliked = calculateFoodPreferenceScore(mockRecipe, preferencesWithoutDisliked);
      
      expect(scoreWithDisliked).toBeLessThan(scoreWithoutDisliked);
    });
  });

  describe('calculateCookingHabitScore', () => {
    const cookingPrefs: CookingPreferences = {
      cookingFrequency: 'daily',
      preferredCookingDuration: 'over_60_min',
      mealTypes: ['breakfast', 'lunch', 'dinner'],
      servingSizePreference: 4,
      skillLevel: 'intermediate',
      weeklyMealPrepCount: 5,
      householdSize: 4
    };

    it('should give high scores to recipes within time preferences', () => {
      const score = calculateCookingHabitScore(mockRecipe, cookingPrefs);
      expect(score).toBeGreaterThan(50);
    });

    it('should give lower scores to recipes exceeding time preferences', () => {
      const longRecipe = {
        ...mockRecipe,
        prepTime: '30 mins',
        cookTime: '90 mins'
      };
      const score = calculateCookingHabitScore(longRecipe, cookingPrefs);
      expect(score).toBeLessThan(50);
    });
  });

  describe('calculateBudgetScore', () => {
    const budgetPrefs: BudgetPreferences = {
      amount: 100,
      frequency: 'weekly'
    };

    it('should give high scores to recipes within budget', () => {
      const score = calculateBudgetScore(mockRecipe, budgetPrefs);
      expect(score).toBe(100);
    });

    it('should give lower scores to expensive recipes', () => {
      const expensiveRecipe = {
        ...mockRecipe,
        estimatedCost: 50.00
      };
      const score = calculateBudgetScore(expensiveRecipe, budgetPrefs);
      expect(score).toBeLessThan(100);
    });
  });

  describe('calculateVarietyScore', () => {
    it('returns 100 when recipe has never been used', () => {
      const history: RecipeHistoryItem[] = [];
      const score = calculateVarietyScore(mockRecipe, history);
      expect(score).toBe(100);
    });

    it('returns lower score for recently used recipes', () => {
      const history: RecipeHistoryItem[] = [
        {
          recipeId: 'test1',
          usedDate: new Date().toISOString(),
          mealType: 'dinner'
        }
      ];
      
      // Mocking the calculateVarietyPenalty function to return a penalty
      require('../utils/recipeHistory').calculateVarietyPenalty.mockReturnValue(30);
      
      const score = calculateVarietyScore(mockRecipe, history);
      expect(score).toBe(70); // 100 - 30
    });
  });

  describe('calculateIngredientOverlapScore', () => {
    it('returns higher score when ingredients overlap', () => {
      const existingRecipe: Recipe = {
        ...mockRecipe,
        id: 'test2',
        ingredients: [
          { item: 'ingredient1', measurement: '2 cups' },
          { item: 'ingredient3', measurement: '1 tbsp' }
        ]
      };

      const score = calculateIngredientOverlapScore(mockRecipe, [existingRecipe]);
      expect(score).toBeGreaterThan(0);
    });

    it('returns 0 when no ingredients overlap', () => {
      const noOverlapRecipe: Recipe = {
        ...mockRecipe,
        id: 'test3',
        ingredients: [
          { item: 'ingredient4', measurement: '1 cup' },
          { item: 'ingredient5', measurement: '2 tbsp' }
        ]
      };

      const score = calculateIngredientOverlapScore(mockRecipe, [noOverlapRecipe]);
      expect(score).toBe(0);
    });
  });

  describe('generateMealPlan', () => {
    it('returns a meal plan with correct counts', async () => {
      const preferences = {
        dietary: {
          vegetarian: true,
          vegan: false,
          glutenFree: false,
          dairyFree: false,
          nutFree: false,
          lowCarb: false,
          allergies: [],
          restrictions: []
        } as DietaryPreferences,
        food: {
          favoriteIngredients: [],
          dislikedIngredients: []
        } as FoodPreferences,
        cooking: {
          cookingFrequency: 'daily',
          preferredCookingDuration: 'under_30_min' as CookingDuration,
          mealTypes: ['breakfast', 'lunch', 'dinner'],
          servingSizePreference: 4,
          skillLevel: 'intermediate',
          weeklyMealPrepCount: 3,
          householdSize: 2
        } as CookingPreferences,
        budget: {
          amount: 100,
          frequency: 'weekly'
        } as BudgetPreferences
      };

      const mealCounts = {
        breakfast: 1,
        lunch: 1,
        dinner: 1,
        snacks: 0
      };

      const breakfastRecipe = { ...mockRecipe, id: 'breakfast1', tags: ['breakfast', 'vegetarian'] };
      const lunchRecipe = { ...mockRecipe, id: 'lunch1', tags: ['lunch', 'vegetarian'] };
      const dinnerRecipe = { ...mockRecipe, id: 'dinner1', tags: ['dinner', 'vegetarian'] };

      const recipes = [
        breakfastRecipe,
        lunchRecipe,
        dinnerRecipe
      ];

      const plan = await generateMealPlan(recipes, preferences, mealCounts);
      expect(plan.length).toBe(3);
    });

    it('handles empty recipe list', async () => {
      const preferences = {
        dietary: {
          vegetarian: true,
          vegan: false,
          glutenFree: false,
          dairyFree: false,
          nutFree: false,
          lowCarb: false,
          allergies: [],
          restrictions: []
        } as DietaryPreferences,
        food: {
          favoriteIngredients: [],
          dislikedIngredients: []
        } as FoodPreferences,
        cooking: {
          cookingFrequency: 'daily',
          preferredCookingDuration: 'under_30_min' as CookingDuration,
          mealTypes: ['breakfast', 'lunch', 'dinner'],
          servingSizePreference: 4,
          skillLevel: 'intermediate',
          weeklyMealPrepCount: 3,
          householdSize: 2
        } as CookingPreferences,
        budget: {
          amount: 100,
          frequency: 'weekly'
        } as BudgetPreferences
      };

      const mealCounts = {
        breakfast: 1,
        lunch: 1,
        dinner: 1,
        snacks: 0
      };

      const plan = await generateMealPlan([], preferences, mealCounts);
      expect(plan).toEqual([]);
    });
  });
}); 