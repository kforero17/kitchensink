import { UnifiedRecipe } from '../shared/interfaces';
import { computeFeatures, FeatureContext, FeatureVector } from './featureEngineering';
import { RecommendationPayload } from '../types/Recommendation';

export interface RankingWeights {
  sim: number;
  pantry: number;
  popularity: number;
  novelty: number;
  sourceBias: number;
  expiryUrgency: number;
}

/**
 * Default weighting tuned for:
 *  – Highest emphasis on ingredient / preference alignment (`sim`)
 *  – Strong emphasis on pantry overlap (`pantry`)
 *  – Expiry urgency encourages using ingredients before they spoil
 *  – Moderate emphasis on variety / freshness (`novelty`)
 *  – Popularity still matters but less dominant
 *  – Small bias term reserved for source fine-tuning
 *  Weights sum to 1.0 for clarity.
 */
const DEFAULT_WEIGHTS: RankingWeights = {
  sim: 0.35,
  pantry: 0.25,
  popularity: 0.10,
  novelty: 0.10,
  sourceBias: 0.05,
  expiryUrgency: 0.15,
};

export interface RankRecipesOptions extends FeatureContext {
  weights?: Partial<RankingWeights>;
}

export interface ScoredRecipe {
  recipe: UnifiedRecipe;
  features: FeatureVector;
  score: number;
}

export function rankRecipes(recipes: UnifiedRecipe[], opts: RankRecipesOptions): ScoredRecipe[] {
  const weights: RankingWeights = { ...DEFAULT_WEIGHTS, ...opts.weights } as RankingWeights;

  const scored: ScoredRecipe[] = recipes.map(rec => {
    const feats = computeFeatures(rec, opts);
    const score = feats.sim * weights.sim +
      feats.pantry * weights.pantry +
      feats.popularity * weights.popularity +
      feats.novelty * weights.novelty +
      feats.sourceBias * weights.sourceBias +
      feats.expiryUrgency * weights.expiryUrgency;
    return { recipe: rec, features: feats, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function buildRecommendationPayloads(scored: ScoredRecipe[]): RecommendationPayload[] {
  const now = Date.now();
  return scored.map((item, idx) => ({
    ...item.recipe,
    scoreMeta: {
      similarity: parseFloat(item.features.sim.toFixed(4)),
      pantryMatch: parseFloat(item.features.pantry.toFixed(4)),
      source: item.recipe.source,
      rank: idx + 1,
    },
    servedAt: now,
  }));
} 