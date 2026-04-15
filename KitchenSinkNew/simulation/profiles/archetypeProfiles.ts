/**
 * 10 hand-crafted archetype profiles that cover a wide range of dietary
 * restrictions, cuisine preferences, skill levels, household sizes, and
 * engagement tiers.
 *
 * Each archetype is designed to stress a specific dimension of the ranking
 * and meal-planning pipeline so the simulation exposes edge cases that
 * random profiles alone might miss.
 */

import { ProfileDefinition, UserPreferences } from './types';
import {
  PANTRY_TEMPLATES,
  getPantryForProfile,
  PantryTemplate,
  offsetDate,
  templatesToPantryItems,
} from './pantryTemplates';
import { PantryItem } from '@app/types/PantryItem';
import { DietaryPreferences } from '@app/types/DietaryPreferences';
import { FoodPreferences } from '@app/types/FoodPreferences';
import { CookingPreferences, CookingSkillLevel, MealType, KitchenInstrument } from '@app/types/CookingPreferences';
import { BudgetPreferences } from '@app/types/BudgetPreferences';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDietary(overrides: Partial<DietaryPreferences> = {}): DietaryPreferences {
  return {
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    dairyFree: false,
    nutFree: false,
    lowCarb: false,
    allergies: [],
    restrictions: [],
    ...overrides,
  };
}

function makeFood(
  favoriteIngredients: string[],
  dislikedIngredients: string[],
  preferredCuisines: string[],
  allergies: string[] = [],
): FoodPreferences {
  return {
    favoriteIngredients,
    dislikedIngredients,
    preferredCuisines,
    allergies,
  };
}

function makeCooking(opts: {
  skillLevel: CookingSkillLevel;
  mealTypes: MealType[];
  weeklyMealPrepCount: number;
  householdSize: number;
  servingSizePreference: number;
  kitchenInstruments: KitchenInstrument[];
  cookingFrequency?: CookingPreferences['cookingFrequency'];
  preferredCookingDuration?: CookingPreferences['preferredCookingDuration'];
}): CookingPreferences {
  // Default mappings: skill -> duration, tier is set externally via frequency
  const durationBySkill: Record<CookingSkillLevel, CookingPreferences['preferredCookingDuration']> = {
    beginner: 'under_30_min',
    intermediate: '30_to_60_min',
    advanced: 'over_60_min',
  };

  return {
    cookingFrequency: opts.cookingFrequency ?? 'few_times_week',
    preferredCookingDuration: opts.preferredCookingDuration ?? durationBySkill[opts.skillLevel],
    skillLevel: opts.skillLevel,
    mealTypes: opts.mealTypes,
    servingSizePreference: opts.servingSizePreference,
    weeklyMealPrepCount: opts.weeklyMealPrepCount,
    householdSize: opts.householdSize,
    kitchenInstruments: opts.kitchenInstruments,
  };
}

function makeBudget(amount: number): BudgetPreferences {
  return { amount, frequency: 'weekly' };
}

type EngagementTier = 'high' | 'medium' | 'low';

const FREQUENCY_BY_TIER: Record<EngagementTier, CookingPreferences['cookingFrequency']> = {
  high: 'daily',
  medium: 'few_times_week',
  low: 'weekends_only',
};

// ---------------------------------------------------------------------------
// Profile builder
// ---------------------------------------------------------------------------

interface ArchetypeSpec {
  name: string;
  dietary: Partial<DietaryPreferences>;
  food: {
    favorites: string[];
    disliked: string[];
    cuisines: string[];
    allergies?: string[];
  };
  cooking: {
    skillLevel: CookingSkillLevel;
    mealTypes: MealType[];
    weeklyMealPrepCount: number;
    householdSize: number;
    servingSizePreference: number;
    instruments: KitchenInstrument[];
  };
  budgetAmount: number;
  tier: EngagementTier;
  startDate: string;
}

