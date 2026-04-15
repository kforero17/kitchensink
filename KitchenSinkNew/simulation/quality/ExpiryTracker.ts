/**
 * ExpiryTracker - Measures how effectively the meal plan rescues expiring items.
 *
 * On each day the tracker identifies pantry items that are either already
 * marked with status 'expiring' or whose `expirationDate` falls within the
 * next 3 days.  It then checks whether any recipe in the current meal plan
 * references that ingredient (via normalised token overlap).
 *
 * Final metrics:
 *   rescueRate   = totalRescued / totalExpiring   (1.0 when nothing is expiring)
 *   totalExpiring  cumulative count of expiring items observed
 *   totalRescued   cumulative count of expiring items matched by plan recipes
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics } from '../profiles/types';
import { normalizeIngredientName } from '../bridge/appImports';
import { PantryItem } from '@app/types/PantryItem';

/** Days-to-expiry threshold below which an item is considered "expiring". */
const EXPIRY_HORIZON_DAYS = 3;

export class ExpiryTracker implements MetricTracker {
  readonly name = 'expiryDriven';

  private totalExpiring = 0;
  private totalRescued = 0;

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    const pantry = snapshot.stateAfter.pantryItems;
    const recipes = snapshot.stateAfter.currentMealPlan;
    const today = snapshot.date; // ISO date string e.g. "2025-06-15"

    // Identify expiring pantry items.
    const expiringItems = pantry.filter(item =>
      isExpiring(item, today),
    );

    if (expiringItems.length === 0) return;

    // Build normalised recipe ingredient token set once.
    const recipeTokens = new Set<string>();
    for (const recipe of recipes) {
      for (const ing of recipe.ingredients) {
        const tokens = tokenize(normalizeIngredientName(ing.name));
        for (const t of tokens) {
          recipeTokens.add(t);
        }
      }
    }

    let rescued = 0;
    for (const item of expiringItems) {
      const pantryTokens = tokenize(normalizeIngredientName(item.name));
      if (pantryTokens.some(t => recipeTokens.has(t))) {
        rescued++;
      }
    }

    this.totalExpiring += expiringItems.length;
    this.totalRescued += rescued;
  }

  finalize(): QualityMetrics['expiryDriven'] {
    const rescueRate =
      this.totalExpiring === 0
        ? 1.0
        : this.totalRescued / this.totalExpiring;

    return {
      rescueRate,
      totalExpiring: this.totalExpiring,
      totalRescued: this.totalRescued,
    };
  }

  reset(): void {
    this.totalExpiring = 0;
    this.totalRescued = 0;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine whether a pantry item is expiring (by status or date proximity). */
function isExpiring(item: PantryItem, todayISO: string): boolean {
  // Explicit status takes priority.
  if (item.status === 'expiring') return true;

  // Fall back to date arithmetic.
  if (!item.expirationDate) return false;

  const todayMs = new Date(todayISO).getTime();
  const expiryMs = new Date(item.expirationDate).getTime();
  const diffDays = (expiryMs - todayMs) / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= EXPIRY_HORIZON_DAYS;
}

/** Split a normalised name into meaningful tokens (>2 chars). */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2);
}
