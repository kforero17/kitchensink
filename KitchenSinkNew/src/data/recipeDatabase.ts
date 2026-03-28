import { Recipe } from '../contexts/MealPlanContext';
import { mockRecipes } from './mockRecipes';
import { additionalMockRecipes, dessertMockRecipes } from './mockRecipes';
import { allSeasonalRecipes } from './seasonalRecipes';

// Combine all recipe collections
export const recipeDatabase: Recipe[] = [
  ...mockRecipes.breakfast,
  ...mockRecipes.lunch,
  ...mockRecipes.dinner,
  ...mockRecipes.snacks,
  ...additionalMockRecipes,
  ...dessertMockRecipes,
  ...allSeasonalRecipes
];

// Helper function to get recipes by tag
export const getRecipesByTag = (tag: string): Recipe[] => {
  return recipeDatabase.filter(recipe => recipe.tags.includes(tag));
};

// Helper function to get recipes by meal type
export const getRecipesByMealType = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'): Recipe[] => {
  // Only return recipes where the first tag matches the requested meal type
  return recipeDatabase.filter(recipe => recipe.tags.length > 0 && recipe.tags[0] === mealType);
};

// Helper function to get recipes by dietary restriction
export const getRecipesByDiet = (diet: 'vegetarian' | 'vegan' | 'gluten-free'): Recipe[] => {
  return recipeDatabase.filter(recipe => recipe.tags.includes(diet));
};

// Parse a human-readable time string like "1 hour 30 min" or "45 min" into total minutes
function parseTimeToMinutes(timeStr: string): number {
  let total = 0;
  const hourMatch = timeStr.match(/(\d+)\s*h(?:our|r)?s?/i);
  const minMatch = timeStr.match(/(\d+)\s*m(?:in(?:ute)?)?s?/i);
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) total += parseInt(minMatch[1], 10);
  if (!hourMatch && !minMatch) {
    const plainNum = parseInt(timeStr, 10);
    if (!isNaN(plainNum)) total = plainNum;
  }
  return total;
}

// Helper function to get recipes by cooking time
export const getRecipesByCookingTime = (maxMinutes: number): Recipe[] => {
  return recipeDatabase.filter(recipe => {
    const cookTime = parseTimeToMinutes(recipe.cookTime);
    const prepTime = parseTimeToMinutes(recipe.prepTime);
    return (cookTime + prepTime) <= maxMinutes;
  });
};

// Helper function to get recipes by cost range
export const getRecipesByCost = (maxCost: number): Recipe[] => {
  return recipeDatabase.filter(recipe => recipe.estimatedCost <= maxCost);
};

// Export the total number of recipes
export const totalRecipes = recipeDatabase.length;

// Lazy recipe counts — computed on first access to avoid slowing down module load
let _recipeCounts: Record<string, number> | null = null;
export const getRecipeCounts = () => {
  if (!_recipeCounts) {
    _recipeCounts = {
      breakfast: getRecipesByMealType('breakfast').length,
      lunch: getRecipesByMealType('lunch').length,
      dinner: getRecipesByMealType('dinner').length,
      snacks: getRecipesByMealType('snacks').length,
      vegetarian: getRecipesByDiet('vegetarian').length,
      vegan: getRecipesByDiet('vegan').length,
      glutenFree: getRecipesByDiet('gluten-free').length,
    };
  }
  return _recipeCounts;
}; 