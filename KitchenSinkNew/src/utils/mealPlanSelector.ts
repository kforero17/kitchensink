import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences, MealType } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { findMatchingIngredients, calculateIngredientSimilarity } from './ingredientMatching';
import { getTimeRange, calculateTimeScore, DEFAULT_TIME_CONFIG } from '../config/cookingTimeConfig';
import { calculateRecipeComplexity } from '../config/recipeComplexityConfig';
import { calculateVarietyPenalty, getRecipeHistory, RecipeHistoryItem, getRecentSwappedRecipes, getBlockedRecipeIds } from './recipeHistory';
import { calculateIngredientOverlapScore, optimizeMealPlanForIngredientOverlap, calculateUniqueIngredientCount } from './ingredientOverlap';
import { RecipeFeedback } from '../services/recipeFeedbackService';
import logger from './logger';
import { recipeDatabase } from '../data/recipeDatabase';

// ---------------------------------------------
// Helper: identify condiment recipes we want to exclude (e.g. dressings/sauces)
// Only applies to Tasty source as requested
export function isCondimentRecipe(recipe: Recipe): boolean {
  if (!recipe) return false;
  const src = (recipe as any).source;
  if (src !== 'tasty') return false;
  const name = (recipe.name || '').toLowerCase();
  return /\b(dressing|sauce)\b/.test(name);
}
// ---------------------------------------------

interface RecipeWithScore extends Recipe {
  score?: number;
}

// Constants for scoring weights
const SCORE_WEIGHTS = {
  DIETARY_MATCH: 35, // Highest priority - dietary restrictions must be met
  FOOD_PREFERENCES: 15, // Second priority - ingredient preferences
  COOKING_HABITS: 15, // Third priority - cooking time and complexity
  BUDGET: 5, // Fourth priority - cost considerations
  VARIETY: 10, // Fifth priority - avoid repetition
  INGREDIENT_OVERLAP: 10, // Sixth priority - minimize shopping list
  USER_FEEDBACK: 15, // New weight for user feedback
  RECIPE_SIMILARITY: 10, // New weight for recipe similarity
  CUISINE_PREFERENCE: 15, // New weight for cuisine preferences
} as const;

// Constants for cuisine scoring
const CUISINE_WEIGHTS = {
  EXPLICIT_PREFERENCE_BOOST: 30, // Points for explicitly preferred cuisines
  LIKED_CUISINE_BOOST: 20, // Points for cuisines from liked recipes
  MIN_LIKES_FOR_BOOST: 2, // Minimum number of liked recipes needed to consider a cuisine preferred
} as const;

// Constants for feedback scoring
const FEEDBACK_WEIGHTS = {
  LIKED_RECIPE_BOOST: 20, // Points to add for liked recipes
  DISLIKED_RECIPE_PENALTY: -30, // Points to deduct for disliked recipes
  LOW_RATING_PENALTY: -20, // Points to deduct for recipes rated below 3
  COOLDOWN_PERIOD_DAYS: 30, // Days to wait before showing skipped/disliked recipes again
} as const;

// Constants for similarity scoring
const SIMILARITY_WEIGHTS = {
  INGREDIENT_OVERLAP: 0.6, // Weight for ingredient similarity
  TAG_OVERLAP: 0.4, // Weight for tag similarity
  MIN_SIMILARITY_THRESHOLD: 0.3, // Minimum similarity to consider recipes related
} as const;

// Constants for fallback logic
const CONSTRAINT_FALLBACK = {
  MAX_ATTEMPTS: 3,
  RELAXATION_STEPS: [
    {name: 'Initial strict constraints', relaxFactor: 0},
    {name: 'Relaxed variety constraints', relaxFactor: 0.5},
    {name: 'Relaxed cooking preferences', relaxFactor: 0.7},
    {name: 'Minimal constraints (dietary only)', relaxFactor: 0.9}
  ]
};

// Penalty for repeated use of same main ingredient
const REPEATED_INGREDIENT_PENALTY = 5; // Points to deduct per repeated main ingredient

// Constants for scoring weights
const SCORING_WEIGHTS = {
  DIETARY: 1.5,
  FOOD_PREFERENCES: 1.2,
  COOKING_PREFERENCES: 1.0,
  BUDGET: 1.0,
  VARIETY: 0.8,
  CUISINE: 0.7,
  PANTRY: 1.3, // New weight for pantry overlap
};

export class RecipeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeValidationError';
  }
}

/**
 * Validates recipe data structure
 */
export function validateRecipe(recipe: Recipe): void {
  const requiredFields = ['id', 'name', 'ingredients', 'prepTime', 'cookTime', 'servings', 'tags'];
  
  for (const field of requiredFields) {
    if (!(field in recipe)) {
      throw new RecipeValidationError(`Missing required field: ${field}`);
    }
  }

  // Parse cooking time from string format (e.g., "30 mins")
  const cookTime = parseInt(recipe.cookTime.split(' ')[0]) || 0;
  const prepTime = parseInt(recipe.prepTime.split(' ')[0]) || 0;

  if (cookTime < 0 || prepTime < 0) {
    throw new RecipeValidationError('Invalid cooking/prep time');
  }

  if (recipe.estimatedCost < 0) {
    throw new RecipeValidationError('Invalid cost');
  }

  logger.debug(`Recipe ${recipe.id} validated successfully`);
}

/**
 * Validates if a recipe meets all dietary requirements
 */
