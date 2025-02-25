/**
 * Utility functions for ingredient name matching and normalization
 */

// Common ingredient name variations and their normalized forms
const INGREDIENT_VARIATIONS: Record<string, string[]> = {
  'tomato': ['tomatoes', 'cherry tomatoes', 'roma tomatoes'],
  'onion': ['onions', 'red onion', 'white onion', 'yellow onion'],
  'potato': ['potatoes', 'sweet potato', 'sweet potatoes', 'russet potato'],
  'carrot': ['carrots', 'baby carrots'],
  'pepper': ['peppers', 'bell pepper', 'bell peppers', 'red pepper', 'green pepper'],
  // Add more variations as needed
};

// Create a reverse lookup for variations
const VARIATION_LOOKUP = Object.entries(INGREDIENT_VARIATIONS).reduce((acc, [main, variations]) => {
  variations.forEach(variant => {
    acc[variant.toLowerCase()] = main.toLowerCase();
  });
  acc[main.toLowerCase()] = main.toLowerCase();
  return acc;
}, {} as Record<string, string>);

/**
 * Normalizes an ingredient name by removing plurals and common variations
 */
export function normalizeIngredientName(ingredient: string): string {
  const lowercased = ingredient.toLowerCase().trim();
  
  // Check if it's a known variation
  if (VARIATION_LOOKUP[lowercased]) {
    return VARIATION_LOOKUP[lowercased];
  }

  // Basic plural removal (if not in our variations dictionary)
  if (lowercased.endsWith('s') && !lowercased.endsWith('ss')) {
    return lowercased.slice(0, -1);
  }

  return lowercased;
}

/**
 * Finds exact or close matches between recipe ingredients and a list of target ingredients
 */
export function findMatchingIngredients(
  recipeIngredients: string[],
  targetIngredients: string[]
): string[] {
  const matches: string[] = [];
  
  for (const recipeIngredient of recipeIngredients) {
    for (const targetIngredient of targetIngredients) {
      if (ingredientsMatch(recipeIngredient, targetIngredient)) {
        matches.push(recipeIngredient);
        break;
      }
    }
  }

  return matches;
}

/**
 * Calculates a similarity score between two ingredients
 * Returns a value between 0 and 1, where 1 means exact match
 */
export function calculateIngredientSimilarity(ing1: string, ing2: string): number {
  const str1 = ing1.toLowerCase();
  const str2 = ing2.toLowerCase();

  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;
  
  // Simple word overlap similarity
  const words1 = new Set(str1.split(' '));
  const words2 = new Set(str2.split(' '));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Checks if two ingredients match (exact match or close enough)
 */
export function ingredientsMatch(ing1: string, ing2: string): boolean {
  const similarity = calculateIngredientSimilarity(ing1, ing2);
  return similarity >= 0.8; // Consider it a match if similarity is high enough
}

/**
 * Calculates the Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the matrix
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str1.length][str2.length];
} 