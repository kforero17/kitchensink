import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences, MealType } from '../types/CookingPreferences';
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
    
    // Combine lunch and dinner counts as they often overlap
    // This helps prevent the same recipes showing in both categories
    const combinedMealCounts = {
      breakfast: mealCounts.breakfast,
      lunch: 0, // We'll combine lunch and dinner into a single category
      dinner: mealCounts.lunch + mealCounts.dinner, // Combine lunch and dinner counts
      snacks: mealCounts.snacks
    };
    
    logger.debug('Original meal counts:', mealCounts);
    logger.debug('Combined meal counts:', combinedMealCounts);
    
    // Use the combined counts for the algorithm
    mealCounts = combinedMealCounts;
    
    // Define relaxation levels with specific constraints to relax
    const relaxationLevels = [
      {
        name: 'Initial strict constraints',
        relaxFactor: 0,
        relaxedConstraints: []
      },
      {
        name: 'Relaxed variety constraints',
        relaxFactor: 0.3,
        relaxedConstraints: ['variety', 'ingredient_overlap']
      },
      {
        name: 'Relaxed cooking preferences',
        relaxFactor: 0.6,
        relaxedConstraints: ['variety', 'ingredient_overlap', 'cooking_time', 'complexity']
      },
      {
        name: 'Relaxed food preferences',
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
    
    const eligibleRecipes = recipes.filter(essentialDietaryFilter);
    
    // Log the number of eligible recipes that meet dietary requirements
    logger.debug(`Total recipes after essential dietary filtering: ${eligibleRecipes.length}/${recipes.length}`);
    
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
            score: computeRecipeScore(recipe, preferences, [], history, 1)
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
    
    const fallbackRecipes = eligibleRecipes
      .map(recipe => ({
        ...recipe, 
        score: computeRecipeScore(recipe, preferences, [], history, 1)
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
        // Try to evenly distribute recipes among the requested meal types
        const recipesPerType = Math.ceil(fallbackRecipes.length / requestedMealTypes.length);
        
        fallbackRecipes.forEach((recipe, index) => {
          const targetType = requestedMealTypes[Math.floor(index / recipesPerType)];
          if (targetType && !recipe.tags.includes(targetType)) {
            // Add the meal type tag at the beginning for proper UI display
            recipe.tags = [targetType, ...recipe.tags.filter(tag => tag !== targetType)];
          }
        });
        
        logger.debug('Assigned fallback recipes to requested meal types');
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

  // Check if this meal type is in the user's preferred meal types
  const preferredMealTypes = preferences.cooking.mealTypes || [];
  
  // If this meal type is not in preferred types, return empty array
  if (!preferredMealTypes.includes(mealType)) {
    logger.debug(`Meal type ${mealType} not in preferred types, skipping`);
    return [];
  }

  // First try strict matching where primary meal type (first tag) is the requested meal type
  let eligibleRecipes = recipes.filter(recipe => 
    recipe.tags.length > 0 && 
    recipe.tags[0] === mealType &&
    meetsAllDietaryRequirements(recipe, preferences.dietary)
  );
  
  // If strict matching found no recipes, try a more flexible match
  if (eligibleRecipes.length === 0) {
    logger.debug(`No recipes found with ${mealType} as primary tag, trying secondary tag matching`);
    
    // Find recipes that have the meal type tag anywhere
    eligibleRecipes = recipes.filter(recipe => 
      recipe.tags.includes(mealType) &&
      meetsAllDietaryRequirements(recipe, preferences.dietary)
    );
    
    // IMPORTANT: Reorder the tags to prioritize the requested meal type
    // This ensures the recipe shows up under the selected meal type in the UI
    eligibleRecipes = eligibleRecipes.map(recipe => {
      // Make a copy to avoid modifying the original
      const modifiedRecipe = {...recipe};
      
      // If this isn't the first tag, reorder tags to make the requested meal type first
      if (modifiedRecipe.tags[0] !== mealType && modifiedRecipe.tags.includes(mealType)) {
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
  
  // If still no recipes, try even more flexible matching in relaxed mode
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
  const scoredRecipes = eligibleRecipes.map(recipe => {
    const score = computeRecipeScore(
      recipe,
      preferences,
      [],
      history,
      relaxFactor
    );
    return { ...recipe, score };
  });
  
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