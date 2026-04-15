/**
 * RepetitionInvariant - Detects duplicate recipes within a single meal plan.
 *
 * A meal plan should not contain the same recipe more than once. Duplicates
 * are detected by recipe ID. Violations are severity: 'warning' because
 * duplicates reduce plan quality but do not pose a safety concern.
 */

import { InvariantRule } from './InvariantChecker';
import { UnifiedRecipe } from '../bridge/appImports';
import { SimulationProfile, InvariantViolation } from '../profiles/types';

export class RepetitionInvariant implements InvariantRule {
  readonly name = 'RepetitionInvariant';

  check(
    plan: UnifiedRecipe[],
    profile: SimulationProfile,
    dayIndex: number,
    date: string,
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const seen = new Set<string>();

    for (const recipe of plan) {
      if (seen.has(recipe.id)) {
        violations.push({
          profileId: profile.id,
          dayIndex,
          date,
          type: 'repetition',
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          detail: `Recipe "${recipe.title}" (${recipe.id}) appears more than once in the meal plan`,
          severity: 'warning',
        });
      } else {
        seen.add(recipe.id);
      }
    }

    return violations;
  }
}