function buildProfile(spec: ArchetypeSpec): ProfileDefinition {
  const dietary = makeDietary(spec.dietary);
  const food = makeFood(
    spec.food.favorites,
    spec.food.disliked,
    spec.food.cuisines,
    spec.food.allergies ?? [],
  );
  const cooking = makeCooking({
    ...spec.cooking,
    kitchenInstruments: spec.cooking.instruments,
    cookingFrequency: FREQUENCY_BY_TIER[spec.tier],
  });
  const budget = makeBudget(spec.budgetAmount);

  const preferences: UserPreferences = { dietary, food, cooking, budget };

  // Build dietary flags for pantry template selection
  const dietaryFlags: string[] = [];
  if (dietary.vegan) dietaryFlags.push('vegan');
  if (dietary.vegetarian) dietaryFlags.push('vegetarian');
  if (dietary.glutenFree) dietaryFlags.push('glutenFree');
  if (dietary.dairyFree) dietaryFlags.push('dairyFree');
  if (dietary.nutFree) dietaryFlags.push('nutFree');
  if (dietary.lowCarb) dietaryFlags.push('lowCarb');

  const pantryTemplates = getPantryForProfile(dietaryFlags, spec.food.cuisines);
  const startingPantry = templatesToPantryItems(pantryTemplates, spec.startDate);

  return {
    name: spec.name,
    preferences,
    engagementTier: spec.tier,
    startingPantry,
    simulationStartDate: spec.startDate,
  };
}

// ---------------------------------------------------------------------------
// Archetype specifications
// ---------------------------------------------------------------------------

