/**
 * Bridge layer: single re-export point for all app modules used by the simulation.
 *
 * PURE modules are re-exported directly from their @app/* paths.
 * Types that originate in RN-dependent modules (FirestoreSchema, recipeFeedbackService,
 * recipeHistory) are defined locally here so that the simulation never transitively
 * imports React Native packages at the value level.
 *
 * NOTE: Some "pure" modules (smartGroceryList, temporalPatterns, seasonalSignal,
 * feedbackSignal) have transitive imports into RN-dependent modules. Jest
 * moduleNameMapper mocks neutralise those at test time; for direct tsx execution
 * the tsconfig paths + the mocks in __mocks__/ handle it.
 */

// ---------------------------------------------------------------------------
// Ranking modules (pure computation)
// ---------------------------------------------------------------------------
export { rankRecipes } from '@app/ranking/rankRecipes';
export type { RankRecipesOptions, ScoredRecipe, RankingWeights } from '@app/ranking/rankRecipes';

export { computeFeatures } from '@app/ranking/featureEngineering';
export type { FeatureContext, FeatureVector, PantryIngredientInfo } from '@app/ranking/featureEngineering';

export { buildTemporalProfile, computeTemporalFit } from '@app/ranking/temporalPatterns';
export type { TemporalProfile } from '@app/ranking/temporalPatterns';

export { buildSeasonalProfile, computeSeasonalFit, getSeason } from '@app/ranking/seasonalSignal';
export type { Season, SeasonalProfile } from '@app/ranking/seasonalSignal';

export { buildFeedbackMap, buildSeenRecipeIds } from '@app/ranking/feedbackSignal';
export type { FeedbackSignal } from '@app/ranking/feedbackSignal';

// ---------------------------------------------------------------------------
// Utility modules (pure)
// ---------------------------------------------------------------------------
export {
  ingredientsMatch,
  calculateIngredientSimilarity,
  normalizeIngredientName,
  findMatchingIngredients,
} from '@app/utils/ingredientMatching';

export { computeStatus, computeStatusUpdates } from '@app/utils/pantryStatus';
export type { StatusUpdate } from '@app/utils/pantryStatus';

export { buildSmartGroceryList, getSmartListSummary } from '@app/utils/smartGroceryList';
export type { SmartGroceryItem } from '@app/utils/smartGroceryList';

// ---------------------------------------------------------------------------
// Pure type re-exports
// ---------------------------------------------------------------------------
export type { UnifiedRecipe, Ingredient, MacroBreakdown } from '@app/shared/interfaces';

export type { PantryItem, PantryItemStatus } from '@app/types/PantryItem';
export type { Leftover } from '@app/types/Leftover';

export type { DietaryPreferences } from '@app/types/DietaryPreferences';

export type {
  FoodPreferences,
  IngredientSuggestion,
  IngredientCategory,
} from '@app/types/FoodPreferences';
export { CUISINE_OPTIONS, INGREDIENT_SUGGESTIONS } from '@app/types/FoodPreferences';

export type {
  CookingPreferences,
  KitchenInstrument,
  CookingFrequency,
  CookingDuration,
  CookingSkillLevel,
  MealType,
} from '@app/types/CookingPreferences';

export type { BudgetPreferences, BudgetFrequency } from '@app/types/BudgetPreferences';

// ---------------------------------------------------------------------------
// Local definitions for types from RN-dependent modules
// ---------------------------------------------------------------------------
// These mirror the app types but avoid importing React Native code.
// They are kept intentionally minimal -- only the fields the simulation needs.

import type { DietaryPreferences } from '@app/types/DietaryPreferences';
import type { FoodPreferences } from '@app/types/FoodPreferences';
import type { CookingPreferences } from '@app/types/CookingPreferences';
import type { BudgetPreferences } from '@app/types/BudgetPreferences';

/**
 * Mirrors `UserPreferences` from `@app/types/FirestoreSchema`.
 * The original uses `FirebaseFirestoreTypes.Timestamp` for createdAt/updatedAt;
 * the simulation uses plain `any` (the fields are optional and unused in ranking).
 */
export interface UserPreferences {
  dietary: DietaryPreferences;
  food: FoodPreferences;
  cooking: CookingPreferences;
  budget: BudgetPreferences;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Mirrors `RecipeFeedback` from `@app/services/recipeFeedbackService`.
 * The original lives in a module that imports @react-native-firebase/firestore
 * and @react-native-firebase/auth, so we define it locally.
 */
export interface RecipeFeedback {
  recipeId: string;
  userId: string;
  isCooked: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  rating: number;
  feedbackDate: Date;
  mealType?: string;
}

/**
 * Mirrors `RecipeHistoryItem` from `@app/utils/recipeHistory`.
 * The original lives in a module that imports @react-native-async-storage and
 * @react-native-firebase/auth, so we define it locally.
 */
export interface RecipeHistoryItem {
  recipeId: string;
  usedDate: string;
  mealType: string;
}
