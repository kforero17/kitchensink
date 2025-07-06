import { UnifiedRecipe } from '../shared/interfaces';
import { computeFeatures, FeatureContext, FeatureVector } from './featureEngineering';
import { RecommendationPayload } from '../types/Recommendation';

export interface RankingWeights {
  sim: number;
  pantry: number;
  popularity: number;
  novelty: number;
  sourceBias: number; // weight applied to bias value
}

const DEFAULT_WEIGHTS: RankingWeights = {
  sim: 0.4,
  pantry: 0.3,
  popularity: 0.2,
  novelty: 0.05,
  sourceBias: 0.05,
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
      feats.sourceBias * weights.sourceBias;
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