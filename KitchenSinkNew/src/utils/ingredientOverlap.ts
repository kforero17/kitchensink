import { Recipe } from '../contexts/MealPlanContext';
import { normalizeIngredientName } from './ingredientMatching';
import logger from './logger';

/**
 * Calculates the number of unique ingredients needed for a set of recipes
 */
export function calculateUniqueIngredientCount(recipes: Recipe[]): number {
  try {
    const uniqueIngredients = new Set<string>();
    
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const normalizedName = normalizeIngredientName(ingredient.item);
        uniqueIngredients.add(normalizedName);
      });
    });
    
    return uniqueIngredients.size;
  } catch (error) {
    logger.error('Error calculating unique ingredient count:', error);
    return 0;
  }
}

/**
 * Calculates ingredient overlap score between a recipe and a set of recipes
 * Higher score means more overlap (better for shopping efficiency)
 */
export function calculateIngredientOverlapScore(recipe: Recipe, existingRecipes: Recipe[]): number {
  try {
    if (existingRecipes.length === 0) return 0;
    
    // Extract and normalize ingredients from recipes
    const recipeIngredients = recipe.ingredients.map(i => normalizeIngredientName(i.item));
    
    const existingIngredients = new Set<string>();
    existingRecipes.forEach(r => {
      r.ingredients.forEach(i => {
        existingIngredients.add(normalizeIngredientName(i.item));
      });
    });
    
    // Calculate overlap between recipe ingredients and existing ingredients
    const overlappingIngredients = recipeIngredients.filter(ingredient => 
      existingIngredients.has(ingredient)
    );
    
    const overlapRatio = overlappingIngredients.length / recipeIngredients.length;
    
    // Convert to a 0-100 score
    return Math.round(overlapRatio * 100);
  } catch (error) {
    logger.error('Error calculating ingredient overlap:', error);
    return 0;
  }
}

/**
 * Optimizes a meal plan for ingredient overlap
 * Attempts to maximize ingredient reuse
 */
export function optimizeMealPlanForIngredientOverlap(
  potentialRecipes: Recipe[],
  recipeCount: number
): Recipe[] {
  try {
    if (recipeCount <= 0 || potentialRecipes.length === 0) return [];
    if (recipeCount >= potentialRecipes.length) return [...potentialRecipes];
    
    // Start with the most complex recipe (most ingredients) to maximize potential overlaps
    const sortedByComplexity = [...potentialRecipes].sort(
      (a, b) => b.ingredients.length - a.ingredients.length
    );
    
    const selectedRecipes: Recipe[] = [sortedByComplexity[0]];
    const remainingCandidates = sortedByComplexity.slice(1);
    
    // Iteratively add recipes with the best overlap
    while (selectedRecipes.length < recipeCount && remainingCandidates.length > 0) {
      // Score remaining candidates by overlap with already selected recipes
      const scoredCandidates = remainingCandidates.map(recipe => ({
        recipe,
        overlapScore: calculateIngredientOverlapScore(recipe, selectedRecipes)
      }));
      
      // Sort by overlap score in descending order
      scoredCandidates.sort((a, b) => b.overlapScore - a.overlapScore);
      
      // Add the best candidate to selected recipes
      const bestCandidate = scoredCandidates[0].recipe;
      selectedRecipes.push(bestCandidate);
      
      // Remove best candidate from remaining candidates
      const bestCandidateIndex = remainingCandidates.findIndex(r => r.id === bestCandidate.id);
      remainingCandidates.splice(bestCandidateIndex, 1);
    }
    
    return selectedRecipes;
  } catch (error) {
    logger.error('Error optimizing meal plan for ingredient overlap:', error);
    return potentialRecipes.slice(0, recipeCount);
  }
} 