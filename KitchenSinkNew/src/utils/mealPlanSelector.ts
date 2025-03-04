import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { findMatchingIngredients, calculateIngredientSimilarity } from './ingredientMatching';
import { getTimeRange, calculateTimeScore, DEFAULT_TIME_CONFIG } from '../config/cookingTimeConfig';
import { calculateRecipeComplexity } from '../config/recipeComplexityConfig';
import { calculateVarietyPenalty, getRecipeHistory, RecipeHistoryItem } from './recipeHistory';
import { calculateIngredientOverlapScore, optimizeMealPlanForIngredientOverlap, calculateUniqueIngredientCount } from './ingredientOverlap';
import logger from './logger';

interface RecipeWithScore extends Recipe {
  score?: number;
}

// Constants for scoring weights
const SCORE_WEIGHTS = {
  DIETARY_MATCH: 35, // Highest priority - dietary restrictions must be met
  FOOD_PREFERENCES: 20, // Second priority - ingredient preferences
  COOKING_HABITS: 15, // Third priority - cooking time and complexity
  BUDGET: 5, // Fourth priority - cost considerations
  VARIETY: 10, // Fifth priority - avoid repetition
  INGREDIENT_OVERLAP: 15, // Sixth priority - minimize shopping list
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

    // Find matching favorite ingredients using improved matching
    const matchingFavorites = findMatchingIngredients(
      recipeIngredients,
      foodPreferences.favoriteIngredients
    );
    score += (matchingFavorites.length / recipeIngredients.length) * 100;

    // Check for similar (but not exact) matches to favorite ingredients
    const remainingIngredients = recipeIngredients.filter(
      ing => !matchingFavorites.includes(ing)
    );
    const similarityScores = remainingIngredients.map(ing =>
      Math.max(...foodPreferences.favoriteIngredients.map(
        fav => calculateIngredientSimilarity(ing, fav)
      ))
    );
    score += (similarityScores.reduce((a, b) => a + b, 0) / recipeIngredients.length) * 50;

    // Subtract points for disliked ingredients
    const matchingDisliked = findMatchingIngredients(
      recipeIngredients,
      foodPreferences.dislikedIngredients
    );
    score -= (matchingDisliked.length / recipeIngredients.length) * 100;

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
  
  // Check if any recipe tag matches any requested meal type directly
  if (recipe.tags.some(tag => cookingPreferences.mealTypes.includes(tag as any))) {
    return 100;
  }
  
  // Fallback: Map novel meal types to existing ones
  const mealTypeMapping: Record<string, string[]> = {
    'breakfast': ['morning', 'am', 'brunch'],
    'lunch': ['noon', 'midday', 'brunch'],
    'dinner': ['evening', 'supper', 'night'],
    'snacks': ['appetizer', 'side', 'dessert']
  };
  
  // Check for indirect matches through mapping
  for (const [standardType, alternativeTypes] of Object.entries(mealTypeMapping)) {
    if (cookingPreferences.mealTypes.includes(standardType as any)) {
      if (recipe.tags.some(tag => alternativeTypes.includes(tag))) {
        // Partial score for mapping match
        return 80;
      }
    }
  }
  
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
 * Computes a composite score for a recipe based on all preferences
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
  relaxFactor: number = 0
): number {
  try {
    validateRecipe(recipe);

    // First check if recipe meets dietary requirements
    if (!meetsAllDietaryRequirements(recipe, preferences.dietary)) {
      return 0;
    }

    // Calculate individual scores
    const foodScore = calculateFoodPreferenceScore(recipe, preferences.food);
    const cookingScore = calculateCookingHabitScore(recipe, preferences.cooking);
    const budgetScore = calculateBudgetScore(recipe, preferences.budget);
    const varietyScore = calculateVarietyScore(recipe, history);
    
    // Calculate ingredient overlap with already selected recipes
    const overlapScore = calculateIngredientOverlapScore(recipe, selectedRecipes);
    
    // Calculate penalty for repeated main ingredient
    const repetitionPenalty = calculateMainIngredientRepetitionPenalty(recipe, selectedRecipes);

    // Log individual scores for debugging
    logger.debug(`Scores for recipe ${recipe.id}:`, {
      foodScore,
      cookingScore,
      budgetScore,
      varietyScore,
      overlapScore,
      repetitionPenalty
    });

    // Apply relaxation factor to appropriate constraints
    // Higher relaxation factor means we care less about certain constraints
    const relaxedVarietyScore = varietyScore * (1 - relaxFactor) + 100 * relaxFactor;
    const relaxedCookingScore = cookingScore * (1 - relaxFactor) + 100 * relaxFactor;
    const relaxedFoodScore = foodScore * (1 - relaxFactor) + 100 * relaxFactor;

    // Calculate weighted composite score
    const compositeScore =
      (relaxedFoodScore * SCORE_WEIGHTS.FOOD_PREFERENCES +
       relaxedCookingScore * SCORE_WEIGHTS.COOKING_HABITS +
       budgetScore * SCORE_WEIGHTS.BUDGET +
       relaxedVarietyScore * SCORE_WEIGHTS.VARIETY +
       overlapScore * SCORE_WEIGHTS.INGREDIENT_OVERLAP) /
      (SCORE_WEIGHTS.FOOD_PREFERENCES + 
       SCORE_WEIGHTS.COOKING_HABITS + 
       SCORE_WEIGHTS.BUDGET +
       SCORE_WEIGHTS.VARIETY +
       SCORE_WEIGHTS.INGREDIENT_OVERLAP);

    // Apply repetition penalty to final score
    return Math.max(0, Math.round(compositeScore - repetitionPenalty));
  } catch (error) {
    logger.error('Error in recipe scoring:', error);
    return 0;
  }
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
  // Initial meal plan will start with highest scored recipes for each type
  const initialMealPlan: Recipe[] = [];
  
  // First pass: get initial selections based on individual recipe scores
  mealTypeRecipes.forEach(mealType => {
    const sortedCandidates = [...mealType.candidates].sort((a, b) => (b.score || 0) - (a.score || 0));
    const initialSelections = sortedCandidates.slice(0, mealType.count);
    initialMealPlan.push(...initialSelections);
  });
  
  // Second pass: try to improve global ingredient overlap with hill climbing
  // Start with current plan and make incremental improvements
  let currentPlan = [...initialMealPlan];
  let currentScore = calculateMealPlanScore(currentPlan);
  let improved = true;
  
  const MAX_ITERATIONS = 10;
  let iteration = 0;
  
  while (improved && iteration < MAX_ITERATIONS) {
    improved = false;
    iteration++;
    
    // Try substituting each recipe with alternatives to see if we can improve
    for (let i = 0; i < currentPlan.length; i++) {
      const currentRecipe = currentPlan[i];
      
      // Find the meal type this recipe belongs to
      const mealTypeInfo = mealTypeRecipes.find(mt => 
        mt.candidates.some(r => r.id === currentRecipe.id)
      );
      
      if (!mealTypeInfo) continue;
      
      // Get alternative candidates for this meal type
      const alternatives = mealTypeInfo.candidates.filter(r => 
        !currentPlan.some(selected => selected.id === r.id)
      );
      
      for (const alternative of alternatives) {
        // Create a new plan with the substitution
        const newPlan = [...currentPlan];
        newPlan[i] = alternative;
        
        // Score the new plan
        const newScore = calculateMealPlanScore(newPlan);
        
        // Update if improved
        if (newScore > currentScore) {
          currentPlan = newPlan;
          currentScore = newScore;
          improved = true;
          break;
        }
      }
      
      if (improved) break;
    }
  }
  
  return currentPlan;
  
  // Helper function to score an entire meal plan
  function calculateMealPlanScore(plan: Recipe[]): number {
    // Calculate unique ingredient count (lower is better)
    const uniqueIngredientCount = calculateUniqueIngredientCount(plan);
    
    // Calculate average individual recipe scores
    const recipeScores = plan.map(recipe => 
      computeRecipeScore(recipe, preferences, plan.filter(r => r.id !== recipe.id), history)
    );
    const avgRecipeScore = recipeScores.reduce((a, b) => a + b, 0) / recipeScores.length;
    
    // Combined score formula: recipe quality + ingredient efficiency
    return avgRecipeScore - (uniqueIngredientCount / 10);
  }
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
    
    // Only consider recipes that meet dietary requirements first
    const eligibleRecipes = recipes.filter(recipe => 
      meetsAllDietaryRequirements(recipe, preferences.dietary)
    );
    
    if (eligibleRecipes.length === 0) {
      logger.error('No recipes meet dietary requirements');
      return { 
        recipes: [], 
        constraintsRelaxed: false,
        message: 'No recipes meet your dietary requirements. Please adjust your preferences.' 
      };
    }
    
    // For each constraint relaxation level, try to generate a meal plan
    for (const constraintLevel of CONSTRAINT_FALLBACK.RELAXATION_STEPS) {
      logger.debug(`Attempting meal plan generation with constraint level: ${constraintLevel.name}`);
      
      // Try to generate meal plan with current constraints
      const result = await attemptMealPlanGeneration(
        eligibleRecipes,
        preferences,
        mealCounts,
        history,
        constraintLevel.relaxFactor
      );
      
      // If we got a valid meal plan, return it
      if (result.success) {
        const constraintsRelaxed = constraintLevel.relaxFactor > 0;
        let message;
        
        if (constraintsRelaxed) {
          message = `Some preferences were relaxed to create your meal plan: ${constraintLevel.name}`;
        }
        
        return { 
          recipes: result.mealPlan, 
          constraintsRelaxed, 
          message 
        };
      }
    }
    
    // If we've tried all relaxation levels and still have no plan
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
 * Helper function to attempt meal plan generation with specific constraints
 */
async function attemptMealPlanGeneration(
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
  },
  history: RecipeHistoryItem[],
  relaxFactor: number = 0
): Promise<{ success: boolean, mealPlan: Recipe[] }> {
  // Only include meal types that have non-zero counts
  const activeMealTypes = Object.entries(mealCounts)
    .filter(([_, count]) => count > 0)
    .map(([type]) => type);

  logger.debug('Active meal types:', activeMealTypes);
  
  // Prepare recipe candidates for each selected meal type
  const mealTypeRecipeCandidates = activeMealTypes.map(mealType => ({
    type: mealType,
    candidates: prepareRecipeCandidates(mealType, recipes, preferences, history, relaxFactor),
    count: mealCounts[mealType as keyof typeof mealCounts]
  }));
  
  // Check if we have enough candidates for each meal type
  const insufficientMealTypes = mealTypeRecipeCandidates.filter(
    mt => mt.candidates.length < mt.count && mt.count > 0
  );
  
  if (insufficientMealTypes.length > 0) {
    logger.debug('Insufficient recipe candidates for meal types:', 
      insufficientMealTypes.map(mt => mt.type).join(', ')
    );
    return { success: false, mealPlan: [] };
  }
  
  // Perform global optimization across all meal types
  const optimizedMealPlan = optimizeGlobalMealPlan(
    mealTypeRecipeCandidates,
    preferences,
    history
  );
  
  // Validate the meal plan - ensure we have the right number of each type
  const finalPlanCounts: Record<string, number> = {};
  
  // Initialize counts for all active meal types
  activeMealTypes.forEach(type => {
    finalPlanCounts[type] = optimizedMealPlan.filter(r => r.tags.includes(type)).length;
  });
  
  // Check if we have enough recipes for each active meal type
  const validPlan = activeMealTypes.every(type => 
    finalPlanCounts[type] >= mealCounts[type as keyof typeof mealCounts]
  );
  
  return {
    success: validPlan,
    mealPlan: optimizedMealPlan
  };
}

