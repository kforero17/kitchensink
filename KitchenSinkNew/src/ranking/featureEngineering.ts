import { UnifiedRecipe } from '../shared/interfaces';

export interface FeatureVector {
  sim: number;            // cosine / token similarity to user profile
  pantry: number;         // overlap of recipe ingredients with pantry [0,1]
  popularity: number;     // normalised popularityScore [0,1]
  novelty: number;        // 1 if unseen else 0
  sourceBias: number;     // bias based on source
  readyInMinutesNorm?: number; // optional extra feature
}

export interface FeatureContext {
  userTokens: string[];         // tokenised user profile (fav ingredients, preferences)
  pantryIngredients: string[];  // flattened list of pantry ingredient names
  seenRecipeIds?: Set<string>;  // recipes user has already seen / interacted with
  spoonacularBias?: number;     // default -0.05, range -0.1..0.1
}

// ---------- helpers ---------- //
function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
}

function bagOfWords(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  tokens.forEach(t => {
    map.set(t, (map.get(t) ?? 0) + 1);
  });
  return map;
}

function cosineSimilarity(tokensA: string[], tokensB: string[]): number {
  const bowA = bagOfWords(tokensA);
  const bowB = bagOfWords(tokensB);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  bowA.forEach((countA, tok) => {
    if (bowB.has(tok)) {
      dot += countA * (bowB.get(tok) as number);
    }
    normA += countA * countA;
  });
  bowB.forEach(countB => {
    normB += countB * countB;
  });
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------- main ---------- //
export function computeFeatures(recipe: UnifiedRecipe, ctx: FeatureContext): FeatureVector {
  // 1. sim_user_profile – tokens from title + ingredient names VS userTokens
  const recipeTokens = [
    ...tokenize(recipe.title || ''),
    ...recipe.ingredients.flatMap(ing => tokenize(ing?.name || '')),
  ];
  const sim = cosineSimilarity(recipeTokens, ctx.userTokens);

  // 2. pantry_overlap – proportion of recipe ingredients present in pantry
  const pantrySet = new Set(ctx.pantryIngredients.map(p => p.toLowerCase()));
  const overlapCount = recipe.ingredients.filter(ing => {
    if (!ing || !ing.name || typeof ing.name !== 'string') {
      return false;
    }
    return pantrySet.has(ing.name.toLowerCase());
  }).length;
  const pantry = recipe.ingredients.length === 0 ? 0 : overlapCount / recipe.ingredients.length;

  // 3. popularity – already 0-1 normalised if present else 0.5 fallback
  let popularity = recipe.popularityScore ?? 0.5;
  popularity = Math.max(0, Math.min(1, popularity));

  // 4. novelty – 1 if unseen else 0
  const novelty = ctx.seenRecipeIds && ctx.seenRecipeIds.has(recipe.id) ? 0 : 1;

  // 5. source_bias – user‐tuneable bias (penalise/boost spoonacular)
  const sourceBias = recipe.source === 'tasty' ? 0 : (ctx.spoonacularBias ?? -0.05);

  // 6. readyInMinutes_norm (optional) – shorter recipes higher score
  const readyInMinutesNorm = recipe.readyInMinutes ? Math.max(0, Math.min(1, (120 - recipe.readyInMinutes) / 120)) : undefined;

  return { sim, pantry, popularity, novelty, sourceBias, readyInMinutesNorm };
} 