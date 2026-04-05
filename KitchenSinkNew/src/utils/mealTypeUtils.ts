/**
 * Utility for extracting a recognized meal type from recipe tags.
 *
 * Recipe tags can contain arbitrary values like "soup", "italian", "quick", etc.
 * This helper finds the first tag that is a recognized meal type, normalizing
 * "snacks" to "snack" for consistency.
 */

const MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'snacks']);

/**
 * Extracts the first recognized meal type from a list of tags.
 * Returns 'dinner' as the default when no recognized meal type is found.
 */
export function extractMealType(tags?: string[]): string {
  if (!tags) return 'dinner';
  const found = tags.find(t => MEAL_TYPES.has(t.toLowerCase()));
  return found?.toLowerCase() === 'snacks'
    ? 'snack'
    : (found?.toLowerCase() || 'dinner');
}
