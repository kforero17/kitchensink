export function computeRecipeScore(recipe: Recipe, preferences: UserPreferences, currentPlan: Recipe[], history: RecipeHistoryItem[]): number {
  // Add adaptive weighting based on user behavior
  const userWeights = getUserPreferenceWeights(preferences);
  
  const foodScore = calculateFoodPreferenceScore(recipe, preferences.food);
  const cookingScore = calculateCookingHabitScore(recipe, preferences.cooking);
  // ...other scores
  
  return (foodScore * userWeights.food + 
          cookingScore * userWeights.cooking + 
          // ...other weighted scores
         ) / getTotalWeight(userWeights);
} 

// This would calculate a score boost based on pantry items
function calculatePantryUtilizationScore(recipe: Recipe, pantryItems: PantryItem[]): number {
  // Create a map of soon-expiring items
  const soonExpiringItems = pantryItems
    .filter(item => item.priority === 'use-soon')
    .reduce((map, item) => {
      map[normalizeIngredientName(item.name)] = item;
      return map;
    }, {} as Record<string, PantryItem>);
  
  // Check how many recipe ingredients match soon-expiring items
  const recipeIngredients = recipe.ingredients.map(i => normalizeIngredientName(i.item));
  const matchCount = recipeIngredients.filter(ing => soonExpiringItems[ing]).length;
  
  // Calculate score based on percentage of soon-expiring ingredients used
  return matchCount > 0 
    ? Math.min(100, (matchCount / recipeIngredients.length) * 100 * 1.5) 
    : 0;
} 