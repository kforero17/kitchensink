import { UnifiedRecipe } from '../shared/interfaces';

export interface ScoreMeta {
  similarity: number;
  pantryMatch: number;
  source: 'tasty' | 'spoonacular';
  rank: number;
}

export interface RecommendationPayload extends UnifiedRecipe {
  scoreMeta: ScoreMeta;
  servedAt: number; // epoch millis
} 