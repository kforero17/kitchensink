/**
 * Simulation-specific types.
 *
 * Pure app types are imported via @app/* path aliases.
 * Types that originate in React-Native-dependent modules are defined locally
 * to avoid transitively pulling in RN packages.
 */

// ---------------------------------------------------------------------------
// Safe imports (pure modules with no RN dependency)
// ---------------------------------------------------------------------------
import { PantryItem } from '@app/types/PantryItem';
import { Leftover } from '@app/types/Leftover';
import { UnifiedRecipe } from '@app/shared/interfaces';
import { DietaryPreferences } from '@app/types/DietaryPreferences';
import { FoodPreferences } from '@app/types/FoodPreferences';
import { CookingPreferences } from '@app/types/CookingPreferences';
import { BudgetPreferences } from '@app/types/BudgetPreferences';

// ---------------------------------------------------------------------------
// Local copies for types from RN-dependent modules
// ---------------------------------------------------------------------------

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
 */
export interface RecipeHistoryItem {
  recipeId: string;
  usedDate: string;
  mealType: string;
}

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

// ---------------------------------------------------------------------------
// Simulation-specific types
// ---------------------------------------------------------------------------

export type EngagementTier = 'high' | 'medium' | 'low';

/**
 * A fully-resolved simulation profile ready for execution.
 * Created from a `ProfileDefinition` by assigning a uid and seed.
 */
export interface SimulationProfile {
  id: string;
  name: string;
  uid: string;
  preferences: UserPreferences;
  engagementTier: EngagementTier;
  startingPantry: PantryItem[];
  simulationStartDate: string;
  seed: number;
}

/**
 * The definition used to build a `SimulationProfile`.
 * Does not yet have a uid or seed -- those are assigned by the runner.
 */
export interface ProfileDefinition {
  id: string;
  name: string;
  preferences: UserPreferences;
  engagementTier: EngagementTier;
  startingPantry: PantryItem[];
  simulationStartDate: string;
}

/**
 * Mutable state that evolves throughout each simulated day.
 */
export interface DayState {
  pantryItems: PantryItem[];
  leftovers: Leftover[];
  currentMealPlan: UnifiedRecipe[];
  recipeHistory: RecipeHistoryItem[];
  feedbackHistory: RecipeFeedback[];
  cookedToday: string[];
}

/**
 * Immutable snapshot of what happened on a single simulated day.
 */
export interface DaySnapshot {
  profileId: string;
  dayIndex: number;
  date: string;
  season: Season;
  actionsExecuted: ActionResult[];
  stateAfter: DayState;
  violations: InvariantViolation[];
  mealPlanGenerated: boolean;
  recipesCooked: number;
}

/**
 * Full result of running one profile through the entire simulation.
 */
export interface SimulationResult {
  profile: SimulationProfile;
  days: DaySnapshot[];
  qualityMetrics: QualityMetrics;
  totalViolations: InvariantViolation[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type ActionType =
  | 'generate_meal_plan'
  | 'cook_recipe'
  | 'log_leftover'
  | 'give_feedback'
  | 'update_pantry'
  | 'grocery_restock'
  | 'swap_recipe'
  | 'check_insights';

export interface ActionResult {
  type: ActionType;
  success: boolean;
  data?: any;
  error?: string;
}

// ---------------------------------------------------------------------------
// Invariant violations
// ---------------------------------------------------------------------------

export interface InvariantViolation {
  profileId: string;
  dayIndex: number;
  date: string;
  type: 'dietary' | 'repetition' | 'instrument';
  recipeId: string;
  recipeTitle: string;
  detail: string;
  severity: 'critical' | 'warning';
}

// ---------------------------------------------------------------------------
// Quality metrics
// ---------------------------------------------------------------------------

export interface QualityMetrics {
  diversity: {
    /** Novelty value for each day with a valid lookback match, in day order. */
    perDay: number[];
    /** Mean of `perDay`.  NaN when `perDay` is empty. */
    mean: number;
    /** Population std of `perDay`.  NaN when fewer than 2 samples. */
    std: number;
    /** Minimum novelty across `perDay`.  NaN when `perDay` is empty. */
    min: number;
    /** Maximum novelty across `perDay`.  NaN when `perDay` is empty. */
    max: number;
    /** Lookback window used to compute novelty (e.g. 7 for week-over-week). */
    lookbackDays: number;
    /** Count of days we iterated over that had no matching lookback plan. */
    skippedDays: number;
  };
  pantryUtilization: {
    mean: number;
    trend: number;
    perPlan: number[];
  };
  feedbackLoop: {
    positiveCorrelation: number;
    negativeCorrelation: number;
    netEffectiveness: number;
  };
  seasonalFitScore: {
    meanFitScore: number;
    perSeason: Record<Season, number>;
    meanRankBias: number | null;
  };
  expiryDriven: {
    rescueRate: number;
    totalExpiring: number;
    totalRescued: number;
  };
}
