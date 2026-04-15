/**
 * Pantry templates for simulation profiles.
 *
 * Each template defines a set of starting pantry items appropriate for a
 * given dietary restriction or cuisine style. Items are stored as templates
 * (without id or concrete expiration date) and resolved to full PantryItem
 * objects at profile-creation time using the profile's simulation start date.
 */

import { PantryItem } from '@app/types/PantryItem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute an ISO-8601 date string offset from a base date by a number of days.
 */
export function offsetDate(baseDate: string, daysOffset: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Template type
// ---------------------------------------------------------------------------

/**
 * A pantry item template without id or concrete expiration date.
 * `expiryDaysFromStart` is the number of days after the simulation start
 * date that the item expires.
 */
export interface PantryTemplate {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiryDaysFromStart: number;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const PANTRY_TEMPLATES: Record<string, PantryTemplate[]> = {
  vegan: [
    { name: 'Tofu', quantity: 2, unit: 'lbs', category: 'protein', expiryDaysFromStart: 7 },
    { name: 'Tempeh', quantity: 1, unit: 'lbs', category: 'protein', expiryDaysFromStart: 10 },
    { name: 'Nutritional Yeast', quantity: 8, unit: 'oz', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Coconut Milk', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 120 },
    { name: 'Lentils', quantity: 2, unit: 'lbs', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Chickpeas', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Quinoa', quantity: 2, unit: 'lbs', category: 'grains', expiryDaysFromStart: 120 },
    { name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Tahini', quantity: 1, unit: 'jar', category: 'condiments', expiryDaysFromStart: 180 },
    { name: 'Almond Butter', quantity: 1, unit: 'jar', category: 'condiments', expiryDaysFromStart: 120 },
    { name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Soy Sauce', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
  ],

  vegetarian: [
    { name: 'Eggs', quantity: 12, unit: 'count', category: 'dairy', expiryDaysFromStart: 21 },
    { name: 'Cheese', quantity: 1, unit: 'lbs', category: 'dairy', expiryDaysFromStart: 14 },
    { name: 'Milk', quantity: 1, unit: 'gallon', category: 'dairy', expiryDaysFromStart: 10 },
    { name: 'Butter', quantity: 1, unit: 'lbs', category: 'dairy', expiryDaysFromStart: 30 },
    { name: 'Yogurt', quantity: 32, unit: 'oz', category: 'dairy', expiryDaysFromStart: 14 },
    { name: 'Tofu', quantity: 2, unit: 'lbs', category: 'protein', expiryDaysFromStart: 7 },
    { name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Pasta', quantity: 3, unit: 'lbs', category: 'grains', expiryDaysFromStart: 120 },
    { name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Nuts', quantity: 1, unit: 'lbs', category: 'pantry_staples', expiryDaysFromStart: 90 },
    { name: 'Flour', quantity: 5, unit: 'lbs', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Sugar', quantity: 4, unit: 'lbs', category: 'pantry_staples', expiryDaysFromStart: 365 },
  ],

  gluten_free: [
    { name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Quinoa', quantity: 2, unit: 'lbs', category: 'grains', expiryDaysFromStart: 120 },
    { name: 'Corn Tortillas', quantity: 2, unit: 'packs', category: 'grains', expiryDaysFromStart: 14 },
    { name: 'Potatoes', quantity: 5, unit: 'lbs', category: 'produce', expiryDaysFromStart: 21 },
    { name: 'Almond Flour', quantity: 2, unit: 'lbs', category: 'pantry_staples', expiryDaysFromStart: 90 },
    { name: 'Coconut Flour', quantity: 1, unit: 'lbs', category: 'pantry_staples', expiryDaysFromStart: 120 },
    { name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Eggs', quantity: 12, unit: 'count', category: 'dairy', expiryDaysFromStart: 21 },
    { name: 'Chicken Breast', quantity: 2, unit: 'lbs', category: 'protein', expiryDaysFromStart: 5 },
    { name: 'Black Beans', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 180 },
  ],

  dairy_free: [
    { name: 'Oat Milk', quantity: 2, unit: 'cartons', category: 'pantry_staples', expiryDaysFromStart: 10 },
    { name: 'Coconut Cream', quantity: 2, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 120 },
    { name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Avocado', quantity: 4, unit: 'count', category: 'produce', expiryDaysFromStart: 5 },
    { name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Chicken Breast', quantity: 2, unit: 'lbs', category: 'protein', expiryDaysFromStart: 5 },
    { name: 'Garlic', quantity: 1, unit: 'head', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Onions', quantity: 3, unit: 'count', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Tomatoes', quantity: 4, unit: 'count', category: 'produce', expiryDaysFromStart: 7 },
    { name: 'Black Beans', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 180 },
  ],

  mediterranean: [
    { name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Feta Cheese', quantity: 8, unit: 'oz', category: 'dairy', expiryDaysFromStart: 14 },
    { name: 'Olives', quantity: 1, unit: 'jar', category: 'condiments', expiryDaysFromStart: 180 },
    { name: 'Hummus', quantity: 16, unit: 'oz', category: 'pantry_staples', expiryDaysFromStart: 10 },
    { name: 'Pita Bread', quantity: 1, unit: 'pack', category: 'grains', expiryDaysFromStart: 7 },
    { name: 'Tahini', quantity: 1, unit: 'jar', category: 'condiments', expiryDaysFromStart: 180 },
    { name: 'Lemons', quantity: 6, unit: 'count', category: 'produce', expiryDaysFromStart: 14 },
    { name: 'Garlic', quantity: 2, unit: 'heads', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Tomatoes', quantity: 6, unit: 'count', category: 'produce', expiryDaysFromStart: 7 },
    { name: 'Chickpeas', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Lamb', quantity: 2, unit: 'lbs', category: 'protein', expiryDaysFromStart: 5 },
    { name: 'Yogurt', quantity: 32, unit: 'oz', category: 'dairy', expiryDaysFromStart: 14 },
  ],

  asian: [
    { name: 'Soy Sauce', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Rice', quantity: 10, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Ginger', quantity: 4, unit: 'oz', category: 'produce', expiryDaysFromStart: 14 },
    { name: 'Garlic', quantity: 2, unit: 'heads', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Sesame Oil', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Tofu', quantity: 2, unit: 'lbs', category: 'protein', expiryDaysFromStart: 7 },
    { name: 'Noodles', quantity: 3, unit: 'packs', category: 'grains', expiryDaysFromStart: 120 },
    { name: 'Coconut Milk', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 120 },
    { name: 'Fish Sauce', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Sriracha', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Green Onions', quantity: 2, unit: 'bunches', category: 'produce', expiryDaysFromStart: 7 },
    { name: 'Rice Vinegar', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
  ],

  mexican: [
    { name: 'Tortillas', quantity: 2, unit: 'packs', category: 'grains', expiryDaysFromStart: 14 },
    { name: 'Black Beans', quantity: 4, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Avocados', quantity: 4, unit: 'count', category: 'produce', expiryDaysFromStart: 5 },
    { name: 'Salsa', quantity: 1, unit: 'jar', category: 'condiments', expiryDaysFromStart: 90 },
    { name: 'Cheese', quantity: 1, unit: 'lbs', category: 'dairy', expiryDaysFromStart: 14 },
    { name: 'Cilantro', quantity: 1, unit: 'bunch', category: 'produce', expiryDaysFromStart: 7 },
    { name: 'Limes', quantity: 6, unit: 'count', category: 'produce', expiryDaysFromStart: 14 },
    { name: 'Jalape\u00f1os', quantity: 6, unit: 'count', category: 'produce', expiryDaysFromStart: 14 },
    { name: 'Cumin', quantity: 4, unit: 'oz', category: 'spices', expiryDaysFromStart: 365 },
  ],

  indian: [
    { name: 'Basmati Rice', quantity: 5, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Lentils', quantity: 3, unit: 'lbs', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Chickpeas', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 180 },
    { name: 'Ghee', quantity: 16, unit: 'oz', category: 'condiments', expiryDaysFromStart: 180 },
    { name: 'Turmeric', quantity: 4, unit: 'oz', category: 'spices', expiryDaysFromStart: 365 },
    { name: 'Cumin', quantity: 4, unit: 'oz', category: 'spices', expiryDaysFromStart: 365 },
    { name: 'Coriander', quantity: 4, unit: 'oz', category: 'spices', expiryDaysFromStart: 365 },
    { name: 'Garam Masala', quantity: 4, unit: 'oz', category: 'spices', expiryDaysFromStart: 365 },
    { name: 'Coconut Milk', quantity: 3, unit: 'cans', category: 'pantry_staples', expiryDaysFromStart: 120 },
    { name: 'Onions', quantity: 5, unit: 'count', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Garlic', quantity: 2, unit: 'heads', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Ginger', quantity: 4, unit: 'oz', category: 'produce', expiryDaysFromStart: 14 },
  ],

  american: [
    { name: 'Chicken Breast', quantity: 3, unit: 'lbs', category: 'protein', expiryDaysFromStart: 5 },
    { name: 'Ground Beef', quantity: 2, unit: 'lbs', category: 'protein', expiryDaysFromStart: 3 },
    { name: 'Pasta', quantity: 3, unit: 'lbs', category: 'grains', expiryDaysFromStart: 120 },
    { name: 'Bread', quantity: 1, unit: 'loaf', category: 'grains', expiryDaysFromStart: 7 },
    { name: 'Eggs', quantity: 12, unit: 'count', category: 'dairy', expiryDaysFromStart: 21 },
    { name: 'Milk', quantity: 1, unit: 'gallon', category: 'dairy', expiryDaysFromStart: 10 },
    { name: 'Butter', quantity: 1, unit: 'lbs', category: 'dairy', expiryDaysFromStart: 30 },
    { name: 'Cheese', quantity: 1, unit: 'lbs', category: 'dairy', expiryDaysFromStart: 14 },
    { name: 'Potatoes', quantity: 5, unit: 'lbs', category: 'produce', expiryDaysFromStart: 21 },
    { name: 'Ketchup', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 180 },
  ],

  default: [
    { name: 'Rice', quantity: 5, unit: 'lbs', category: 'grains', expiryDaysFromStart: 180 },
    { name: 'Pasta', quantity: 2, unit: 'lbs', category: 'grains', expiryDaysFromStart: 120 },
    { name: 'Olive Oil', quantity: 1, unit: 'bottle', category: 'condiments', expiryDaysFromStart: 365 },
    { name: 'Eggs', quantity: 12, unit: 'count', category: 'dairy', expiryDaysFromStart: 21 },
    { name: 'Onions', quantity: 3, unit: 'count', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Garlic', quantity: 1, unit: 'head', category: 'produce', expiryDaysFromStart: 30 },
    { name: 'Tomatoes', quantity: 4, unit: 'count', category: 'produce', expiryDaysFromStart: 7 },
    { name: 'Salt', quantity: 26, unit: 'oz', category: 'spices', expiryDaysFromStart: 365 },
    { name: 'Pepper', quantity: 4, unit: 'oz', category: 'spices', expiryDaysFromStart: 365 },
    { name: 'Butter', quantity: 1, unit: 'lbs', category: 'dairy', expiryDaysFromStart: 30 },
  ],
};

// ---------------------------------------------------------------------------
// Cuisine to template key mapping
// ---------------------------------------------------------------------------

const CUISINE_TO_TEMPLATE: Record<string, string> = {
  italian: 'mediterranean',
  greek: 'mediterranean',
  spanish: 'mediterranean',
  french: 'mediterranean',
  mediterranean: 'mediterranean',
  mexican: 'mexican',
  caribbean: 'mexican',
  chinese: 'asian',
  japanese: 'asian',
  thai: 'asian',
  vietnamese: 'asian',
  korean: 'asian',
  indian: 'indian',
  middle_eastern: 'indian',
  american: 'american',
};

// ---------------------------------------------------------------------------
// Template selection helper
// ---------------------------------------------------------------------------

/**
 * Select pantry templates for a profile based on dietary flags and cuisine
 * preferences.
 *
 * Priority:
 *   1. Dietary-specific template (vegan > gluten_free > dairy_free > vegetarian)
 *   2. Cuisine-specific template (first matching cuisine)
 *   3. Default template
 *
 * The dietary template forms the base. Items from the cuisine template that
 * are not already present (by name) are merged in. The result is capped at
 * 15 items to keep pantries a manageable size.
 */
export function getPantryForProfile(
  dietaryFlags: string[],
  cuisines: string[],
): PantryTemplate[] {
  // Determine the primary dietary template
  let dietaryTemplate: PantryTemplate[] | undefined;
  if (dietaryFlags.includes('vegan')) {
    dietaryTemplate = PANTRY_TEMPLATES.vegan;
  } else if (dietaryFlags.includes('glutenFree')) {
    dietaryTemplate = PANTRY_TEMPLATES.gluten_free;
  } else if (dietaryFlags.includes('dairyFree')) {
    dietaryTemplate = PANTRY_TEMPLATES.dairy_free;
  } else if (dietaryFlags.includes('vegetarian')) {
    dietaryTemplate = PANTRY_TEMPLATES.vegetarian;
  }

  // Determine the cuisine template
  let cuisineTemplate: PantryTemplate[] | undefined;
  for (const cuisine of cuisines) {
    const key = CUISINE_TO_TEMPLATE[cuisine];
    if (key && PANTRY_TEMPLATES[key]) {
      cuisineTemplate = PANTRY_TEMPLATES[key];
      break;
    }
  }

  // If we have neither, fall back to default
  if (!dietaryTemplate && !cuisineTemplate) {
    return [...PANTRY_TEMPLATES.default];
  }

  // Start with the dietary template or cuisine template
  const base = dietaryTemplate ? [...dietaryTemplate] : [];
  const supplement = dietaryTemplate ? cuisineTemplate : undefined;

  // If we only have a cuisine template and no dietary, use it as the base
  if (!dietaryTemplate && cuisineTemplate) {
    return cuisineTemplate.slice(0, 15);
  }

  // Merge cuisine items that are not already in the base
  if (supplement) {
    const existingNames = new Set(base.map((item) => item.name.toLowerCase()));
    for (const item of supplement) {
      if (!existingNames.has(item.name.toLowerCase())) {
        base.push(item);
        existingNames.add(item.name.toLowerCase());
      }
      if (base.length >= 15) break;
    }
  }

  return base.slice(0, 15);
}

// ---------------------------------------------------------------------------
// PantryItem factory
// ---------------------------------------------------------------------------

/**
 * Convert an array of PantryTemplate objects into fully-resolved PantryItem
 * objects with sequential IDs and concrete expiration dates.
 */
export function templatesToPantryItems(
  templates: PantryTemplate[],
  simulationStartDate: string,
  idPrefix: string = 'pantry',
): PantryItem[] {
  return templates.map((template, index): PantryItem => {
    const id = `${idPrefix}-${String(index + 1).padStart(3, '0')}`;
    return {
      id,
      name: template.name,
      quantity: template.quantity,
      unit: template.unit,
      category: template.category,
      expirationDate: offsetDate(simulationStartDate, template.expiryDaysFromStart),
      status: 'fresh',
    };
  });
}
