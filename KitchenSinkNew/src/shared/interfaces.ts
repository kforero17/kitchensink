export interface Ingredient {
  name: string;
  amount: number; // quantity value, e.g. 2.5
  unit: string;  // e.g. "cups", "g", "tbsp"
  original?: string; // original text as provided by source (optional)
}

export interface MacroBreakdown {
  calories: number;
  protein: number; // grams
  fat: number;     // grams
  carbs: number;   // grams
}

/**
 * Unified recipe shape that both first-party (Tasty) and third-party (Spoonacular)
 * recipes are mapped to before being consumed by the rest of the application.
 *
 * IMPORTANT:  🔒  No full instruction text from Spoonacular should ever be stored
 * to respect their Terms of Service.  Keep only the lightweight metadata listed
 * below.  The full Spoonacular payload can live only in volatile memory and must
 * never be persisted.
 */
export interface UnifiedRecipe {
  /**
   * Compound identifier scoped by source. Examples:
   *   tasty-abc-123        – original Firestore recipe id
   *   spn-716426           – spoonacular recipe id
   */
  id: string;
  /** Where did the recipe originate from */
  source: 'tasty' | 'spoonacular';
  /** Human-readable title */
  title: string;
  /** Publicly accessible hero image */
  imageUrl: string;
  /** Total time until ready (minutes) */
  readyInMinutes: number;
  /** Number of servings */
  servings: number;
  /** Flat list of ingredients */
  ingredients: Ingredient[];
  /** Flexible taxonomy tags: diet, cuisine, dish-type, method… */
  tags: string[];
  /** Optional array of step-by-step instructions (Tasty only) */
  instructions?: string[];
  /**
   * Optional nutrition macro breakdown.  Populated when available (best-effort)
   * but might be undefined for some items.
   */
  nutrition?: MacroBreakdown;
  /** Popularity score normalised 0-1 (e.g. likes/ratings) */
  popularityScore?: number;
  /**
   * The unified contract must NEVER contain full instructions for Spoonacular
   * recipes to stay compliant with their ToS.
   */
} 