/**
 * Helper function to prepare scored recipe candidates for a meal type
 */
function prepareRecipeCandidates(
  mealType: string,
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

  // Check if this meal type is in the user's preferred meal types
  const preferredMealTypes = preferences.cooking.mealTypes || [];
  
  // Filter eligible recipes for this meal type
  let eligibleRecipes = recipes.filter(recipe => 
    recipe.tags.includes(mealType) && 
    meetsAllDietaryRequirements(recipe, preferences.dietary)
  );
  
  // If no recipes match directly, try fallback mapping for meal types
  if (eligibleRecipes.length === 0) {
    const mealTypeMapping: Record<string, string[]> = {
      'breakfast': ['morning', 'am', 'brunch'],
      'lunch': ['noon', 'midday', 'brunch'],
      'dinner': ['evening', 'supper', 'night'],
      'snacks': ['appetizer', 'side', 'dessert']
    };
    
    const alternativeTypes = mealTypeMapping[mealType] || [];
    eligibleRecipes = recipes.filter(recipe => 
      recipe.tags.some(tag => alternativeTypes.includes(tag)) &&
      meetsAllDietaryRequirements(recipe, preferences.dietary)
    );
  }
  
  logger.debug(`Found ${eligibleRecipes.length} eligible recipes for ${mealType}`);
  
  // Score eligible recipes individually first
  return eligibleRecipes.map(recipe => ({
    ...recipe,
    score: computeRecipeScore(recipe, preferences, [], history, relaxFactor)
  }));
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
      score: computeRecipeScore(recipe, preferences, currentMealPlan, history, 0)
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