const ARCHETYPE_SPECS: ArchetypeSpec[] = [
  // 1. Vegan Explorer
  {
    name: 'Vegan Explorer',
    dietary: {
      vegan: true,
      vegetarian: true,
      dairyFree: true,
    },
    food: {
      favorites: ['tofu', 'lentils', 'coconut milk', 'avocado', 'chickpeas'],
      disliked: ['mushroom'],
      cuisines: ['thai', 'mexican', 'indian'],
    },
    cooking: {
      skillLevel: 'beginner',
      mealTypes: ['dinner', 'lunch'],
      weeklyMealPrepCount: 7,
      householdSize: 1,
      servingSizePreference: 2,
      instruments: ['microwave', 'stove_top'],
    },
    budgetAmount: 60,
    tier: 'medium',
    startDate: '2025-01-15',
  },

  // 2. Large Family Mediterranean
  {
    name: 'Large Family Mediterranean',
    dietary: {},
    food: {
      favorites: ['olive oil', 'feta cheese', 'lamb', 'tomatoes', 'chickpeas'],
      disliked: [],
      cuisines: ['mediterranean', 'greek', 'italian'],
    },
    cooking: {
      skillLevel: 'advanced',
      mealTypes: ['breakfast', 'lunch', 'dinner', 'snacks'],
      weeklyMealPrepCount: 14,
      householdSize: 6,
      servingSizePreference: 6,
      instruments: ['stove_top', 'oven', 'grill', 'slow_cooker'],
    },
    budgetAmount: 150,
    tier: 'high',
    startDate: '2025-03-01',
  },

  // 3. Allergy-Aware Japanese
  {
    name: 'Allergy-Aware Japanese',
    dietary: {
      glutenFree: true,
      nutFree: true,
      allergies: ['peanut', 'tree nuts', 'shellfish'],
    },
    food: {
      favorites: ['rice', 'salmon', 'tofu', 'ginger'],
      disliked: ['bell pepper'],
      cuisines: ['japanese', 'korean', 'american'],
      allergies: ['peanut', 'tree nuts', 'shellfish'],
    },
    cooking: {
      skillLevel: 'intermediate',
      mealTypes: ['dinner', 'lunch', 'snacks'],
      weeklyMealPrepCount: 10,
      householdSize: 2,
      servingSizePreference: 2,
      instruments: ['microwave', 'pressure_cooker', 'stove_top'],
    },
    budgetAmount: 80,
    tier: 'low',
    startDate: '2025-06-01',
  },

  // 4. Low-Carb Griller
  {
    name: 'Low-Carb Griller',
    dietary: {
      lowCarb: true,
    },
    food: {
      favorites: ['chicken', 'beef', 'avocado', 'eggs', 'spinach'],
      disliked: ['pasta', 'bread'],
      cuisines: ['american', 'mediterranean'],
    },
    cooking: {
      skillLevel: 'intermediate',
      mealTypes: ['breakfast', 'dinner'],
      weeklyMealPrepCount: 10,
      householdSize: 2,
      servingSizePreference: 3,
      instruments: ['grill', 'air_fryer', 'oven', 'stove_top'],
    },
    budgetAmount: 100,
    tier: 'high',
    startDate: '2025-09-01',
  },

  // 5. Vegetarian Pressure Cooker
  {
    name: 'Vegetarian Pressure Cooker',
    dietary: {
      vegetarian: true,
      allergies: ['mushroom'],
    },
    food: {
      favorites: ['lentils', 'chickpeas', 'paneer', 'rice'],
      disliked: ['mushroom'],
      cuisines: ['indian', 'middle_eastern'],
      allergies: ['mushroom'],
    },
    cooking: {
      skillLevel: 'advanced',
      mealTypes: ['lunch', 'dinner'],
      weeklyMealPrepCount: 10,
      householdSize: 3,
      servingSizePreference: 4,
      instruments: ['stove_top', 'oven', 'pressure_cooker'],
    },
    budgetAmount: 90,
    tier: 'medium',
    startDate: '2025-12-01',
  },

  // 6. Dairy-Free Beginner
  {
    name: 'Dairy-Free Beginner',
    dietary: {
      dairyFree: true,
    },
    food: {
      favorites: ['chicken', 'rice', 'avocado'],
      disliked: ['tofu', 'eggplant'],
      cuisines: ['mexican', 'caribbean', 'chinese'],
    },
    cooking: {
      skillLevel: 'beginner',
      mealTypes: ['dinner'],
      weeklyMealPrepCount: 7,
      householdSize: 2,
      servingSizePreference: 2,
      instruments: ['stove_top', 'microwave', 'slow_cooker'],
    },
    budgetAmount: 50,
    tier: 'high',
    startDate: '2025-04-15',
  },

  // 7. Gluten-Free Gourmet
  {
    name: 'Gluten-Free Gourmet',
    dietary: {
      glutenFree: true,
    },
    food: {
      favorites: ['salmon', 'quinoa', 'olive oil', 'truffle oil', 'asparagus'],
      disliked: [],
      cuisines: ['italian', 'french', 'spanish'],
    },
    cooking: {
      skillLevel: 'advanced',
      mealTypes: ['breakfast', 'lunch', 'dinner'],
      weeklyMealPrepCount: 14,
      householdSize: 2,
      servingSizePreference: 2,
      instruments: ['oven', 'stove_top', 'grill', 'toaster_oven', 'air_fryer'],
    },
    budgetAmount: 120,
    tier: 'low',
    startDate: '2025-07-01',
  },

  // 8. Asian Homecook
  {
    name: 'Asian Homecook',
    dietary: {},
    food: {
      favorites: ['rice', 'soy sauce', 'ginger', 'garlic', 'tofu'],
      disliked: ['celery'],
      cuisines: ['vietnamese', 'thai', 'korean'],
    },
    cooking: {
      skillLevel: 'intermediate',
      mealTypes: ['lunch', 'dinner', 'snacks'],
      weeklyMealPrepCount: 10,
      householdSize: 4,
      servingSizePreference: 4,
      instruments: ['stove_top', 'pressure_cooker', 'microwave'],
    },
    budgetAmount: 80,
    tier: 'high',
    startDate: '2025-10-15',
  },

  // 9. Pescatarian Minimalist
  {
    name: 'Pescatarian Minimalist',
    dietary: {
      allergies: ['soy'],
      restrictions: ['no_red_meat', 'no_poultry'],
    },
    food: {
      favorites: ['salmon', 'tuna', 'olive oil', 'lemons'],
      disliked: ['tofu'],
      cuisines: ['japanese', 'mediterranean', 'french'],
      allergies: ['soy'],
    },
    cooking: {
      skillLevel: 'intermediate',
      mealTypes: ['dinner'],
      weeklyMealPrepCount: 7,
      householdSize: 1,
      servingSizePreference: 1,
      instruments: ['stove_top', 'oven', 'grill'],
    },
    budgetAmount: 70,
    tier: 'medium',
    startDate: '2025-02-01',
  },

  // 10. Raw Vegan Minimalist
  {
    name: 'Raw Vegan Minimalist',
    dietary: {
      vegan: true,
      vegetarian: true,
      dairyFree: true,
      restrictions: ['no_cooked_food'],
    },
    food: {
      favorites: ['avocado', 'banana', 'spinach', 'nuts', 'coconut'],
      disliked: [],
      cuisines: ['american', 'thai', 'caribbean'],
    },
    cooking: {
      skillLevel: 'beginner',
      mealTypes: ['lunch', 'dinner'],
      weeklyMealPrepCount: 7,
      householdSize: 1,
      servingSizePreference: 1,
      instruments: [], // No instruments -- raw food only
    },
    budgetAmount: 40,
    tier: 'low',
    startDate: '2025-08-01',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate exactly 10 archetype profiles covering a wide range of user
 * personas. Each profile has a fully populated `UserPreferences`, realistic
 * starting pantry, and a simulation start date spread across the year.
 */
export function generateArchetypeProfiles(): ProfileDefinition[] {
  return ARCHETYPE_SPECS.map(buildProfile);
}
