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
 * Unified recipe shape consumed by the rest of the application.
 * All recipes originate from Tasty / Firebase.
 */
export interface UnifiedRecipe {
  /**
   * Compound identifier scoped by source. Example:
   *   tasty-abc-123        – original Firestore recipe id
   */
  id: string;
  /** Recipe source (currently only Tasty/Firebase) */
  source: 'tasty';
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
} 