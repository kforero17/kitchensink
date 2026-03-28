/**
 * Smart Grocery List utility
 *
 * Subtracts pantry items from grocery lists, consolidates quantities,
 * and groups by store aisle so users only see what they actually need to buy.
 */

import { GroceryItem } from '../types/FirestoreSchema';
import { PantryItem } from '../types/PantryItem';
import { ingredientsMatch, normalizeIngredientName } from './ingredientMatching';
import { computeStatus } from './pantryStatus';

export interface SmartGroceryItem {
  name: string;
  measurement: string;
  category: string;
  aisle: number;
  recipeIds: string[];
  recipeNames: string[];
  recommendedPackage: string;
  inPantry: boolean;
  pantryNote?: string;
}

const AISLE_ORDER: Record<string, number> = {
  'Produce': 1,
  'Meat & Seafood': 2,
  'Dairy & Eggs': 3,
  'Frozen': 4,
  'Grains & Bakery': 5,
  'Pantry': 6,
  'Beverages': 7,
  'Snacks & Sweets': 8,
  'Other': 9,
};

/**
 * Builds a smart grocery list by consolidating items, subtracting pantry
 * inventory, assigning aisles, and sorting by aisle then name.
 */
export function buildSmartGroceryList(
  groceryItems: GroceryItem[],
  pantryItems: PantryItem[],
): SmartGroceryItem[] {
  // 1. Filter pantry — exclude expired items
  const activePantry = pantryItems.filter(p => computeStatus(p.expirationDate) !== 'expired');

  // 2. Consolidate grocery items by normalized name
  const consolidated = new Map<string, SmartGroceryItem>();

  for (const item of groceryItems) {
    const key = normalizeIngredientName(item.name);

    if (consolidated.has(key)) {
      const existing = consolidated.get(key)!;

      if (item.recipeId && !existing.recipeIds.includes(item.recipeId)) {
        existing.recipeIds.push(item.recipeId);
      }
      if (item.recipeName && !existing.recipeNames.includes(item.recipeName)) {
        existing.recipeNames.push(item.recipeName);
      }
    } else {
      consolidated.set(key, {
        name: item.name,
        measurement: item.measurement,
        category: item.category,
        aisle: AISLE_ORDER[item.category] ?? AISLE_ORDER['Other'],
        recipeIds: item.recipeId ? [item.recipeId] : [],
        recipeNames: item.recipeName ? [item.recipeName] : [],
        recommendedPackage: item.recommendedPackage ?? '',
        inPantry: false,
      });
    }
  }

  // 3. Check pantry — mark items that are already in stock
  for (const [, smartItem] of consolidated) {
    for (const pantryItem of activePantry) {
      if (ingredientsMatch(smartItem.name, pantryItem.name)) {
        smartItem.inPantry = true;
        smartItem.pantryNote = `Have ${pantryItem.quantity} ${pantryItem.unit}`;
        break;
      }
    }
  }

  // 4. Sort by aisle ascending, then name alphabetically within aisle
  const result = Array.from(consolidated.values());

  result.sort((a, b) => {
    if (a.aisle !== b.aisle) {
      return a.aisle - b.aisle;
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  return result;
}

/**
 * Returns a summary of the smart grocery list including how many items
 * were removed by pantry subtraction and how many aisles remain.
 */
export function getSmartListSummary(items: SmartGroceryItem[]): {
  totalItems: number;
  removedByPantry: number;
  aisleCount: number;
} {
  const removedByPantry = items.filter(i => i.inPantry).length;
  const aisleCount = new Set(items.filter(i => !i.inPantry).map(i => i.aisle)).size;

  return {
    totalItems: items.filter(i => !i.inPantry).length,
    removedByPantry,
    aisleCount,
  };
}
