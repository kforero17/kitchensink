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

// Helper function to get recipes by cooking time
export const getRecipesByCookingTime = (maxMinutes: number): Recipe[] => {
  return recipeDatabase.filter(recipe => {
    const cookTime = parseInt(recipe.cookTime.split(' ')[0]) || 0;
    const prepTime = parseInt(recipe.prepTime.split(' ')[0]) || 0;
    return (cookTime + prepTime) <= maxMinutes;
  });
};

// Helper function to get recipes by cost range
export const getRecipesByCost = (maxCost: number): Recipe[] => {
  return recipeDatabase.filter(recipe => recipe.estimatedCost <= maxCost);
};

// Export the total number of recipes
export const totalRecipes = recipeDatabase.length;

// Export recipe counts by category
export const recipeCounts = {
  breakfast: getRecipesByMealType('breakfast').length,
  lunch: getRecipesByMealType('lunch').length,
  dinner: getRecipesByMealType('dinner').length,
  snacks: getRecipesByMealType('snacks').length,
  vegetarian: getRecipesByDiet('vegetarian').length,
  vegan: getRecipesByDiet('vegan').length,
  glutenFree: getRecipesByDiet('gluten-free').length,
}; 