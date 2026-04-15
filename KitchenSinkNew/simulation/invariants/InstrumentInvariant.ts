/**
 * InstrumentInvariant - Validates that recipes do not require kitchen
 * instruments the user does not own.
 *
 * Instruments are detected by matching regex patterns against the recipe
 * title and tags. If a recipe requires an instrument the user has not
 * listed in `preferences.cooking.kitchenInstruments`, a warning-level
 * violation is emitted. Recipes with no detected instruments always pass.
 */

import { InvariantRule } from './InvariantChecker';
import { UnifiedRecipe, KitchenInstrument } from '../bridge/appImports';
import { SimulationProfile, InvariantViolation } from '../profiles/types';

// ---------------------------------------------------------------------------
// Instrument detection patterns
// ---------------------------------------------------------------------------

const INSTRUMENT_KEYWORDS: Record<string, RegExp> = {
  oven: /\b(bak(e|ed|ing)|roast(ed|ing)?|oven)\b/i,
  grill: /\b(grill(ed|ing)?|bbq|barbecue)\b/i,
  air_fryer: /\b(air[- ]?fr(y|ied|yer|ying))\b/i,
  slow_cooker: /\b(slow[- ]?cook(er|ed|ing)?|crock[- ]?pot)\b/i,
  pressure_cooker: /\b(pressure[- ]?cook(er|ed|ing)?|instant[- ]?pot)\b/i,
  microwave: /\b(microwave[d]?)\b/i,
  stove_top: /\b(saut[eé](ed|ing)?|stir[- ]?fr(y|ied|ying)|pan[- ]?fr(y|ied|ying)|boil(ed|ing)?|simmer(ed|ing)?|stove)\b/i,
  toaster_oven: /\b(toast(er|ed|ing)?[- ]?oven)\b/i,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect which instruments a recipe likely requires based on its title and tags.
 */
export function detectInstruments(recipe: UnifiedRecipe): string[] {
  const searchText = [recipe.title, ...recipe.tags].join(' ');
  const detected: string[] = [];

  for (const [instrument, pattern] of Object.entries(INSTRUMENT_KEYWORDS)) {
    if (pattern.test(searchText)) {
      detected.push(instrument);
    }
  }

  return detected;
}

// ---------------------------------------------------------------------------
// InstrumentInvariant
// ---------------------------------------------------------------------------

export class InstrumentInvariant implements InvariantRule {
  readonly name = 'InstrumentInvariant';

  check(
    plan: UnifiedRecipe[],
    profile: SimulationProfile,
    dayIndex: number,
    date: string,
  ): InvariantViolation[] {
    const userInstruments = new Set<string>(
      profile.preferences.cooking.kitchenInstruments ?? [],
    );

    // If the user has not specified any instruments, skip the check entirely.
    // We cannot know what they own, so we cannot flag violations.
    if (userInstruments.size === 0) {
      return [];
    }

    const violations: InvariantViolation[] = [];

    for (const recipe of plan) {
      const requiredInstruments = detectInstruments(recipe);

      // Recipes with no detected instruments always pass.
      if (requiredInstruments.length === 0) continue;

      for (const instrument of requiredInstruments) {
        if (!userInstruments.has(instrument)) {
          violations.push({
            profileId: profile.id,
            dayIndex,
            date,
            type: 'instrument',
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            detail: `Recipe "${recipe.title}" requires "${instrument}" which is not in the user's kitchen instruments`,
            severity: 'warning',
          });
        }
      }
    }

    return violations;
  }
}
