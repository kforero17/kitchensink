import { UnifiedRecipe } from '../shared/interfaces';
import { TemporalProfile, computeTemporalFit } from './temporalPatterns';
import { Season, SeasonalProfile, computeSeasonalFit } from './seasonalSignal';
import { Leftover } from '../types/Leftover';

export interface FeatureVector {
  sim: number;            // cosine / token similarity to user profile
  pantry: number;         // overlap of recipe ingredients with pantry [0,1]
  popularity: number;     // normalised popularityScore [0,1]
  novelty: number;        // 1 if unseen else 0
  sourceBias: number;     // bias based on source
  expiryUrgency: number;  // max urgency across matched pantry ingredients [0,1]
  feedback: number;       // user's prior rating/like/dislike signal with time decay [-1, 1]
  temporalFit: number;    // day-of-week pattern match [0, 1]
  seasonalFit: number;    // seasonal preference match [0, 1]
  leftoverAware: number;  // leftover complement/redundancy [-0.5, 1]
  readyInMinutesNorm?: number; // optional extra feature
}

export interface PantryIngredientInfo {
  name: string;
  expirationDate?: string; // ISO 8601 date string
}

export interface FeatureContext {
  userTokens: string[];              // tokenised user profile (fav ingredients, preferences)
  pantryIngredients: string[];       // flattened list of pantry ingredient names
  pantryItems?: PantryIngredientInfo[]; // pantry items with expiration info
  seenRecipeIds?: Set<string>;       // recipes user has already seen / interacted with
  spoonacularBias?: number;          // default -0.05, range -0.1..0.1
  feedbackMap?: Map<string, { score: number; decayedScore: number }>;
  targetDay?: number;                     // day of week for temporal fit (0=Sun..6=Sat)
  temporalProfile?: TemporalProfile;      // from temporalPatterns.ts
  seasonalProfile?: SeasonalProfile;      // from seasonalSignal.ts
  currentSeason?: Season;                 // from seasonalSignal.ts
  activeLeftovers?: Leftover[];           // from leftoverService.ts
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

function computeIngredientExpiryUrgency(ingredientName: string, pantryItems: PantryIngredientInfo[]): number {
  const ingTokens = tokenize(ingredientName);
  let maxUrgency = 0;

  for (const item of pantryItems) {
    if (!item.expirationDate) continue;
    const itemTokens = tokenize(item.name);
    const hasOverlap = ingTokens.some(t => itemTokens.includes(t));
    if (!hasOverlap) continue;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(item.expirationDate);
    expiry.setHours(0, 0, 0, 0);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // 1.0 at ≤3 days, linear decay to 0 at 7 days, 0 beyond
    let urgency: number;
    if (days <= 3) urgency = 1.0;
    else if (days >= 7) urgency = 0;
    else urgency = (7 - days) / 4; // linear from 1.0 at day 3 to 0 at day 7

    maxUrgency = Math.max(maxUrgency, urgency);
  }

  return maxUrgency;
}

function computeLeftoverAwareScore(recipe: UnifiedRecipe, activeLeftovers: Leftover[]): number {
  if (activeLeftovers.length === 0) return 0;

  const recipeNameTokens = new Set(tokenize(recipe.title || ''));
  const recipeIngTokens = new Set(
    recipe.ingredients.flatMap(ing => tokenize(ing?.name || ''))
  );
  const allRecipeTokens = new Set([...recipeNameTokens, ...recipeIngTokens]);

  let redundancyScore = 0;
  let complementScore = 0;

  for (const leftover of activeLeftovers) {
    const leftoverTokens = new Set(tokenize(leftover.recipeName));
    if (leftoverTokens.size === 0 || allRecipeTokens.size === 0) continue;

    let overlapCount = 0;
    for (const token of leftoverTokens) {
      if (allRecipeTokens.has(token)) overlapCount++;
    }

    const overlapRatio = overlapCount / leftoverTokens.size;

    if (overlapRatio >= 0.8) {
      redundancyScore = Math.min(redundancyScore, -0.5 * overlapRatio);
    } else if (overlapRatio >= 0.2) {
      const cs = 0.3 + (overlapRatio - 0.2) * (0.7 / 0.6);
      complementScore = Math.max(complementScore, cs);
    }
  }

  // Redundancy takes precedence over complement
  const score = redundancyScore < 0 ? redundancyScore : complementScore;
  return Math.max(-0.5, Math.min(1, score));
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
  const pantryTokens = new Set(
    ctx.pantryIngredients.flatMap(p => tokenize(p))
  );
  const overlapCount = recipe.ingredients.filter(ing => {
    if (!ing?.name) return false;
    return tokenize(ing.name).some(t => pantryTokens.has(t));
  }).length;
  const pantry = recipe.ingredients.length === 0 ? 0 : overlapCount / recipe.ingredients.length;

  // 3. popularity – already 0-1 normalised if present else 0.5 fallback
  let popularity = recipe.popularityScore ?? 0.5;
  popularity = Math.max(0, Math.min(1, popularity));

  // 4. novelty – 1 if unseen else 0
  const novelty = ctx.seenRecipeIds && ctx.seenRecipeIds.has(recipe.id) ? 0 : 1;

  // 5. source_bias – user‐tuneable bias (penalise/boost spoonacular)
  const sourceBias = recipe.source === 'tasty' ? 0 : (ctx.spoonacularBias ?? -0.05);

  // 6. expiry_urgency – max urgency across matched pantry ingredients
  let expiryUrgency = 0;
  if (ctx.pantryItems && ctx.pantryItems.length > 0) {
    for (const ing of recipe.ingredients) {
      if (!ing?.name) continue;
      const urgency = computeIngredientExpiryUrgency(ing.name, ctx.pantryItems);
      expiryUrgency = Math.max(expiryUrgency, urgency);
    }
  }

  // 7. feedback – user's prior rating/like/dislike signal with time decay
  const feedbackSignal = ctx.feedbackMap?.get(recipe.id);
  const feedback = feedbackSignal?.decayedScore ?? 0;

  // 8. temporal_fit – day-of-week pattern match
  const temporalFit = (ctx.temporalProfile && ctx.targetDay !== undefined)
    ? computeTemporalFit(recipe.tags || [], ctx.temporalProfile, ctx.targetDay)
    : 0.5;

  // 9. seasonal_fit – seasonal preference match
  const seasonalFit = (ctx.seasonalProfile && ctx.currentSeason)
    ? computeSeasonalFit(recipe.tags || [], ctx.seasonalProfile, ctx.currentSeason)
    : 0.5;

  // 10. leftover_aware – complement/redundancy with active leftovers
  const leftoverAware = ctx.activeLeftovers
    ? computeLeftoverAwareScore(recipe, ctx.activeLeftovers)
    : 0;

  // 11. readyInMinutes_norm (optional) – shorter recipes higher score
  const readyInMinutesNorm = recipe.readyInMinutes ? Math.max(0, Math.min(1, (120 - recipe.readyInMinutes) / 120)) : undefined;

  return { sim, pantry, popularity, novelty, sourceBias, expiryUrgency, feedback, temporalFit, seasonalFit, leftoverAware, readyInMinutesNorm };
} 