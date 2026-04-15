/**
 * GroceryRestockAction - Restocks the pantry from the current meal plan.
 *
 * Identifies ingredients needed by the meal plan that are not already in the
 * pantry, "purchases" them by adding pantry items with category-appropriate
 * expiration dates, and saves a grocery list document to Firestore.
 */

import { ActionExecutor, ActionContext } from './ActionExecutor';
import { ActionResult } from '../profiles/types';
import {
  normalizeIngredientName,
  ingredientsMatch,
} from '../bridge/appImports';

// ---------------------------------------------------------------------------
// Ingredient categorisation
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  produce: [
    'lettuce', 'tomato', 'onion', 'garlic', 'pepper', 'carrot', 'celery',
    'broccoli', 'spinach', 'kale', 'cucumber', 'zucchini', 'mushroom',
    'potato', 'sweet potato', 'corn', 'avocado', 'lemon', 'lime', 'orange',
    'apple', 'banana', 'berry', 'strawberry', 'blueberry', 'raspberry',
    'grape', 'mango', 'pineapple', 'peach', 'pear', 'watermelon', 'melon',
    'cilantro', 'parsley', 'basil', 'mint', 'dill', 'thyme', 'rosemary',
    'chives', 'scallion', 'shallot', 'ginger', 'jalapeño', 'jalapeno',
    'cabbage', 'eggplant', 'cauliflower', 'asparagus', 'artichoke',
    'green bean', 'pea', 'radish', 'beet', 'squash', 'turnip', 'leek',
    'fennel', 'arugula', 'watercress', 'endive', 'chard', 'collard',
    'kiwi', 'fig', 'plum', 'apricot', 'cherry', 'pomegranate', 'papaya',
  ],
  dairy: [
    'milk', 'cheese', 'yogurt', 'butter', 'cream', 'sour cream',
    'cream cheese', 'cottage cheese', 'mozzarella', 'parmesan', 'cheddar',
    'ricotta', 'feta', 'gouda', 'brie', 'whipping cream', 'half and half',
    'buttermilk', 'ghee', 'kefir',
  ],
  meat: [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'veal',
    'bacon', 'ham', 'sausage', 'ground beef', 'ground turkey',
    'steak', 'roast', 'ribs', 'tenderloin', 'thigh', 'breast',
    'drumstick', 'wing', 'chop', 'loin', 'brisket', 'sirloin',
  ],
  seafood: [
    'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'crab', 'lobster',
    'mussels', 'scallop', 'halibut', 'trout', 'catfish', 'swordfish',
    'anchovy', 'sardine', 'clam', 'oyster', 'squid', 'octopus', 'prawn',
    'fish', 'bass', 'mackerel', 'snapper', 'mahi',
  ],
  frozen: [
    'frozen', 'ice cream', 'popsicle', 'frozen pizza', 'frozen vegetable',
    'frozen fruit', 'frozen dinner', 'frozen fry', 'frozen waffle',
  ],
};

/** Expiration day ranges by category [min, max] (inclusive). */
const EXPIRY_DAYS: Record<string, [number, number]> = {
  produce: [5, 10],
  dairy: [7, 14],
  meat: [3, 5],
  seafood: [3, 5],
  frozen: [30, 90],
  pantry_staple: [60, 180],
};

/**
 * Categorise an ingredient name using keyword matching.
 * Falls back to "pantry_staple" for anything that does not match
 * a perishable category.
 */
function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category;
    }
  }
  return 'pantry_staple';
}

/**
 * Compute a random expiration date string (ISO) for the given category,
 * relative to the current simulated date.
 */
function computeExpirationDate(
  category: string,
  currentDate: Date,
  rng: () => number,
): string {
  const [minDays, maxDays] = EXPIRY_DAYS[category] ?? EXPIRY_DAYS.pantry_staple;
  const days = minDays + Math.floor(rng() * (maxDays - minDays + 1));
  const expiry = new Date(currentDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry.toISOString().split('T')[0];
}

export class GroceryRestockAction implements ActionExecutor {
  readonly type = 'grocery_restock' as const;

  async execute(ctx: ActionContext): Promise<ActionResult> {
    try {
      const { currentState, firestore, uid, currentDate } = ctx;
      const rng = ctx.rng;
      const pantryItems = currentState.pantryItems;
      const mealPlan = currentState.currentMealPlan;

      if (mealPlan.length === 0) {
        return {
          type: this.type,
          success: false,
          error: 'No meal plan to restock from',
        };
      }

      // Build normalised set of current pantry ingredient names
      const pantryNames = pantryItems.map(p =>
        normalizeIngredientName(p.name),
      );

      // Identify needed ingredients from the meal plan
      const neededIngredients: Array<{
        name: string;
        amount: number;
        unit: string;
        recipeId: string;
        recipeName: string;
      }> = [];

      for (const recipe of mealPlan) {
        for (const ing of recipe.ingredients) {
          const normalizedName = normalizeIngredientName(ing.name);
          const alreadyInPantry = pantryNames.some(pn =>
            ingredientsMatch(pn, normalizedName),
          );
          if (!alreadyInPantry) {
            neededIngredients.push({
              name: ing.name,
              amount: ing.amount,
              unit: ing.unit,
              recipeId: recipe.id,
              recipeName: recipe.title,
            });
          }
        }
      }

      // Deduplicate by normalised name, summing amounts
      const deduped = new Map<
        string,
        { name: string; amount: number; unit: string; recipeId: string; recipeName: string }
      >();
      for (const ing of neededIngredients) {
        const key = normalizeIngredientName(ing.name);
        const existing = deduped.get(key);
        if (existing) {
          existing.amount += ing.amount;
        } else {
          deduped.set(key, { ...ing });
        }
      }

      // "Purchase" items -- add to pantry with realistic expiration dates
      const addedIds: string[] = [];
      const groceryItems: Array<{
        name: string;
        measurement: string;
        category: string;
        recipeId?: string;
        recipeName?: string;
      }> = [];

      for (const [, ing] of deduped) {
        const category = categorizeIngredient(ing.name);
        const expirationDate = computeExpirationDate(category, currentDate, rng);

        const id = await firestore.addPantryItem(uid, {
          name: ing.name,
          quantity: ing.amount,
          unit: ing.unit,
          category,
          expirationDate,
          status: 'fresh',
        });
        addedIds.push(id);

        groceryItems.push({
          name: ing.name,
          measurement: `${ing.amount} ${ing.unit}`,
          category,
          recipeId: ing.recipeId,
          recipeName: ing.recipeName,
        });
      }

      // Save grocery list document
      if (groceryItems.length > 0) {
        await firestore.saveGroceryList(uid, {
          name: `Restock - ${currentDate.toISOString().split('T')[0]}`,
          items: groceryItems,
          generatedAt: currentDate.toISOString(),
        });
      }

      return {
        type: this.type,
        success: true,
        data: {
          itemsPurchased: addedIds.length,
          addedIds,
          groceryItems: groceryItems.map(g => g.name),
        },
      };
    } catch (err: any) {
      return {
        type: this.type,
        success: false,
        error: `GroceryRestockAction failed: ${err.message ?? err}`,
      };
    }
  }
}
