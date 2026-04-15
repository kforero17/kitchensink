/**
 * Random profile generator for the simulation harness.
 *
 * Uses a seeded PRNG (seed-random) so that every run with the same seed
 * produces identical profiles, making results fully reproducible.
 */

import seedRandom from 'seed-random';
import { ProfileDefinition, UserPreferences, EngagementTier } from './types';
import {
  getPantryForProfile,
  templatesToPantryItems,
} from './pantryTemplates';
import { PantryItem } from '@app/types/PantryItem';
import { DietaryPreferences } from '@app/types/DietaryPreferences';
import { FoodPreferences } from '@app/types/FoodPreferences';
import {
  CookingPreferences,
  CookingFrequency,
  CookingDuration,
  CookingSkillLevel,
  MealType,
  KitchenInstrument,
} from '@app/types/CookingPreferences';
import { BudgetPreferences } from '@app/types/BudgetPreferences';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUISINE_IDS: string[] = [
  'italian', 'mexican', 'chinese', 'japanese', 'indian',
  'thai', 'vietnamese', 'korean', 'mediterranean', 'american',
  'french', 'greek', 'spanish', 'middle_eastern', 'caribbean',
];

const ALL_ALLERGIES: string[] = [
  'peanut', 'tree nuts', 'shellfish', 'soy', 'mushroom',
  'sesame', 'wheat', 'fish',
];

const ALL_RESTRICTIONS: string[] = [
  'no_red_meat', 'no_poultry', 'no_cooked_food',
];

const ALL_SKILLS: CookingSkillLevel[] = ['beginner', 'intermediate', 'advanced'];
const ALL_FREQUENCIES: CookingFrequency[] = ['daily', 'few_times_week', 'weekends_only', 'rarely'];
const ALL_DURATIONS: CookingDuration[] = ['under_30_min', '30_to_60_min', 'over_60_min'];
const ALL_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'dessert'];
const ALL_INSTRUMENTS: KitchenInstrument[] = [
  'stove_top', 'oven', 'microwave', 'grill',
  'air_fryer', 'slow_cooker', 'pressure_cooker', 'toaster_oven',
];

/** Pool of ingredient names for generating favorites and dislikes. */
const INGREDIENT_POOL: string[] = [
  'chicken', 'beef', 'pork', 'salmon', 'tuna', 'shrimp', 'tofu', 'tempeh',
  'rice', 'pasta', 'quinoa', 'bread', 'tortilla', 'noodles', 'oats',
  'tomatoes', 'onions', 'garlic', 'spinach', 'broccoli', 'carrots',
  'bell pepper', 'mushroom', 'avocado', 'potatoes', 'sweet potato',
  'eggs', 'cheese', 'yogurt', 'milk', 'butter', 'cream',
  'olive oil', 'soy sauce', 'honey', 'lemon', 'lime', 'ginger',
  'cumin', 'paprika', 'basil', 'cilantro', 'coconut milk', 'beans',
  'lentils', 'chickpeas', 'corn', 'zucchini', 'eggplant', 'cucumber',
];

/** Creative adjectives and nouns for profile names. */
const NAME_ADJECTIVES: string[] = [
  'Spontaneous', 'Adventurous', 'Curious', 'Creative', 'Thrifty',
  'Bold', 'Eclectic', 'Nimble', 'Playful', 'Savvy',
  'Artisan', 'Rustic', 'Urban', 'Seasonal', 'Spirited',
];

const NAME_NOUNS: string[] = [
  'Chef', 'Cook', 'Foodie', 'Gastronome', 'Forager',
  'Baker', 'Taster', 'Epicure', 'Griller', 'Meal Planner',
  'Kitchen Wizard', 'Spice Hunter', 'Flavor Scout', 'Recipe Tester', 'Dish Crafter',
];

// ---------------------------------------------------------------------------
// PRNG helpers
// ---------------------------------------------------------------------------

/** Pick a single random element from an array. */
function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Pick between `min` and `max` (inclusive) unique elements from an array.
 * Returns a new array -- the source is not mutated.
 */