export function meetsAllDietaryRequirements(
  recipe: Recipe,
  dietaryPreferences: DietaryPreferences
): boolean {
  try {
    validateRecipe(recipe);

    // Check for dietary restrictions
    if (dietaryPreferences.vegetarian && !recipe.tags.includes('vegetarian')) {
      logger.debug(`Recipe ${recipe.id} rejected: not vegetarian`);
      return false;
    }
    if (dietaryPreferences.vegan && !recipe.tags.includes('vegan')) {
      logger.debug(`Recipe ${recipe.id} rejected: not vegan`);
      return false;
    }
    if (dietaryPreferences.glutenFree && !recipe.tags.includes('gluten-free')) {
      logger.debug(`Recipe ${recipe.id} rejected: not gluten-free`);
      return false;
    }
    if (dietaryPreferences.dairyFree && !recipe.tags.includes('dairy-free')) {
      logger.debug(`Recipe ${recipe.id} rejected: not dairy-free`);
      return false;
    }

    // Check for allergies using improved ingredient matching
    const recipeIngredients = recipe.ingredients.map(ing => ing.item);
    const matchingAllergens = findMatchingIngredients(recipeIngredients, dietaryPreferences.allergies);

    if (matchingAllergens.length > 0) {
      logger.debug(`Recipe ${recipe.id} rejected: contains allergens: ${matchingAllergens.join(', ')}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in dietary requirements check:', error);
    return false;
  }
}

/**
 * Calculates a score for how well a recipe matches food preferences
 */
export function calculateFoodPreferenceScore(
  recipe: Recipe,
  foodPreferences: FoodPreferences
): number {
  try {
    validateRecipe(recipe);
    let score = 0;
    const recipeIngredients = recipe.ingredients.map(ing => ing.item);

    // DEBUG: Log if this is a breakfast recipe
    const isBreakfast = recipe.tags.includes('breakfast');
    if (isBreakfast) {
      logger.debug(`[DEBUG] Calculating food preference score for breakfast recipe: ${recipe.name}`);
    }

    // Be more lenient with breakfast recipes since they typically have different ingredients
    // than lunch/dinner (e.g., eggs, milk, flour vs meat, vegetables)
    const mealTypeMultiplier = isBreakfast ? 0.5 : 1.0;

    // Find matching favorite ingredients using improved matching
    const matchingFavorites = findMatchingIngredients(
      recipeIngredients,
      foodPreferences.favoriteIngredients
    );
    score += (matchingFavorites.length / recipeIngredients.length) * 100 * mealTypeMultiplier;

    // Check for similar (but not exact) matches to favorite ingredients
    const remainingIngredients = recipeIngredients.filter(
      ing => !matchingFavorites.includes(ing)
    );
    const similarityScores = remainingIngredients.map(ing =>
      Math.max(...foodPreferences.favoriteIngredients.map(
        fav => calculateIngredientSimilarity(ing, fav)
      ))
    );
    score += (similarityScores.reduce((a, b) => a + b, 0) / recipeIngredients.length) * 50 * mealTypeMultiplier;

    // Subtract points for disliked ingredients
    const matchingDisliked = findMatchingIngredients(
      recipeIngredients,
      foodPreferences.dislikedIngredients
    );
    score -= (matchingDisliked.length / recipeIngredients.length) * 100;

    // For breakfast recipes, ensure they get a minimum baseline score if they don't contain disliked ingredients
    if (isBreakfast && matchingDisliked.length === 0 && score < 50) {
      score = 50; // Baseline score for breakfast recipes without disliked ingredients
      logger.debug(`[DEBUG] Applied baseline score of 50 for breakfast recipe ${recipe.name}`);
    }

    return Math.max(0, Math.min(100, score));
  } catch (error) {
    logger.error('Error in food preference scoring:', error);
    return 0;
  }
}

/**
 * Calculates a score for how well a recipe matches cooking preferences
 */
export function calculateCookingHabitScore(
  recipe: Recipe,
  cookingPreferences: CookingPreferences
): number {
  try {
    validateRecipe(recipe);
    
    // Calculate different aspects of cooking habits
    const timeScore = calculateTimeMatchScore(recipe, cookingPreferences);
    const complexityScore = calculateComplexityMatchScore(recipe, cookingPreferences);
    const mealTypeScore = calculateMealTypeMatchScore(recipe, cookingPreferences);
    
    // Combine scores with appropriate weights
    const combinedScore = (
      timeScore * 0.4 +          // Time is most important (40%)
      complexityScore * 0.4 +     // Complexity is equally important (40%)
      mealTypeScore * 0.2         // Meal type is less important (20%)
    );

    logger.debug(`Cooking scores for ${recipe.id}: time=${timeScore}, complexity=${complexityScore}, mealType=${mealTypeScore}`);
    
    return Math.max(0, Math.min(100, combinedScore));
  } catch (error) {
    logger.error('Error in cooking habit scoring:', error);
    return 0;
  }
}

/**
 * Calculates how well a recipe's time requirements match user preferences
 */
function calculateTimeMatchScore(
  recipe: Recipe,
  cookingPreferences: CookingPreferences
): number {
  // Parse cooking time from string format (e.g., "30 mins")
  const cookTime = parseInt(recipe.cookTime.split(' ')[0]) || 0;
  const prepTime = parseInt(recipe.prepTime.split(' ')[0]) || 0;
  const totalTime = cookTime + prepTime;

  // Get the preferred time range and calculate time score
  const preferredRange = getTimeRange(totalTime);
  return calculateTimeScore(totalTime, preferredRange, DEFAULT_TIME_CONFIG);
}

/**
 * Calculates how well a recipe's complexity matches user preferences
 */
function calculateComplexityMatchScore(
  recipe: Recipe,
  cookingPreferences: CookingPreferences
): number {
  // Get recipe complexity data
  const complexityData = calculateRecipeComplexity(
    recipe.instructions,
    recipe.ingredients
  );
  
  // Determine preferred complexity based on user skill level
  let preferredComplexityScore: number;
  
  switch (cookingPreferences.skillLevel) {
    case 'beginner':
      // Beginners prefer simpler recipes (0-30 complexity)
      preferredComplexityScore = 100 - Math.max(0, complexityData.score - 30) * (100/70);
      break;
    case 'intermediate':
      // Intermediate cooks prefer moderate complexity (30-70)
      const intermediateDistance = Math.abs(complexityData.score - 50);
      preferredComplexityScore = 100 - (intermediateDistance / 50) * 100;
      break;
    case 'advanced':
      // Advanced cooks prefer more complex recipes (50-100)
      preferredComplexityScore = complexityData.score < 50 ? 
        (complexityData.score / 50) * 100 : 100;
      break;
    default:
      // Default to intermediate preference
      const defaultDistance = Math.abs(complexityData.score - 50);
      preferredComplexityScore = 100 - (defaultDistance / 50) * 100;
  }
  
  return preferredComplexityScore;
}

/**
 * Calculates how well a recipe's meal type matches user preferences
 */
function calculateMealTypeMatchScore(
  recipe: Recipe,
  cookingPreferences: CookingPreferences
): number {
  if (cookingPreferences.mealTypes.length === 0) return 100;
  
  // Check if the primary meal type (first tag) matches any requested meal type
  if (recipe.tags.length > 0 && cookingPreferences.mealTypes.includes(recipe.tags[0] as MealType)) {
    return 100;
  }
  
  // Fallback: Map novel meal types to existing ones, but only if they are the primary type
  const mealTypeMapping: Record<MealType, string[]> = {
    'breakfast': ['morning', 'am', 'brunch'],
    'lunch': ['noon', 'midday', 'brunch'],
    'dinner': ['evening', 'supper', 'night'],
    'snacks': ['appetizer', 'side', 'dessert'],
    'dessert': ['sweet', 'baked']
  };
  
  // Since the primary type didn't match, we give a score of zero
  return 0;
}

/**
 * Calculates a budget score for the recipe
 */
export function calculateBudgetScore(
  recipe: Recipe,
  budgetPreferences: BudgetPreferences
): number {
  try {
    validateRecipe(recipe);
    const maxCostPerMeal = budgetPreferences.amount / 7; // Assuming weekly budget
    const recipeCost = recipe.estimatedCost;

    if (recipeCost <= maxCostPerMeal) {
      return 100;
    } else {
      // Use exponential decay for cost penalties
      const costRatio = maxCostPerMeal / recipeCost;
      return Math.max(0, 100 * Math.exp(1 - 1/costRatio));
    }
  } catch (error) {
    logger.error('Error in budget scoring:', error);
    return 0;
  }
}

/**
 * Calculates a variety score based on how frequently a recipe has been used
 */
export function calculateVarietyScore(
  recipe: Recipe,
  history: RecipeHistoryItem[]
): number {
  try {
    const varietyPenalty = calculateVarietyPenalty(recipe.id, history);
    return Math.max(0, 100 - varietyPenalty);
  } catch (error) {
    logger.error('Error calculating variety score:', error);
    return 100; // Default to max score if error
  }
}

/**
 * Calculates a penalty if the same main ingredient is repeated across recipes
 */
export function calculateMainIngredientRepetitionPenalty(
  recipe: Recipe, 
  selectedRecipes: Recipe[]
): number {
  try {
    if (selectedRecipes.length === 0 || recipe.ingredients.length === 0) return 0;
    
    // Get the main ingredient from the recipe (first ingredient or largest quantity)
    const mainIngredient = recipe.ingredients[0].item.toLowerCase();
    
    // Count how many selected recipes already use this ingredient as main
    const repetitionCount = selectedRecipes.filter(r => 
      r.ingredients.length > 0 && 
      r.ingredients[0].item.toLowerCase() === mainIngredient
    ).length;
    
    // Apply increasing penalty for each repetition
    return repetitionCount * REPEATED_INGREDIENT_PENALTY;
  } catch (error) {
    logger.error('Error calculating main ingredient repetition penalty:', error);
    return 0;
  }
}

/**
 * Calculates a score based on cuisine preferences
 */
export function calculateCuisineScore(
  recipe: Recipe,
  feedbackHistory: RecipeFeedback[],
  explicitCuisinePreferences: string[] = []
): number {
  try {
    // If recipe has no cuisine tags, return neutral score
    if (!recipe.cuisines || recipe.cuisines.length === 0) {
      return 50;
    }

    let score = 0;
    const recipeCuisines = recipe.cuisines.map((c: string) => c.toLowerCase());

    // Check explicit preferences first
    const matchingExplicitPreferences = explicitCuisinePreferences
      .map(p => p.toLowerCase())
      .filter(p => recipeCuisines.some(c => c.includes(p) || p.includes(c)));

    if (matchingExplicitPreferences.length > 0) {
      score += CUISINE_WEIGHTS.EXPLICIT_PREFERENCE_BOOST;
    }

    // Analyze feedback history to determine preferred cuisines
    const likedRecipes = feedbackHistory.filter(f => f.isLiked && f.rating && f.rating >= 4);
    
    // Count occurrences of each cuisine in liked recipes
    const cuisineCounts = new Map<string, number>();
    likedRecipes.forEach(feedback => {
      const recipe = feedback.recipeId;
      // Since we don't have direct access to the recipe object here,
      // we'll need to get the cuisines from the recipe history or cache
      // For now, we'll skip this part and rely on explicit preferences
      // TODO: Implement recipe lookup to get cuisines for liked recipes
    });

    // Check if any of the recipe's cuisines are frequently liked
    const hasLikedCuisine = recipeCuisines.some(cuisine => 
      (cuisineCounts.get(cuisine) || 0) >= CUISINE_WEIGHTS.MIN_LIKES_FOR_BOOST
    );

    if (hasLikedCuisine) {
      score += CUISINE_WEIGHTS.LIKED_CUISINE_BOOST;
    }

    // Normalize score to 0-100 range
    return Math.min(100, Math.max(0, score));
  } catch (error) {
    logger.error('Error calculating cuisine score:', error);
    return 50; // Return neutral score on error
  }
}

/**
 * Calculates a score based on how many ingredients from the recipe are in the pantry
 */
export function calculatePantryOverlapScore(
  recipe: Recipe,
  pantryIngredients: string[]
): number {
  try {
    if (!pantryIngredients || pantryIngredients.length === 0) {
      return 50; // Neutral score if no pantry ingredients
    }

    const recipeIngredients = recipe.ingredients.map(ing => ing.item.toLowerCase());
    const normalizedPantryIngredients = pantryIngredients.map(ing => ing.toLowerCase());

    // Find exact matches
    const exactMatches = recipeIngredients.filter(ingredient =>
      normalizedPantryIngredients.some(pantryItem =>
        ingredient === pantryItem || ingredient.includes(pantryItem) || pantryItem.includes(ingredient)
      )
    );

    // Find similar matches using ingredient similarity
    const remainingIngredients = recipeIngredients.filter(ing => !exactMatches.includes(ing));
    const similarMatches = remainingIngredients.filter(ingredient =>
      normalizedPantryIngredients.some(pantryItem =>
        calculateIngredientSimilarity(ingredient, pantryItem) >= 0.8
      )
    );

    // Calculate base score from exact matches
    const exactMatchScore = (exactMatches.length / recipeIngredients.length) * 100;
    
    // Add bonus for similar matches (weighted less than exact matches)
    const similarMatchBonus = (similarMatches.length / recipeIngredients.length) * 50;

    // Combine scores
    const totalScore = Math.min(100, exactMatchScore + similarMatchBonus);

    // Apply diminishing returns for very high overlap
    // This prevents recipes with 100% pantry overlap from dominating
    return Math.pow(totalScore / 100, 0.8) * 100;
  } catch (error) {
    logger.error('Error calculating pantry overlap score:', error);
    return 50; // Return neutral score on error
  }
}

/**
 * Calculates a score based on how well a recipe meets dietary requirements
 */
export function calculateDietaryScore(
  recipe: Recipe,
  dietaryPreferences: DietaryPreferences
): number {
  try {
    // Start with a base score
    let score = 100;

    // Check for dietary restrictions
    if (dietaryPreferences.vegetarian && !recipe.tags.includes('vegetarian')) {
      score -= 50;
    }
    if (dietaryPreferences.vegan && !recipe.tags.includes('vegan')) {
      score -= 50;
    }
    if (dietaryPreferences.glutenFree && !recipe.tags.includes('gluten-free')) {
      score -= 50;
    }
    if (dietaryPreferences.dairyFree && !recipe.tags.includes('dairy-free')) {
      score -= 50;
    }

    // Check for allergies
    const recipeIngredients = recipe.ingredients.map(ing => ing.item);
    const matchingAllergens = findMatchingIngredients(recipeIngredients, dietaryPreferences.allergies);
    
    if (matchingAllergens.length > 0) {
      score -= 100; // Recipe contains allergens, should be rejected
    }

    return Math.max(0, score);
  } catch (error) {
    logger.error('Error calculating dietary score:', error);
    return 0;
  }
}

/**
 * Calculates an exploration bonus score to occasionally boost recipes outside user's history
 * This helps maintain variety while still respecting user preferences
 */
export function calculateExplorationBonus(
  recipe: Recipe,
  history: RecipeHistoryItem[],
  feedbackHistory: RecipeFeedback[]
): number {
  try {
    // If no history, no bonus needed
    if (history.length === 0) return 0;

    // Get the last 10 recipes from history
    const recentHistory = history.slice(-10);
    const recentRecipeIds = new Set(recentHistory.map(h => h.recipeId));

    // If recipe is in recent history, no bonus
    if (recentRecipeIds.has(recipe.id)) return 0;

    // Calculate similarity scores with recent recipes
    const similarityScores = recentHistory.map(h => {
      const recentRecipe = recipeDatabase.find((r: Recipe) => r.id === h.recipeId);
      if (!recentRecipe) return 0;
      return calculateRecipeSimilarity(recipe, recentRecipe);
    });

    // Get average similarity score
    const avgSimilarity = similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length;

    // Calculate exploration bonus based on similarity
    // Lower similarity = higher bonus, but cap at 20 points
    const explorationBonus = Math.min(20, Math.max(0, 20 - (avgSimilarity * 0.2)));

    // Apply random factor to make exploration more natural
    // 30% chance of applying the full bonus
    const randomFactor = Math.random() < 0.3 ? 1 : 0;

    return explorationBonus * randomFactor;
  } catch (error) {
    logger.error('Error calculating exploration bonus:', error);
    return 0;
  }
}

/**
 * Calculates a cuisine exploration bonus to encourage trying new cuisines
 * This helps maintain variety while still respecting user preferences
 */
export function calculateCuisineExplorationBonus(
  recipe: Recipe,
  history: RecipeHistoryItem[],
  feedbackHistory: RecipeFeedback[]
): number {
  try {
    // If recipe has no cuisine tags, no bonus
    if (!recipe.cuisines || recipe.cuisines.length === 0) {
      return 0;
    }

    // If no history, no bonus needed
    if (history.length === 0) return 0;

    // Get the last 10 recipes from history
    const recentHistory = history.slice(-10);
    
    // Get cuisines from recent history
    const recentCuisines = new Set<string>();
    recentHistory.forEach(h => {
      const recentRecipe = recipeDatabase.find((r: Recipe) => r.id === h.recipeId);
      if (recentRecipe?.cuisines) {
        recentRecipe.cuisines.forEach(c => recentCuisines.add(c.toLowerCase()));
      }
    });

    // If recipe's cuisines are all in recent history, no bonus
    const recipeCuisines = recipe.cuisines.map(c => c.toLowerCase());
    if (recipeCuisines.every(c => recentCuisines.has(c))) {
      return 0;
    }

    // Count how many new cuisines this recipe introduces
    const newCuisines = recipeCuisines.filter(c => !recentCuisines.has(c));
    
    // Calculate base bonus (15 points per new cuisine, capped at 30)
    const baseBonus = Math.min(30, newCuisines.length * 15);

    // Apply random factor to make exploration more natural
    // 25% chance of applying the full bonus
    const randomFactor = Math.random() < 0.25 ? 1 : 0;

    return baseBonus * randomFactor;
  } catch (error) {
    logger.error('Error calculating cuisine exploration bonus:', error);
    return 0;
  }
}

/**
 * Calculates a composite score for a recipe based on all preferences
 */
export function computeRecipeScore(
  recipe: Recipe,
  preferences: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
  },
  selectedRecipes: Recipe[] = [],
  history: RecipeHistoryItem[] = [],
  feedbackHistory: RecipeFeedback[] = [],
  pantryIngredients: string[] = [],
  relaxFactor: number = 0
): number {
  try {
    validateRecipe(recipe);

    // First check if recipe meets dietary requirements
    if (!meetsAllDietaryRequirements(recipe, preferences.dietary)) {
      return 0;
    }

    // Calculate individual scores
    const dietaryScore = calculateDietaryScore(recipe, preferences.dietary);
    const foodPreferenceScore = calculateFoodPreferenceScore(recipe, preferences.food);
    const cookingPreferenceScore = calculateCookingHabitScore(recipe, preferences.cooking);
    const budgetScore = calculateBudgetScore(recipe, preferences.budget);
    const varietyScore = calculateVarietyScore(recipe, history);
    const cuisineScore = calculateCuisineScore(recipe, feedbackHistory, preferences.food.preferredCuisines);
    const pantryScore = calculatePantryOverlapScore(recipe, pantryIngredients);
    const explorationBonus = calculateExplorationBonus(recipe, history, feedbackHistory);
    const cuisineExplorationBonus = calculateCuisineExplorationBonus(recipe, history, feedbackHistory);

    // Calculate weighted average
    const weightedSum = 
      dietaryScore * 0.2 +          // 20% weight for dietary requirements
      foodPreferenceScore * 0.25 +   // 25% weight for food preferences
      cookingPreferenceScore * 0.15 + // 15% weight for cooking preferences
      budgetScore * 0.1 +           // 10% weight for budget
      varietyScore * 0.1 +          // 10% weight for variety
      cuisineScore * 0.1 +          // 10% weight for cuisine preferences
      pantryScore * 0.1;            // 10% weight for pantry overlap

    // Add exploration bonuses (not weighted, just added to final score)
    const finalScore = weightedSum + explorationBonus + cuisineExplorationBonus;

    // Apply relaxation factor if provided
    if (relaxFactor > 0) {
      return finalScore * (1 - relaxFactor * 0.3); // Reduce score by up to 30% when relaxed
    }

    return Math.max(0, Math.min(100, finalScore));
  } catch (error) {
    logger.error('Error computing recipe score:', error);
    return 0;
  }
}

/**
 * Calculates the overall score for a meal plan based on individual recipe scores and cohesiveness
 */
function calculateMealPlanScore(mealPlan: RecipeWithScore[]): number {
  if (mealPlan.length === 0) return 0;
  
  // Calculate the average individual recipe score
  const recipesWithScores = mealPlan.filter(recipe => typeof recipe.score === 'number');
  
  // If no scores are available, return a default score
  if (recipesWithScores.length === 0) return 50;
  
  // Calculate average of individual scores
  const averageScore = recipesWithScores.reduce(
    (sum, recipe) => sum + (recipe.score || 0), 
    0
  ) / recipesWithScores.length;
  
  // Calculate ingredient diversity as a bonus
  const uniqueIngredients = new Set<string>();
  mealPlan.forEach(recipe => {
    recipe.ingredients.forEach(ing => uniqueIngredients.add(ing.item.toLowerCase()));
  });
  
  // Calculate diversity bonus (higher is better)
  const ingredientDiversityRatio = uniqueIngredients.size / 
    mealPlan.reduce((sum, recipe) => sum + recipe.ingredients.length, 0);
  
  const diversityBonus = ingredientDiversityRatio * 20; // Up to 20 points for diversity
  
  return Math.min(100, averageScore + diversityBonus);
}

/**
 * Optimizes a full meal plan for global ingredient synergy across all meal types
 */
function optimizeGlobalMealPlan(
  mealTypeRecipes: {
    type: string,
    candidates: RecipeWithScore[],
    count: number
  }[],
  preferences: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
  },
  history: RecipeHistoryItem[]
): Recipe[] {
  // Set to track all recipe IDs to prevent duplicates across meal types
  const usedRecipeIds = new Set<string>();
  
  // Final meal plan
  const mealPlan: Recipe[] = [];
  
  // Process mealTypeRecipes in order of fewest candidates first
  // This helps ensure that meal types with fewer options get priority
  const sortedMealTypeRecipes = [...mealTypeRecipes]
    .sort((a, b) => {
      // If one has no candidates, prioritize based on count needed
      if (a.candidates.length === 0 || b.candidates.length === 0) {
        return b.count - a.count;
      }
      
      // Otherwise, prioritize by candidate-to-count ratio
      const aRatio = a.candidates.length / a.count;
      const bRatio = b.candidates.length / b.count;
      return aRatio - bRatio;
    });
  
  // First pass: add best candidates for each meal type
  sortedMealTypeRecipes.forEach(mealTypeGroup => {
    const { type, candidates, count } = mealTypeGroup;
    
    // Skip if no recipes needed for this type
    if (count === 0) return;
    
    // Skip if no candidates available
    if (candidates.length === 0) {
      logger.debug(`No candidates available for ${type}`);
      return;
    }
    
    // Filter out recipes already used in other meal types
    const availableCandidates = candidates.filter(c => !usedRecipeIds.has(c.id));
    
    // Get the top N recipes for this meal type
    const selectedRecipes: Recipe[] = [];
    let i = 0;
    
    while (selectedRecipes.length < count && i < availableCandidates.length) {
      const candidate = availableCandidates[i];
      
      // Add the recipe to the plan
      selectedRecipes.push(candidate);
      
      // Mark the recipe ID as used
      usedRecipeIds.add(candidate.id);
      
      i++;
    }
    
    // Add selected recipes to the meal plan
    mealPlan.push(...selectedRecipes);
    
    logger.debug(`Added ${selectedRecipes.length}/${count} ${type} recipes`);
  });
  
  // Second pass: fill in any gaps with less strict criteria
  sortedMealTypeRecipes.forEach(mealTypeGroup => {
    const { type, candidates, count } = mealTypeGroup;
    
    // Count how many we've already selected
    const alreadySelected = mealPlan.filter(r => r.tags.includes(type)).length;
    const remaining = count - alreadySelected;
    
    // Skip if we have enough already
    if (remaining <= 0) return;
    
    logger.debug(`Need ${remaining} more ${type} recipes`);
    
    // Get any recipes we haven't used yet
    const availableCandidates = candidates.filter(c => !usedRecipeIds.has(c.id));
    
    // Take what we can get
    const additionalRecipes = availableCandidates.slice(0, remaining);
    
    // Add these recipes to the plan
    additionalRecipes.forEach(recipe => {
      mealPlan.push(recipe);
      usedRecipeIds.add(recipe.id);
    });
    
    logger.debug(`Added ${additionalRecipes.length} additional ${type} recipes`);
  });
  
  // Calculate overall score for the meal plan
  const planScore = calculateMealPlanScore(mealPlan);
  logger.debug(`Generated meal plan with score: ${planScore.toFixed(2)}`);
  
  return mealPlan;
}

/**
 * Generates a meal plan based on preferences and meal counts
 * Enhanced with global optimization and fallback logic
 */
export async function generateMealPlan(
  recipes: Recipe[],
  preferences: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
  },
  mealCounts: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snacks: number;
  }
): Promise<{ recipes: Recipe[], constraintsRelaxed: boolean, message?: string }> {
  try {
    // Get user recipe history
    const history = await getRecipeHistory();
    
    // Get recently swapped recipes (avoid these for a while)
    const recentSwapped = await getRecentSwappedRecipes();
    const blockedIds = await getBlockedRecipeIds();
    
    logger.debug('Meal counts:', mealCounts);
    
    // DEBUG: Log what meal types are being requested
    logger.debug('[DEBUG] Requested meal types with counts:');
    Object.entries(mealCounts).forEach(([type, count]) => {
      if (count > 0) {
        logger.debug(`[DEBUG] - ${type}: ${count} recipes requested`);
      }
    });
    
    // Define relaxation levels with specific constraints to relax
    const relaxationLevels = [
      {
        name: 'Initial strict constraints',
        relaxFactor: 0,
        relaxedConstraints: []
      },
      {
        name: 'Relaxed variety and food preferences',
        relaxFactor: 0.3,
        relaxedConstraints: ['variety', 'ingredient_overlap', 'favorite_ingredients']
      },
      {
        name: 'Relaxed cooking preferences',
        relaxFactor: 0.6,
        relaxedConstraints: ['variety', 'ingredient_overlap', 'favorite_ingredients', 'cooking_time', 'complexity']
      },
      {
        name: 'Fully relaxed preferences',
        relaxFactor: 0.8,
        relaxedConstraints: ['variety', 'ingredient_overlap', 'cooking_time', 'complexity', 'favorite_ingredients', 'disliked_ingredients']
      },
      {
        name: 'Minimal constraints (dietary only)',
        relaxFactor: 1,
        relaxedConstraints: ['variety', 'ingredient_overlap', 'cooking_time', 'complexity', 'favorite_ingredients', 'disliked_ingredients', 'meal_type_strict']
      },
      {
        name: 'Extreme relaxation (last resort)',
        relaxFactor: 1,
        relaxedConstraints: ['variety', 'ingredient_overlap', 'cooking_time', 'complexity', 'favorite_ingredients', 'disliked_ingredients', 'meal_type_strict', 'meal_type_matching']
      }
    ];
    
    // Only consider recipes that meet essential dietary requirements (allergies, vegan/vegetarian)
    const essentialDietaryFilter = (recipe: Recipe) => {
      // Always respect allergies and essential dietary restrictions
      if (isCondimentRecipe(recipe)) {
        // Exclude Tasty dressing or sauce recipes from meal plans
        return false;
      }
      if (preferences.dietary.allergies?.some(allergen => 
        recipe.ingredients.some(ing => ing.item.toLowerCase().includes(allergen.toLowerCase()))
      )) {
        return false;
      }
      
      // Always respect vegan/vegetarian preferences as they're often ethical choices
      if (preferences.dietary.vegan && !recipe.tags.includes('vegan')) {
        return false;
      }
      if (preferences.dietary.vegetarian && !recipe.tags.includes('vegetarian')) {
        return false;
      }
      
      return true;
    };
    
    const eligibleRecipes = recipes
      .filter(essentialDietaryFilter)
      .filter(r => !recentSwapped.includes(r.id))
      .filter(r => !blockedIds.includes(r.id))
      .filter(r => !isCondimentRecipe(r));

    logger.info(`[FILTER] eligible recipes after dietary+swap: ` +
      `tasty=${eligibleRecipes.filter(r => r.id.startsWith('tasty-')).length} ` +
      `spoon=${eligibleRecipes.filter(r => r.id.startsWith('spn-')).length}`);
    
    if (eligibleRecipes.length === 0) {
      logger.error('No recipes meet essential dietary requirements');
      return { 
        recipes: [], 
        constraintsRelaxed: false,
        message: 'No recipes meet your essential dietary requirements. Please check your dietary restrictions.' 
      };
    }
    
    // Try each relaxation level until we get a valid meal plan
    for (const level of relaxationLevels) {
      logger.debug(`Attempting meal plan generation with constraint level: ${level.name}`);
      
      // Get active meal types (types with non-zero counts)
      const activeMealTypes = Object.entries(mealCounts)
        .filter(([_, count]) => count > 0)
        .map(([type]) => type as MealType);
      
      logger.debug('Active meal types:', activeMealTypes);
      
      // If no active meal types, use all types as a fallback
      if (activeMealTypes.length === 0) {
        logger.debug('No active meal types found, using all types as fallback');
        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(type => 
          activeMealTypes.push(type as MealType)
        );
      }
      
      // Special case for extreme relaxation: allow meal type substitution
      let availableRecipes = eligibleRecipes;
      
      // Prepare recipe candidates for each meal type
      const mealTypeRecipeCandidates = activeMealTypes.map(mealType => {
        // DEBUG: Log when processing breakfast
        if (mealType === 'breakfast') {
          logger.debug(`[DEBUG] Processing breakfast candidates at relaxation level: ${level.name}`);
        }
        
        const candidates = prepareRecipeCandidates(
          mealType,
          availableRecipes,
          {
            ...preferences,
            // Apply relaxation to non-essential preferences
            food: level.relaxedConstraints.includes('favorite_ingredients') ? 
              { ...preferences.food, favoriteIngredients: [], dislikedIngredients: [] } :
              preferences.food,
            cooking: level.relaxedConstraints.includes('cooking_time') ?
              { ...preferences.cooking, preferredCookingDuration: 'over_60_min' } :
              preferences.cooking
          },
          history,
          level.relaxFactor
        );
        
        // DEBUG: Log candidate results for breakfast
        if (mealType === 'breakfast') {
          logger.debug(`[DEBUG] Found ${candidates.length} breakfast candidates at relaxation level: ${level.name}`);
          if (candidates.length > 0) {
            logger.debug(`[DEBUG] Top 3 breakfast candidates:`);
            candidates.slice(0, 3).forEach((c, i) => {
              logger.debug(`[DEBUG] ${i + 1}. ${c.name} - Score: ${c.score?.toFixed(2)}`);
            });
          }
        }
        
        return {
          type: mealType,
          candidates,
          count: mealCounts[mealType as keyof typeof mealCounts]
        };
      });
      
      // Last resort: if we still have insufficient recipe candidates in the extreme relaxation level,
      // assign generic recipes to meal types that need them
      if (level.name === 'Extreme relaxation (last resort)') {
        const insufficientMealTypes = mealTypeRecipeCandidates.filter(
          mt => mt.candidates.length < mt.count && mt.count > 0
        );
        
        if (insufficientMealTypes.length > 0) {
          logger.debug('Applying last resort recipe assignment for meal types:', 
            insufficientMealTypes.map(mt => mt.type).join(', ')
          );
          
          // Sort available recipes by their score
          const universalCandidates = eligibleRecipes.map(recipe => ({
            ...recipe,
            score: computeRecipeScore(recipe, preferences, [], history, [], [], 1)
          })).sort((a, b) => (b.score || 0) - (a.score || 0));
          
          // Take the top-scoring recipes and assign them to meal types that need them
          let recipesUsed: string[] = [];
          
          mealTypeRecipeCandidates.forEach(mealTypeGroup => {
            if (mealTypeGroup.candidates.length < mealTypeGroup.count) {
              const neededCount = mealTypeGroup.count - mealTypeGroup.candidates.length;
              
              // Find recipes not yet used in any meal type
              const additionalRecipes = universalCandidates
                .filter(r => !recipesUsed.includes(r.id))
                .slice(0, neededCount);
              
              // Mark these recipes as used
              recipesUsed = [...recipesUsed, ...additionalRecipes.map(r => r.id)];
              
              // Add these to the candidates list for this meal type
              mealTypeGroup.candidates = [...mealTypeGroup.candidates, ...additionalRecipes];
              
              logger.debug(`Assigned ${additionalRecipes.length} generic recipes to ${mealTypeGroup.type}`);
            }
          });
        }
      }
      
      // Check if we have enough candidates for each meal type
      const insufficientMealTypes = mealTypeRecipeCandidates.filter(
        mt => mt.candidates.length < mt.count && mt.count > 0
      );
      
      if (insufficientMealTypes.length > 0) {
        logger.debug('Insufficient recipe candidates for meal types:', 
          insufficientMealTypes.map(mt => mt.type).join(', ')
        );
        continue; // Try next relaxation level
      }
      
      // Perform global optimization across all meal types
      const optimizedMealPlan = optimizeGlobalMealPlan(
        mealTypeRecipeCandidates,
        preferences,
        history
      );

      // --- EXTRA STEP: Ensure we have enough breakfast recipes --- //
      if (mealCounts.breakfast > 0) {
        const currentBreakfast = optimizedMealPlan.filter(r => r.tags.includes('breakfast'));
        const breakfastShortfall = mealCounts.breakfast - currentBreakfast.length;
        if (breakfastShortfall > 0) {
          logger.debug(`[DEBUG] Breakfast shortfall detected: need ${breakfastShortfall} more breakfast recipes`);
          // Find additional breakfast recipes from eligible pool not already used
          const extraBreakfast = eligibleRecipes
            .filter(r => r.tags.includes('breakfast') && !optimizedMealPlan.some(o => o.id === r.id))
            .slice(0, breakfastShortfall);
          logger.debug(`[DEBUG] Adding ${extraBreakfast.length} extra breakfast recipes to meet minimum`);
          optimizedMealPlan.push(...extraBreakfast);
        }
      }
 
      // Validate the meal plan
      const finalPlanCounts: Record<string, number> = {};
      activeMealTypes.forEach(type => {
        finalPlanCounts[type] = optimizedMealPlan.filter(r => r.tags.includes(type)).length;
      });
      
      const validPlan = activeMealTypes.every(type => 
        finalPlanCounts[type] >= mealCounts[type as keyof typeof mealCounts]
      );
      
      if (validPlan) {
        const constraintsRelaxed = level.relaxFactor > 0;
        let message;
        
        if (constraintsRelaxed) {
          message = `Some preferences were relaxed to create your meal plan: ${level.name}`;
          if (level.relaxedConstraints.length > 0) {
            message += `. Relaxed: ${level.relaxedConstraints.join(', ').replace(/_/g, ' ')}`;
          }
        }
        
        return { 
          recipes: optimizedMealPlan, 
          constraintsRelaxed, 
          message 
        };
      }
    }
    
    // If we've tried all relaxation levels and still have no plan
    // Return the top-scored general recipes as a fallback
    
    // Calculate the total number of meals requested across all types
    const totalMealsRequested = Object.values(mealCounts).reduce((sum, count) => sum + count, 0);
    
    // Ensure we return at least the number of meals requested, with a minimum of 3
    const minFallbackCount = Math.max(totalMealsRequested, 3);
    
    // Limit fallback pool to recipes that align with requested meal types (or their synonyms)
    const MEAL_TYPE_SYNONYMS: Record<string, RegExp> = {
      breakfast: /\b(breakfast|brunch|morning)\b/,
      lunch: /\b(lunch|midday|main course|main dish)\b/,
      dinner: /\b(dinner|supper|evening)\b/,
      snacks: /\b(snack|snacks|appetizer|side dish|finger food|dessert)\b/,
    };

    const desiredMealTypes = Object.entries(mealCounts)
      .filter(([_, count]) => count > 0)
      .map(([type]) => type);

    const requestedMealTypeSet = new Set(desiredMealTypes);

    const matchesRequestedMealType = (recipe: Recipe): boolean => {
      // A recipe matches if any canonical tag or synonym matches one of requested types
      const tagsString = recipe.tags.join(' ').toLowerCase();
      for (const mt of requestedMealTypeSet) {
        if (recipe.tags.includes(mt as any)) return true;
        if (MEAL_TYPE_SYNONYMS[mt as keyof typeof MEAL_TYPE_SYNONYMS].test(tagsString)) return true;
      }
      return false;
    };

    const fallbackRecipes = eligibleRecipes
      .filter(matchesRequestedMealType)
      .map(recipe => ({
        ...recipe,
        score: computeRecipeScore(recipe, preferences, [], history, [], [], 1)
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, minFallbackCount);

    if (fallbackRecipes.length > 0) {
      logger.debug(`Returning ${fallbackRecipes.length} fallback recipes after exhausting all relaxation levels`);
      
      // If the user requested specific meal types, add those tags to the fallback recipes
      const requestedMealTypes = Object.entries(mealCounts)
        .filter(([_, count]) => count > 0)
        .map(([type]) => type);
      
      // If there are requested meal types, assign them to the fallback recipes
      // This ensures they appear under the correct tabs in the UI
      if (requestedMealTypes.length > 0) {
        // Synonym mapping so we only assign if recipe already hints at that meal type
        const MEAL_TYPE_SYNONYMS: Record<string, RegExp> = {
          breakfast: /\b(breakfast|brunch|morning)\b/,
          lunch: /\b(lunch|midday|main course|main dish)\b/,
          dinner: /\b(dinner|supper|evening)\b/,
          snacks: /\b(snack|snacks|appetizer|side dish|finger food|dessert)\b/,
        };

        const recipesPerType = Math.ceil(fallbackRecipes.length / requestedMealTypes.length);

        fallbackRecipes.forEach((recipe, index) => {
          const targetType = requestedMealTypes[Math.floor(index / recipesPerType)];

          // Check if recipe already signals that meal type
          const tagsString = recipe.tags.join(' ').toLowerCase();
          const hintsMealType = MEAL_TYPE_SYNONYMS[targetType as keyof typeof MEAL_TYPE_SYNONYMS].test(tagsString);

          if (targetType && hintsMealType) {
            // Ensure the canonical tag is present and first
            if (!recipe.tags.includes(targetType)) {
              recipe.tags = [targetType, ...recipe.tags];
            } else if (recipe.tags[0] !== targetType) {
              const filtered = recipe.tags.filter(t => t !== targetType);
              recipe.tags = [targetType, ...filtered];
            }
          }
        });

        logger.debug('Conditionally assigned fallback recipes to requested meal types based on existing hints');
      }

      return {
        recipes: fallbackRecipes,
        constraintsRelaxed: true,
        message: 'We had to significantly relax your preferences to find recipes. Consider broadening your preferences.'
      };
    }

    return {
      recipes: [],
      constraintsRelaxed: true,
      message: 'Unable to generate a meal plan that meets your preferences. Please broaden your preferences.'
    };
  } catch (error) {
    logger.error('Error generating meal plan:', error);
    return { recipes: [], constraintsRelaxed: false };
  }
}

/**
 * Helper function to prepare scored recipe candidates for a meal type
 */
function prepareRecipeCandidates(
  mealType: MealType,
  recipes: Recipe[],
  preferences: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
  },
  history: RecipeHistoryItem[],
  relaxFactor: number = 0
): RecipeWithScore[] {
  logger.debug(`Preparing candidates for meal type: ${mealType}`);

  // DEBUG: Log the total recipe pool and how many have the requested meal type tag
  logger.debug(`[DEBUG] Total recipe pool size: ${recipes.length}`);
  const recipesWithMealType = recipes.filter(r => r.tags.includes(mealType));
  logger.debug(`[DEBUG] Recipes with '${mealType}' tag: ${recipesWithMealType.length}`);
  
  // DEBUG: If this is breakfast, log more details
  if (mealType === 'breakfast') {
    logger.debug('[DEBUG] Checking breakfast recipe preparation...');
    if (recipesWithMealType.length > 0) {
      logger.debug('[DEBUG] Sample breakfast recipes in pool:');
      recipesWithMealType.slice(0, 3).forEach(r => {
        logger.debug(`[DEBUG] - ${r.name} - Primary tag: ${r.tags[0]}`);
      });
    }
  }

  // Check if this meal type is in the user's preferred meal types
  const preferredMealTypes = preferences.cooking.mealTypes || [];
  
  // DEBUG: Log user's preferred meal types
  logger.debug(`[DEBUG] User's preferred meal types: [${preferredMealTypes.join(', ')}]`);
  
  // If this meal type is not in preferred types, return empty array
  if (!preferredMealTypes.includes(mealType)) {
    logger.debug(`Meal type ${mealType} not in preferred types, skipping`);
    logger.debug(`[DEBUG] SKIPPING ${mealType} - not in user preferences!`);
    return [];
  }

  // First try strict matching where primary meal type (first tag) is the requested meal type
  let strictMatches = recipes.filter(recipe => 
    recipe.tags.length > 0 && 
    recipe.tags[0] === mealType &&
    meetsAllDietaryRequirements(recipe, preferences.dietary)
  );
  
  // DEBUG: Log strict matching results
  logger.debug(`[DEBUG] After strict matching (primary tag = ${mealType}): ${strictMatches.length} recipes found`);
  
  // Always gather flexible matches (mealType appears anywhere in tags)
  let flexibleMatches: Recipe[] = recipes.filter(recipe => 
    recipe.tags.includes(mealType) &&
    meetsAllDietaryRequirements(recipe, preferences.dietary)
  );
  
  // Remove any recipes already included in strictMatches to avoid duplicates
  flexibleMatches = flexibleMatches.filter(fm => !strictMatches.some(sm => sm.id === fm.id));
  
  // Reorder tags for flexible matches so the requested mealType becomes primary
  flexibleMatches = flexibleMatches.map(recipe => {
    if (recipe.tags[0] !== mealType) {
      const newTags = recipe.tags.filter(t => t !== mealType);
      return { ...recipe, tags: [mealType, ...newTags] };
    }
    return recipe;
  });
  
  // Merge strict and flexible matches, prioritizing strict ones first
  let eligibleRecipes = [...strictMatches, ...flexibleMatches];
  
  // DEBUG: Log total eligible recipes after combining strict + flexible
  logger.debug(`[DEBUG] Total eligible recipes after combining strict+flexible for ${mealType}: ${eligibleRecipes.length}`);
  
  // If still no recipes and relaxFactor > 0.5, apply relaxed matching (synonyms)
  if (eligibleRecipes.length === 0 && relaxFactor > 0.5) {
    logger.debug(`No recipes with ${mealType} tag found, applying relaxed matching`);
    
    // Define meal type mapping for fallback
    const mealTypeMapping: Record<string, string[]> = {
      'breakfast': ['morning', 'brunch'],
      'lunch': ['main course', 'main dish', 'midday'],
      'dinner': ['main course', 'main dish', 'evening', 'supper'],
      'snacks': ['appetizer', 'side dish', 'finger food', 'snack']
    };
    
    const relatedTags = mealTypeMapping[mealType] || [];
    
    // Find recipes with related tags
    eligibleRecipes = recipes.filter(recipe => 
      recipe.tags.some(tag => relatedTags.some(relatedTag => tag.includes(relatedTag))) &&
      meetsAllDietaryRequirements(recipe, preferences.dietary)
    );
    
    // Add the requested meal type tag to these recipes so they appear under the correct category
    eligibleRecipes = eligibleRecipes.map(recipe => {
      // Make a copy of the recipe to avoid modifying the original
      const modifiedRecipe = {...recipe};
      
      // If the recipe doesn't already have the mealType tag, add it as the first tag
      if (!modifiedRecipe.tags.includes(mealType)) {
        modifiedRecipe.tags = [mealType, ...modifiedRecipe.tags];
        logger.debug(`Added ${mealType} tag to recipe ${modifiedRecipe.id} from relaxed matching`);
      } 
      // If it has the tag but not as the first one, reorder
      else if (modifiedRecipe.tags[0] !== mealType) {
        // Remove mealType from its current position
        const tags = [...modifiedRecipe.tags];
        const index = tags.indexOf(mealType);
        tags.splice(index, 1);
        
        // Add it at the beginning
        modifiedRecipe.tags = [mealType, ...tags];
        logger.debug(`Reordered tags for recipe ${modifiedRecipe.id} to prioritize ${mealType}`);
      }
      
      return modifiedRecipe;
    });
  }
  
  // Log the number of eligible recipes found
  logger.debug(`Found ${eligibleRecipes.length} eligible ${mealType} recipes`);
  
  // Score all eligible recipes
  const scoredRecipes = eligibleRecipes.map(recipe => ({
    ...recipe,
    score: computeRecipeScore(
      recipe,
      preferences,
      [],
      history,
      [],
      [], // Empty pantry ingredients array
      relaxFactor
    )
  }));
  
  // Sort by score, descending
  return scoredRecipes.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Finds an alternative recipe of the same meal type
 * This function is used for the recipe swap feature
 */
export async function findAlternativeRecipe(
  currentRecipeId: string,
  mealType: string,
  allRecipes: Recipe[],
  currentMealPlan: Recipe[],
  preferences: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
  }
): Promise<Recipe | null> {
  try {
    // Get user recipe history
    const history = await getRecipeHistory();
    
    // Filter eligible recipes of the same meal type that are not already in the meal plan
    const eligibleAlternatives = allRecipes.filter(recipe => 
      recipe.id !== currentRecipeId && 
      recipe.tags.includes(mealType) &&
      meetsAllDietaryRequirements(recipe, preferences.dietary) &&
      !currentMealPlan.some(r => r.id === recipe.id)
    );
    
    if (eligibleAlternatives.length === 0) {
      logger.debug(`No alternative recipes found for meal type: ${mealType}`);
      return null;
    }
    
    // Score each alternative recipe
    const scoredAlternatives = eligibleAlternatives.map(recipe => ({
      ...recipe,
      score: computeRecipeScore(
        recipe,
        preferences,
        currentMealPlan,
        history,
        [],
        [], // Empty pantry ingredients array
        0
      )
    }));
    
    // Sort by score (highest first)
    const sortedAlternatives = scoredAlternatives.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Return the best alternative
    return sortedAlternatives[0];
  } catch (error) {
    logger.error('Error finding alternative recipe:', error);
    return null;
  }
}

/**
 * Calculates a score based on user feedback history
 */
export function calculateFeedbackScore(
  recipe: Recipe,
  feedbackHistory: RecipeFeedback[]
): number {
  try {
    // Find feedback for this recipe
    const recipeFeedback = feedbackHistory.find(f => f.recipeId === recipe.id);
    if (!recipeFeedback) return 0;

    let score = 0;

    // Apply boost for liked recipes
    if (recipeFeedback.isLiked) {
      score += FEEDBACK_WEIGHTS.LIKED_RECIPE_BOOST;
    }

    // Apply penalty for disliked recipes
    if (recipeFeedback.isDisliked) {
      score += FEEDBACK_WEIGHTS.DISLIKED_RECIPE_PENALTY;
    }

    // Apply penalty for low ratings
    if (recipeFeedback.rating && recipeFeedback.rating < 3) {
      score += FEEDBACK_WEIGHTS.LOW_RATING_PENALTY;
    }

    // Check if recipe is in cooldown period
    if (recipeFeedback.feedbackDate) {
      const daysSinceFeedback = Math.ceil(
        (Date.now() - recipeFeedback.feedbackDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // If recipe was disliked/skipped and still in cooldown, apply additional penalty
      if ((recipeFeedback.isDisliked || recipeFeedback.rating < 3) && 
          daysSinceFeedback < FEEDBACK_WEIGHTS.COOLDOWN_PERIOD_DAYS) {
        score += (FEEDBACK_WEIGHTS.COOLDOWN_PERIOD_DAYS - daysSinceFeedback) * -2;
      }
    }

    return Math.max(-100, Math.min(100, score));
  } catch (error) {
    logger.error('Error calculating feedback score:', error);
    return 0;
  }
}

/**
 * Calculates similarity score between two recipes
 */
export function calculateRecipeSimilarity(
  recipe1: Recipe,
  recipe2: Recipe
): number {
  try {
    // Calculate ingredient similarity
    const ingredients1 = recipe1.ingredients.map(i => i.item.toLowerCase());
    const ingredients2 = recipe2.ingredients.map(i => i.item.toLowerCase());
    
    const ingredientOverlap = ingredients1.filter(ing1 =>
      ingredients2.some(ing2 => calculateIngredientSimilarity(ing1, ing2) > 0.7)
    ).length;
    
    const ingredientSimilarity = (ingredientOverlap / Math.max(ingredients1.length, ingredients2.length)) * 100;

    // Calculate tag similarity
    const tags1 = new Set(recipe1.tags.map(t => t.toLowerCase()));
    const tags2 = new Set(recipe2.tags.map(t => t.toLowerCase()));
    
    const tagOverlap = [...tags1].filter(tag => tags2.has(tag)).length;
    const tagSimilarity = (tagOverlap / Math.max(tags1.size, tags2.size)) * 100;

    // Combine scores with weights
    return (
      ingredientSimilarity * SIMILARITY_WEIGHTS.INGREDIENT_OVERLAP +
      tagSimilarity * SIMILARITY_WEIGHTS.TAG_OVERLAP
    );
  } catch (error) {
    logger.error('Error calculating recipe similarity:', error);
    return 0;
  }
}

/**
 * Calculates a novelty score based on recipe history
 */
export function calculateNoveltyScore(
  recipe: Recipe,
  history: RecipeHistoryItem[],
  feedbackHistory: RecipeFeedback[]
): number {
  try {
    // Check if recipe has been shown recently
    const recentUsage = history.find(h => h.recipeId === recipe.id);
    if (!recentUsage) return 100; // New recipe gets max score

    // Calculate days since last shown
    const daysSinceLastShown = Math.ceil(
      (Date.now() - new Date(recentUsage.usedDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if recipe has feedback
    const feedback = feedbackHistory.find(f => f.recipeId === recipe.id);
    if (feedback) {
      // If recipe was disliked or rated low, reduce novelty score
      if (feedback.isDisliked || (feedback.rating && feedback.rating < 3)) {
        return Math.max(0, 50 - daysSinceLastShown);
      }
    }

    // Otherwise, base novelty on days since last shown
    return Math.max(0, 100 - daysSinceLastShown);
  } catch (error) {
    logger.error('Error calculating novelty score:', error);
    return 50; // Default to middle score on error
  }
} 