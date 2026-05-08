import { DietaryPreferences } from '../types/DietaryPreferences';
import { cleanTags } from './tagSanitizer';

/** A recipe shape sufficient for tag-based dietary filtering. */
export interface RecipeWithTags {
  tags?: ReadonlyArray<string>;
}

/**
 * One dietary requirement: which DietaryPreferences flag triggers it,
 * which recipe tags satisfy it, and a human-readable label for diagnostics.
 *
 * vegan also satisfies vegetarian — see VEGAN_TAGS in the requirements list.
 */
export interface DietaryRequirement {
  key: keyof DietaryPreferences;
  tags: ReadonlyArray<string>;
  label: string;
}

/**
 * Source of truth for tag-based dietary filtering.
 *
 * Each requirement lists ALL tag spellings the upstream corpus is known to
 * use (hyphenated and spaced). Most data flows through `recipeMappers.ts`
 * which normalizes to hyphenated, but legacy/seed data may bypass the
 * mapper, so the synonyms guard against silent over-filtering.
 */
export const DIETARY_REQUIREMENTS: ReadonlyArray<DietaryRequirement> = [
  { key: 'vegan',       tags: ['vegan'],                              label: 'vegan' },
  { key: 'vegetarian',  tags: ['vegetarian', 'vegan'],                label: 'vegetarian' },
  { key: 'glutenFree',  tags: ['gluten-free', 'gluten free'],         label: 'gluten-free' },
  { key: 'dairyFree',   tags: ['dairy-free',  'dairy free'],          label: 'dairy-free' },
  { key: 'nutFree',     tags: ['nut-free',    'nut free'],            label: 'nut-free' },
  { key: 'lowCarb',     tags: ['low-carb',    'low carb', 'keto'],    label: 'low-carb' },
];

/**
 * Tag-only map (legacy shape preserved for callers that just need the
 * preference-key → tags mapping without the label). Built from
 * DIETARY_REQUIREMENTS to avoid duplication.
 */
export const DIETARY_TAG_MAP: Readonly<Record<string, ReadonlyArray<string>>> =
  Object.freeze(
    DIETARY_REQUIREMENTS.reduce<Record<string, ReadonlyArray<string>>>(
      (acc, r) => {
        acc[r.key] = r.tags;
        return acc;
      },
      {},
    ),
  );

/**
 * Return the requirements the recipe FAILS to satisfy given the user's
 * boolean dietary flags. Empty array means the recipe is compliant.
 *
 * Allergies and restrictions arrays on DietaryPreferences are out of scope
 * here — they are enforced via ingredient matching elsewhere.
 */
export function missingDietaryRequirements(
  recipe: RecipeWithTags,
  prefs: Partial<DietaryPreferences>,
): DietaryRequirement[] {
  const tags = cleanTags(recipe.tags);
  const missing: DietaryRequirement[] = [];
  for (const req of DIETARY_REQUIREMENTS) {
    const flag = prefs[req.key];
    // Only enforce when the user has the flag set to a truthy boolean.
    if (typeof flag !== 'boolean' || !flag) continue;
    const hit = req.tags.some(t => tags.includes(t));
    if (!hit) missing.push(req);
  }
  return missing;
}

/** True iff the recipe satisfies every required dietary tag for the prefs. */
export function passesDietaryFilter(
  recipe: RecipeWithTags,
  prefs: Partial<DietaryPreferences>,
): boolean {
  return missingDietaryRequirements(recipe, prefs).length === 0;
}

/** Filters a list of recipes down to those that pass the dietary filter. */
export function filterByDiet<T extends RecipeWithTags>(
  recipes: ReadonlyArray<T>,
  prefs: Partial<DietaryPreferences>,
): T[] {
  return recipes.filter(r => passesDietaryFilter(r, prefs));
}