function pickMultiple<T>(arr: T[], min: number, max: number, rng: () => number): T[] {
  const count = randomInt(min, max, rng);
  const pool = [...arr];
  const result: T[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return result;
}

/** Random integer in [min, max] inclusive. */
function randomInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Profile generation
// ---------------------------------------------------------------------------

function generateName(index: number, rng: () => number): string {
  const adj = pickRandom(NAME_ADJECTIVES, rng);
  const noun = pickRandom(NAME_NOUNS, rng);
  const num = String(index + 1).padStart(2, '0');
  return `${adj} ${noun} ${num}`;
}

function generateDietary(rng: () => number): DietaryPreferences {
  // Pick 0-3 random dietary flags
  const flagCount = randomInt(0, 3, rng);
  const possibleFlags = ['vegetarian', 'vegan', 'glutenFree', 'dairyFree', 'nutFree', 'lowCarb'] as const;
  const selectedFlags = new Set<string>();

  for (let i = 0; i < flagCount; i++) {
    selectedFlags.add(pickRandom([...possibleFlags], rng));
  }

  // Business rules: vegan implies vegetarian + dairyFree
  if (selectedFlags.has('vegan')) {
    selectedFlags.add('vegetarian');
    selectedFlags.add('dairyFree');
  }

  // Business rule: never vegan + lowCarb simultaneously
  if (selectedFlags.has('vegan') && selectedFlags.has('lowCarb')) {
    selectedFlags.delete('lowCarb');
  }

  const allergies = pickMultiple(ALL_ALLERGIES, 0, 2, rng);
  const restrictions = pickMultiple(ALL_RESTRICTIONS, 0, 1, rng);

  return {
    vegetarian: selectedFlags.has('vegetarian'),
    vegan: selectedFlags.has('vegan'),
    glutenFree: selectedFlags.has('glutenFree'),
    dairyFree: selectedFlags.has('dairyFree'),
    nutFree: selectedFlags.has('nutFree'),
    lowCarb: selectedFlags.has('lowCarb'),
    allergies,
    restrictions,
  };
}

function generateFood(dietary: DietaryPreferences, rng: () => number): FoodPreferences {
  const cuisines = pickMultiple(CUISINE_IDS, 1, 4, rng);
  const favorites = pickMultiple(INGREDIENT_POOL, 3, 8, rng);

  // Disliked ingredients: 0-3, no overlap with favorites
  const availableForDislike = INGREDIENT_POOL.filter((i) => !favorites.includes(i));
  const disliked = pickMultiple(availableForDislike, 0, 3, rng);

  return {
    favoriteIngredients: favorites,
    dislikedIngredients: disliked,
    preferredCuisines: cuisines,
    allergies: [...dietary.allergies],
  };
}

function generateCooking(rng: () => number): {
  cooking: CookingPreferences;
  householdSize: number;
} {
  const skillLevel = pickRandom(ALL_SKILLS, rng);
  const cookingFrequency = pickRandom(ALL_FREQUENCIES, rng);
  const preferredCookingDuration = pickRandom(ALL_DURATIONS, rng);

  // Meal types: 2-4, always including dinner
  const otherMealTypes = ALL_MEAL_TYPES.filter((m) => m !== 'dinner');
  const extraMeals = pickMultiple(otherMealTypes, 1, 3, rng);
  const mealTypes: MealType[] = ['dinner', ...extraMeals];

  const instruments = pickMultiple(ALL_INSTRUMENTS, 2, 5, rng);

  // Household size 1-5, serving size correlated
  const householdSize = randomInt(1, 5, rng);
  const servingSizePreference = Math.max(1, Math.min(6, householdSize + randomInt(-1, 1, rng)));

  const weeklyMealPrepCount = randomInt(3, 14, rng);

  return {
    cooking: {
      cookingFrequency,
      preferredCookingDuration,
      skillLevel,
      mealTypes,
      servingSizePreference,
      weeklyMealPrepCount,
      householdSize,
      kitchenInstruments: instruments,
    },
    householdSize,
  };
}

function generateBudget(rng: () => number): BudgetPreferences {
  // Budget $20-$150/week in $5 increments
  const amount = randomInt(4, 30, rng) * 5;
  return { amount, frequency: 'weekly' };
}

function generateEngagementTier(rng: () => number): EngagementTier {
  // 40% medium, 30% high, 30% low
  const roll = rng();
  if (roll < 0.3) return 'high';
  if (roll < 0.7) return 'medium';
  return 'low';
}

function generateStartDate(index: number, count: number, rng: () => number): string {
  // Distribute across Jan-Oct (months 0-9)
  // Each profile gets a base month, then a random day within that month
  const month = Math.floor((index / count) * 10);
  const day = randomInt(1, 28, rng); // 28 to avoid month-end issues
  const year = 2025;
  const monthStr = String(month + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate `count` random profiles using a seeded PRNG for reproducibility.
 *
 * @param count  Number of random profiles to generate (default 10).
 * @param seed   Integer seed for the PRNG (default 42).
 */
export function generateRandomProfiles(count: number = 10, seed: number = 42): ProfileDefinition[] {
  const rng = seedRandom(String(seed));
  const profiles: ProfileDefinition[] = [];

  for (let i = 0; i < count; i++) {
    const name = generateName(i, rng);
    const dietary = generateDietary(rng);
    const food = generateFood(dietary, rng);
    const { cooking } = generateCooking(rng);
    const budget = generateBudget(rng);
    const engagementTier = generateEngagementTier(rng);
    const simulationStartDate = generateStartDate(i, count, rng);

    const preferences: UserPreferences = {
      dietary,
      food,
      cooking,
      budget,
    };

    // Build dietary flags for pantry template selection
    const dietaryFlags: string[] = [];
    if (dietary.vegan) dietaryFlags.push('vegan');
    if (dietary.vegetarian) dietaryFlags.push('vegetarian');
    if (dietary.glutenFree) dietaryFlags.push('glutenFree');
    if (dietary.dairyFree) dietaryFlags.push('dairyFree');
    if (dietary.nutFree) dietaryFlags.push('nutFree');
    if (dietary.lowCarb) dietaryFlags.push('lowCarb');

    const pantryTemplates = getPantryForProfile(dietaryFlags, food.preferredCuisines);
    const startingPantry = templatesToPantryItems(
      pantryTemplates,
      simulationStartDate,
      `random-${String(i + 1).padStart(2, '0')}-pantry`,
    );

    profiles.push({
      name,
      preferences,
      engagementTier,
      startingPantry,
      simulationStartDate,
    });
  }

  return profiles;
}
