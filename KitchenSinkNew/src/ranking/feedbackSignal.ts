import { RecipeFeedback } from '../services/recipeFeedbackService';

export interface FeedbackSignal {
  score: number;       // raw score [-1, 1]
  decayedScore: number; // after time decay
}

const DECAY_CONSTANT = 90; // days — exp(-t/90), half-life ~62 days

function computeDecay(daysSinceFeedback: number): number {
  return Math.exp(-daysSinceFeedback / DECAY_CONSTANT);
}

function computeRawScore(feedback: RecipeFeedback): number {
  let score = 0;
  let signals = 0;

  if (feedback.isLiked) { score += 1; signals++; }
  if (feedback.isDisliked) { score -= 1; signals++; }
  if (feedback.rating > 0) {
    score += (feedback.rating - 3) / 2; // maps 1-5 → [-1, +1]
    signals++;
  }

  return signals > 0 ? score / signals : 0;
}

export function buildFeedbackMap(
  history: RecipeFeedback[],
  now: Date = new Date(),
): Map<string, FeedbackSignal> {
  const map = new Map<string, FeedbackSignal>();

  for (const fb of history) {
    const rawScore = computeRawScore(fb);
    if (rawScore === 0) continue;

    const feedbackDate = fb.feedbackDate instanceof Date ? fb.feedbackDate : new Date(fb.feedbackDate);
    const daysSince = Math.max(0, (now.getTime() - feedbackDate.getTime()) / (1000 * 60 * 60 * 24));
    const decay = computeDecay(daysSince);

    map.set(fb.recipeId, {
      score: rawScore,
      decayedScore: rawScore * decay,
    });
  }

  return map;
}

export function buildSeenRecipeIds(history: RecipeFeedback[]): Set<string> {
  return new Set(history.map(fb => fb.recipeId));
}
