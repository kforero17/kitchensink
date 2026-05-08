/**
 * DietaryInvariant - Validates that every recipe in a meal plan respects
 * the user's dietary preferences, allergies, and restrictions.
 *
 * All dietary violations are severity: 'critical' because serving a user
 * food that violates their dietary needs is a serious correctness failure.
 */

import { InvariantRule } from './InvariantChecker';
import { UnifiedRecipe, ingredientsMatch } from '../bridge/appImports';
import { SimulationProfile, InvariantViolation } from '../profiles/types';
import { DIETARY_REQUIREMENTS } from '../../src/utils/dietaryFilter';

// ---------------------------------------------------------------------------
// Restriction ingredient mapping
// ---------------------------------------------------------------------------

const RESTRICTION_INGREDIENTS: Record<string, string[]> = {
  no_red_meat: ['beef', 'lamb', 'pork'],
  no_poultry: ['chicken', 'turkey', 'duck'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasTag(recipe: UnifiedRecipe, targets: ReadonlyArray<string>): boolean {
  const recipeTags = recipe.tags.map(t => t.toLowerCase());
  return targets.some(target => recipeTags.includes(target.toLowerCase()));
}

function buildViolation(
  profileId: string,
  dayIndex: number,
  date: string,
  recipe: UnifiedRecipe,
  detail: string,
): InvariantViolation {
  return {
    profileId,
    dayIndex,
    date,
    type: 'dietary',
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    detail,
    severity: 'critical',
  };
}

// ---------------------------------------------------------------------------
// DietaryInvariant
// ---------------------------------------------------------------------------

export class DietaryInvariant implements InvariantRule {
  readonly name = 'DietaryInvariant';

  check(
    plan: UnifiedRecipe[],
    profile: SimulationProfile,
    dayIndex: number,
    date: string,
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const dietary = profile.preferences.dietary;

    for (const recipe of plan) {
      // 1. Boolean dietary preference checks (tag-based)
      this.checkDietaryTags(recipe, dietary, profile.id, dayIndex, date, violations);

      // 2. Allergy checks (ingredient-based)
      this.checkAllergies(recipe, dietary.allergies, profile.id, dayIndex, date, violations);

      // 3. Restriction checks (ingredient-based)
      this.checkRestrictions(recipe, dietary.restrictions, profile.id, dayIndex, date, violations);
    }

    return violations;
  }

  private checkDietaryTags(
    recipe: UnifiedRecipe,
    dietary: SimulationProfile['preferences']['dietary'],
    profileId: string,
    dayIndex: number,
    date: string,
    violations: InvariantViolation[],
  ): void {
    for (const req of DIETARY_REQUIREMENTS) {
      if (!dietary[req.key]) continue;

      if (!hasTag(recipe, req.tags)) {
        violations.push(
          buildViolation(
            profileId,
            dayIndex,
            date,
            recipe,
            `Recipe "${recipe.title}" lacks required ${req.label} tag for ${req.key} preference`,
          ),
        );
      }
    }
  }

  private checkAllergies(
    recipe: UnifiedRecipe,
    allergies: string[],
    profileId: string,
    dayIndex: number,
    date: string,
    violations: InvariantViolation[],
  ): void {
    if (!allergies || allergies.length === 0) return;

    const ingredientNames = recipe.ingredients.map(i => i.name);

    for (const allergen of allergies) {
      // Check ingredient names using the app's fuzzy matcher
      const matchesIngredient = ingredientNames.some(name =>
        ingredientsMatch(name, allergen),
      );
      // Also check recipe title
      const matchesTitle = ingredientsMatch(recipe.title, allergen);

      if (matchesIngredient || matchesTitle) {
        violations.push(
          buildViolation(
            profileId,
            dayIndex,
            date,
            recipe,
            `Recipe "${recipe.title}" may contain allergen "${allergen}"`,
          ),
        );
      }
    }
  }

  private checkRestrictions(
    recipe: UnifiedRecipe,
    restrictions: string[],
    profileId: string,
    dayIndex: number,
    date: string,
    violations: InvariantViolation[],
  ): void {
    if (!restrictions || restrictions.length === 0) return;

    const ingredientNames = recipe.ingredients.map(i => i.name);

    for (const restriction of restrictions) {
      const forbiddenIngredients = RESTRICTION_INGREDIENTS[restriction];

      if (restriction === 'no_cooked_food') {
        this.checkNoCookedFood(recipe, profileId, dayIndex, date, violations);
        continue;
      }

      if (!forbiddenIngredients) continue;

      for (const forbidden of forbiddenIngredients) {
        const matchesIngredient = ingredientNames.some(name =>
          ingredientsMatch(name, forbidden),
        );
        const matchesTitle = ingredientsMatch(recipe.title, forbidden);

        if (matchesIngredient || matchesTitle) {
          violations.push(
            buildViolation(
              profileId,
              dayIndex,
              date,
              recipe,
              `Recipe "${recipe.title}" contains "${forbidden}" which violates restriction "${restriction}"`,
            ),
          );
          // One violation per restriction per recipe is sufficient
          break;
        }
      }
    }
  }

  private checkNoCookedFood(
    recipe: UnifiedRecipe,
    profileId: string,
    dayIndex: number,
    date: string,
    violations: InvariantViolation[],
  ): void {
    // Recipe must have a 'raw' tag or not have cooking-method tags
    const recipeTags = recipe.tags.map(t => t.toLowerCase());
    const hasRawTag = recipeTags.includes('raw');

    if (!hasRawTag) {
      // Check for cooking method indicators in tags
      const cookingMethodPatterns = [
        /\b(bak(e|ed|ing))\b/i,
        /\b(roast(ed|ing)?)\b/i,
        /\b(grill(ed|ing)?)\b/i,
        /\b(fr(y|ied|ying))\b/i,
        /\b(saut[eé](ed|ing)?)\b/i,
        /\b(boil(ed|ing)?)\b/i,
        /\b(steam(ed|ing)?)\b/i,
        /\b(stew(ed|ing)?)\b/i,
      ];

      const tagString = recipeTags.join(' ');
      const hasCookingMethod = cookingMethodPatterns.some(p => p.test(tagString));

      if (hasCookingMethod) {
        violations.push(
          buildViolation(
            profileId,
            dayIndex,
            date,
            recipe,
            `Recipe "${recipe.title}" appears to require cooking, violating "no_cooked_food" restriction`,
          ),
        );
      }
    }
  }
}
