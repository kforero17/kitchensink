import { UnifiedRecipe, Ingredient, MacroBreakdown } from '../shared/interfaces';
import { sanitizeImageUrl } from '../utils/imageUtils';
import { RecipeDocument, RecipeIngredient } from '../types/FirestoreSchema';
import { SpoonacularRecipe } from '../utils/recipeApiService';

// ---- tag normalisation helpers ---- //
const MEAL_TYPE_CANONICAL: Record<string, string> = {
  breakfast: 'breakfast',
  brunch: 'breakfast',
  morning: 'breakfast',
  lunch: 'lunch',
  'main course': 'lunch',
  'main dish': 'lunch',
  midday: 'lunch',
  dinner: 'dinner',
  supper: 'dinner',
  evening: 'dinner',
  snack: 'snacks',
  snacks: 'snacks',
  appetizer: 'snacks',
  'side dish': 'snacks',
  'finger food': 'snacks',
  dessert: 'snacks',
};

function canonicalizeMealTypeTag(raw: string): string | null {
  const key = raw.toLowerCase();
  return MEAL_TYPE_CANONICAL[key] ?? null;
}

/**
 * Convert Firestore-owned Tasty recipe documents into the shared
 * `UnifiedRecipe` contract.
 */
export function mapTastyRecipeToUnified(doc: RecipeDocument): UnifiedRecipe {
  // Add null safety checks for ingredients
  const ingredients: Ingredient[] = (doc.ingredients || []).map((ing: any) => {
    // Support multiple possible schemas:
    // 1) Tasty scraper format → { item: 'medium potatoes', measurement: '2' }
    // 2) Structured format       → { name, amount, unit }
    // 3) Generic fallback (originalString)

    if (ing == null) return { name: 'Unknown ingredient', amount: 0, unit: '', original: '' };

    // Case 2 – preferred structured
    if (ing.name) {
      return {
        name: ing.name,
        amount: ing.amount ?? 0,
        unit: ing.unit ?? '',
        original: ing.originalString ?? `${ing.amount ?? ''} ${ing.unit ?? ''} ${ing.name}`.trim(),
      };
    }

    // Case 1 – item / measurement
    if (ing.item) {
      return {
        name: ing.item,
        amount: Number(ing.measurement) || 0,
        unit: typeof ing.measurement === 'string' && isNaN(Number(ing.measurement)) ? ing.measurement : '',
        original: `${ing.measurement ?? ''} ${ing.item}`.trim(),
      };
    }

    // Fallback
    return {
      name: 'Unknown ingredient',
      amount: 0,
      unit: '',
      original: ing.originalString ?? '',
    };
  });

  // ----- derive meal type tag ordering ----- //
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
  let tags: string[] = (doc.tags ?? []).map((t: string) => t.toLowerCase());

  // Replace any meal-type synonyms with canonical form
  tags = tags.map(t => canonicalizeMealTypeTag(t) ?? t);

  // If the recipe has an explicit mealType field, inject it
  if ((doc as any).mealType && typeof (doc as any).mealType === 'string') {
    const mt = (doc as any).mealType.toLowerCase();
    if (!tags.includes(mt)) tags.unshift(mt);
  }

  // Fallback heuristics: infer from title if still missing a meal-type tag
  if (!tags.some(t => mealTypes.includes(t))) {
    const title = (doc.name || '').toLowerCase();
    if (/(breakfast|pancake|omelet|cereal)/.test(title)) tags.unshift('breakfast');
    else if (/(lunch|sandwich|salad|wrap)/.test(title)) tags.unshift('lunch');
    else if (/(dinner|supper|roast|steak|pasta)/.test(title)) tags.unshift('dinner');
    else if (/(snack|cookie|brownie|bar|bites)/.test(title)) tags.unshift('snacks');
  }

  // Ensure meal-type tag (if found) is first for UI grouping
  const primary = tags.find(t => mealTypes.includes(t));
  if (primary) {
    tags = [primary, ...tags.filter(t => t !== primary)];
  }

  // ----- normalise / correct common dietary tag spellings ----- //
  const normaliseDietaryTag = (raw: string): string => {
    const t = raw.toLowerCase();
    if (/^veg(et)?a?ter?ian?$/.test(t)) return 'vegetarian';   // covers vegetarian, vegatarian, vegeterian
    if (/^vegan$/.test(t)) return 'vegan';
    if (/gluten[-_ ]?free$/.test(t)) return 'gluten-free';
    if (/dairy[-_ ]?free$/.test(t)) return 'dairy-free';
    return t;
  };

  tags = tags.map(normaliseDietaryTag);

  // ----- normalise dietary tags (spaces → hyphens) & dedupe ----- //
  tags = tags.map(t => t.replace(/\s+/g, '-'));
  tags = Array.from(new Set(tags));

  const unified: UnifiedRecipe = {
    id: `tasty-${doc.id ?? 'unknown'}`,
    source: 'tasty',
    title: doc.name || 'Untitled Recipe',
    imageUrl: sanitizeImageUrl(doc.imageUrl ?? ''),
    readyInMinutes: (() => {
      const timeNum = (s: any) => (typeof s === 'string' ? parseInt(s) : 0);
      const prep = timeNum((doc as any).prepTime);
      const cook = timeNum((doc as any).cookTime);
      const total = prep + cook;
      return total > 0 ? total : doc.readyInMinutes || 30;
    })(),
    servings: doc.servings || 1,
    ingredients,
    tags,
    instructions: (doc.instructions || []).map(step => typeof step === 'string' ? step : (step as any).instruction ?? ''),
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

  let tags = rawTags.map(t => canonicalizeMealTypeTag(t) ?? t);
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
    imageUrl: sanitizeImageUrl(apiRecipe.image), // high-res handled elsewhere if desired
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