import { UnifiedRecipe, Ingredient as UnifiedIngredient } from '../shared/interfaces';
import { Recipe } from '../contexts/MealPlanContext';

function formatMeasurement(ing: UnifiedIngredient): string {
  if (ing.amount && ing.unit) return `${ing.amount} ${ing.unit}`.trim();
  if (ing.amount) return `${ing.amount}`;
  return ing.unit ?? '';
}

export function unifiedToAppRecipe(u: UnifiedRecipe): Recipe {
  const prep = Math.round(u.readyInMinutes / 3);
  const cook = u.readyInMinutes - prep;

  return {
    id: u.id,
    name: u.title,
    description: '',
    prepTime: `${prep} mins`,
    cookTime: `${cook} mins`,
    servings: u.servings,
    ingredients: u.ingredients.map(i => ({
      item: i.name,
      measurement: formatMeasurement(i),
    })),
    instructions: u.instructions ?? [],
    imageUrl: u.imageUrl,
    tags: u.tags,
    cuisines: [],
    estimatedCost: 10, // placeholder; could be improved later
    isWeeklyMealPlan: false,
  };
} 