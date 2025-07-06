import { UnifiedRecipe, Ingredient, MacroBreakdown } from '../shared/interfaces';
import { RecipeDocument, RecipeIngredient } from '../types/FirestoreSchema';
import { SpoonacularRecipe } from '../utils/recipeApiService';

/**
 * Convert Firestore-owned Tasty recipe documents into the shared
 * `UnifiedRecipe` contract.
 */
export function mapTastyRecipeToUnified(doc: RecipeDocument): UnifiedRecipe {
  // Add null safety checks for ingredients
  const ingredients: Ingredient[] = (doc.ingredients || []).map((ing: RecipeIngredient) => ({
    name: ing?.name || 'Unknown ingredient',
    amount: ing?.amount || 0,
    unit: ing?.unit || '',
    original: ing?.originalString || '',
  }));

  // Derive meal type tag ordering
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
  let tags = (doc.tags ?? []).map(t => t.toLowerCase());
  const primary = tags.find(t => mealTypes.includes(t));
  if (primary) {
    tags = [primary, ...tags.filter(t => t !== primary)];
  }

  const unified: UnifiedRecipe = {
    id: `tasty-${doc.id || 'unknown'}`,
    source: 'tasty',
    title: doc.name || 'Untitled Recipe',
    imageUrl: doc.imageUrl ?? '',
    readyInMinutes: doc.readyInMinutes || 30,
    servings: doc.servings || 1,
    ingredients,
    tags,
    instructions: (doc.instructions || []).map(step => (step as any).instruction ?? ''),
    // No macro nutrients or popularity yet
  };

  return unified;
}

/**
 * Light-weight conversion from Spoonacular API payload to `UnifiedRecipe`.
 * IMPORTANT:  This function purposefully omits `instructions` and lengthy
 * summaries to remain within Spoonacular's content usage policy.
 *
 * The caller is expected to have fetched the recipe via
 * GET /recipes/{id}/information?includeNutrition=true so that `nutrition`
 * is available in `apiRecipe`.
 */
export function mapSpoonacularRecipeToUnified(apiRecipe: SpoonacularRecipe & { nutrition?: any }): UnifiedRecipe {
  const ingredients: Ingredient[] = (apiRecipe.extendedIngredients || []).map(ing => ({
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    original: ing.original,
  }));

  // ----- derive primary meal type & reorder tags ----- //
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const rawTags = [
    ...(apiRecipe.dishTypes || []),
    ...(apiRecipe.cuisines || []),
    ...(apiRecipe.diets || []),
  ].map(t => t.toLowerCase());

  let tags = rawTags;
  const primary = rawTags.find(t => mealTypes.includes(t));
  if (primary) {
    tags = [primary, ...rawTags.filter(t => t !== primary)];
  }

  // ----- extract concise instructions (up to 12 steps) ----- //
  let instructions: string[] | undefined;
  if (apiRecipe.analyzedInstructions && apiRecipe.analyzedInstructions.length > 0) {
    const steps = apiRecipe.analyzedInstructions[0].steps || [];
    instructions = steps.slice(0, 12).map((s: any) => s.step as string);
  }

  // Extract macro nutrients if present
  let nutrition: MacroBreakdown | undefined;
  if (apiRecipe.hasOwnProperty('nutrition') && apiRecipe.nutrition?.nutrients) {
    const lookup = (name: string) => apiRecipe.nutrition.nutrients.find((n: any) => n.name.toLowerCase() === name.toLowerCase());
    nutrition = {
      calories: lookup('Calories')?.amount ?? 0,
      protein: lookup('Protein')?.amount ?? 0,
      fat: lookup('Fat')?.amount ?? 0,
      carbs: lookup('Carbohydrates')?.amount ?? 0,
    };
  }

  // Compute a crude popularity score [0,1] based on spoonacular social data if present
  let popularityScore: number | undefined;
  // spoonacular field `aggregateLikes` is common in /information response
  if ((apiRecipe as any).aggregateLikes !== undefined) {
    // Assume 0-1000 likes roughly, clamp then normalise
    const likes = (apiRecipe as any).aggregateLikes as number;
    popularityScore = Math.min(likes, 1000) / 1000;
  }

  const unified: UnifiedRecipe = {
    id: `spn-${apiRecipe.id}`,
    source: 'spoonacular',
    title: apiRecipe.title,
    imageUrl: apiRecipe.image, // high-res handled elsewhere if desired
    readyInMinutes: apiRecipe.readyInMinutes,
    servings: apiRecipe.servings,
    ingredients,
    tags,
    instructions,
    nutrition,
    popularityScore,
  };

  return unified;
} 