import { buildFeedbackMap, buildSeenRecipeIds } from '../ranking/feedbackSignal';
import { RecipeFeedback } from '../services/recipeFeedbackService';

function makeFeedback(overrides: Partial<RecipeFeedback>): RecipeFeedback {
  return {
    recipeId: 'r1',
    userId: 'u1',
    isCooked: false,
    isLiked: false,
    isDisliked: false,
    rating: 0,
    feedbackDate: new Date(),
    ...overrides,
  };
}

describe('buildFeedbackMap', () => {
  it('liked recipe gets positive score', () => {
    const now = new Date();
    const history = [makeFeedback({ isLiked: true, feedbackDate: now })];
    const map = buildFeedbackMap(history, now);

    expect(map.size).toBe(1);
    const signal = map.get('r1')!;
    expect(signal.score).toBe(1);
    expect(signal.decayedScore).toBeCloseTo(1.0, 2);
  });

  it('disliked recipe gets negative score', () => {
    const now = new Date();
    const history = [makeFeedback({ isDisliked: true, feedbackDate: now })];
    const map = buildFeedbackMap(history, now);

    expect(map.size).toBe(1);
    const signal = map.get('r1')!;
    expect(signal.score).toBe(-1);
    expect(signal.decayedScore).toBeCloseTo(-1.0, 2);
  });

  it('rating maps to [-1, 1] range', () => {
    const now = new Date();

    const map5 = buildFeedbackMap(
      [makeFeedback({ recipeId: 'r5', rating: 5, feedbackDate: now })],
      now,
    );
    expect(map5.get('r5')!.score).toBe(1.0);

    const map1 = buildFeedbackMap(
      [makeFeedback({ recipeId: 'r1', rating: 1, feedbackDate: now })],
      now,
    );
    expect(map1.get('r1')!.score).toBe(-1.0);

    // rating=3 maps to score 0, which means it is excluded from the map
    const map3 = buildFeedbackMap(
      [makeFeedback({ recipeId: 'r3', rating: 3, feedbackDate: now })],
      now,
    );
    expect(map3.size).toBe(0);
  });

  it('time decay reduces score', () => {
    const now = new Date('2025-06-01T00:00:00Z');
    const ninetyDaysAgo = new Date('2025-03-03T00:00:00Z');

    const history = [makeFeedback({ isLiked: true, feedbackDate: ninetyDaysAgo })];
    const map = buildFeedbackMap(history, now);

    const signal = map.get('r1')!;
    // exp(-90/90) = exp(-1) ≈ 0.3679
    expect(signal.decayedScore).toBeCloseTo(0.3679, 2);
  });

  it('recent feedback decays less than old feedback', () => {
    const now = new Date('2025-06-01T00:00:00Z');
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const history = [
      makeFeedback({ recipeId: 'recent', isLiked: true, feedbackDate: sevenDaysAgo }),
      makeFeedback({ recipeId: 'old', isLiked: true, feedbackDate: oneEightyDaysAgo }),
    ];
    const map = buildFeedbackMap(history, now);

    const recentScore = map.get('recent')!.decayedScore;
    const oldScore = map.get('old')!.decayedScore;
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('no signal (rating=0, not liked, not disliked) excluded from map', () => {
    const now = new Date();
    const history = [makeFeedback({ feedbackDate: now })];
    const map = buildFeedbackMap(history, now);

    expect(map.size).toBe(0);
  });
});

describe('buildSeenRecipeIds', () => {
  it('returns set of all recipe IDs from history', () => {
    const history = [
      makeFeedback({ recipeId: 'a' }),
      makeFeedback({ recipeId: 'b' }),
      makeFeedback({ recipeId: 'c' }),
    ];
    const set = buildSeenRecipeIds(history);

    expect(set.size).toBe(3);
    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(true);
  });
});
