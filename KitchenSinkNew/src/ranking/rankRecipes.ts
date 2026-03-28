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
  feedback: number;
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
  sim: 0.30,
  pantry: 0.20,
  popularity: 0.08,
  novelty: 0.10,
  sourceBias: 0.05,
  expiryUrgency: 0.12,
  feedback: 0.15,
};

const PANTRY_ONLY_WEIGHTS: RankingWeights = {
  sim: 0.15,
  pantry: 0.25,
  popularity: 0.03,
  novelty: 0.05,
  sourceBias: 0.05,
  expiryUrgency: 0.30,
  feedback: 0.17,
};

export interface RankRecipesOptions extends FeatureContext {
  weights?: Partial<RankingWeights>;
  pantryOnlyMode?: boolean;
  pantryMatchThreshold?: number;
}

export interface ScoredRecipe {
  recipe: UnifiedRecipe;
  features: FeatureVector;
  score: number;
}

export function rankRecipes(recipes: UnifiedRecipe[], opts: RankRecipesOptions): ScoredRecipe[] {
  const baseWeights = opts.pantryOnlyMode ? PANTRY_ONLY_WEIGHTS : DEFAULT_WEIGHTS;
  const weights: RankingWeights = { ...baseWeights, ...opts.weights } as RankingWeights;

  const scored: ScoredRecipe[] = recipes.map(rec => {
    const feats = computeFeatures(rec, opts);
    const score = feats.sim * weights.sim +
      feats.pantry * weights.pantry +
      feats.popularity * weights.popularity +
      feats.novelty * weights.novelty +
      feats.sourceBias * weights.sourceBias +
      feats.expiryUrgency * weights.expiryUrgency +
      feats.feedback * weights.feedback;
    return { recipe: rec, features: feats, score };
  });

  if (opts.pantryOnlyMode) {
    const threshold = opts.pantryMatchThreshold ?? 0.6;
    const filtered = scored.filter(s => s.features.pantry >= threshold);
    if (filtered.length >= 3) {
      filtered.sort((a, b) => b.score - a.score);
      return filtered;
    }
  }

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