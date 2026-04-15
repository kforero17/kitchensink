/**
 * PantryAction - Manages pantry state during the simulation.
 *
 * Performs two operations:
 * 1. Removes expired items with probability 0.8 (simulating user cleanup)
 * 2. Reduces quantities of pantry ingredients that match today's cooked recipes
 *
 * NOTE: `computeStatus()` from the app uses `new Date()` internally and cannot
 * accept a simulated date. Instead, we compute days-until-expiry manually
 * from `ctx.currentDate`.
 */

import { ActionExecutor, ActionContext } from './ActionExecutor';
import { ActionResult } from '../profiles/types';
import {
  normalizeIngredientName,
  ingredientsMatch,
} from '../bridge/appImports';

const MS_PER_DAY = 86_400_000;

/**
 * Compute the pantry item status relative to a given reference date,
 * bypassing the app's `computeStatus()` which uses `new Date()`.
 */
function computeSimulatedStatus(
  expirationDate: string | undefined,
  referenceDate: Date,
): 'fresh' | 'normal' | 'expiring' | 'expired' {
  if (!expirationDate) return 'normal';

  const daysUntilExpiry =
    (new Date(expirationDate).getTime() - referenceDate.getTime()) / MS_PER_DAY;

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 2) return 'expiring';
  if (daysUntilExpiry <= 5) return 'normal';
  return 'fresh';
}

export class PantryAction implements ActionExecutor {
  readonly type = 'update_pantry' as const;

  async execute(ctx: ActionContext): Promise<ActionResult> {
    try {
      const { currentState, firestore, uid, currentDate } = ctx;
      const rng = ctx.rng;
      const pantryItems = currentState.pantryItems;

      const removedIds: string[] = [];
      const updatedIds: string[] = [];

      // 1. Identify and probabilistically remove expired items
      for (const item of pantryItems) {
        const status = computeSimulatedStatus(item.expirationDate, currentDate);

        if (status === 'expired' && rng() < 0.8) {
          await firestore.removePantryItem(uid, item.id);
          removedIds.push(item.id);
        }
      }

      // Build the set of items that survived removal
      const removedSet = new Set(removedIds);
      const remainingItems = pantryItems.filter(p => !removedSet.has(p.id));

      // 2. Reduce quantities for cooked recipes
      const cookedToday = currentState.cookedToday;
      if (cookedToday.length > 0) {
        // Gather all ingredients from today's cooked recipes
        const cookedIngredients: Array<{ name: string; amount: number }> = [];
        for (const recipeId of cookedToday) {
          const recipe = currentState.currentMealPlan.find(
            r => r.id === recipeId,
          );
          if (recipe) {
            for (const ing of recipe.ingredients) {
              cookedIngredients.push({
                name: normalizeIngredientName(ing.name),
                amount: ing.amount,
              });
            }
          }
        }

        // Match cooked ingredients against remaining pantry items and reduce
        for (const pantryItem of remainingItems) {
          const normalizedPantryName = normalizeIngredientName(pantryItem.name);
          let totalReduction = 0;

          for (const cooked of cookedIngredients) {
            if (ingredientsMatch(normalizedPantryName, cooked.name)) {
              totalReduction += cooked.amount;
            }
          }

          if (totalReduction > 0) {
            const newQuantity = Math.max(0, pantryItem.quantity - totalReduction);
            if (newQuantity <= 0) {
              await firestore.removePantryItem(uid, pantryItem.id);
              removedIds.push(pantryItem.id);
            } else {
              await firestore.updatePantryItem(uid, pantryItem.id, {
                quantity: newQuantity,
              });
              updatedIds.push(pantryItem.id);
            }
          }
        }
      }

      return {
        type: this.type,
        success: true,
        data: {
          removedCount: removedIds.length,
          updatedCount: updatedIds.length,
          removedIds,
          updatedIds,
        },
      };
    } catch (err: any) {
      return {
        type: this.type,
        success: false,
        error: `PantryAction failed: ${err.message ?? err}`,
      };
    }
  }
}
