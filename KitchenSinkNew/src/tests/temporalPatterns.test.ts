import { buildTemporalProfile, computeTemporalFit, TemporalProfile } from '../ranking/temporalPatterns';
import { RecipeHistoryItem } from '../utils/recipeHistory';

function makeHistoryItem(overrides: Partial<RecipeHistoryItem>): RecipeHistoryItem {
  return {
    recipeId: 'r1',
    usedDate: '2025-10-04T12:00:00Z', // Saturday
    mealType: 'breakfast',
    ...overrides,
  };
}

/**
 * Helper: creates N history items on a specific ISO date string with a given meal type.
 */
function repeatHistory(
  usedDate: string,
  mealType: string,
  count: number,
  recipeIdPrefix: string = 'r',
): RecipeHistoryItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeHistoryItem({ recipeId: `${recipeIdPrefix}${i}`, usedDate, mealType }),
  );
}

describe('buildTemporalProfile', () => {
  it('returns empty profile for empty history', () => {
    const profile = buildTemporalProfile([]);

    expect(profile.totalWeeks).toBe(0);
    expect(profile.dayActivity.get(0)).toBe(0);
    expect(profile.dayMealFrequency.get(0)!.size).toBe(0);
  });

  it('returns totalWeeks of 1 for a single history item', () => {
    const history = [makeHistoryItem({})];

    const profile = buildTemporalProfile(history);

    expect(profile.totalWeeks).toBe(1);
  });

  it('counts meal type frequency per day correctly', () => {
    const history = [
      // Saturday 2025-10-04
      ...repeatHistory('2025-10-04T08:00:00Z', 'breakfast', 3),
      ...repeatHistory('2025-10-04T12:00:00Z', 'lunch', 2),
      // Sunday 2025-10-05
      ...repeatHistory('2025-10-05T09:00:00Z', 'breakfast', 1),
    ];

    const profile = buildTemporalProfile(history);

    const saturdayMeals = profile.dayMealFrequency.get(6)!; // Saturday = 6
    expect(saturdayMeals.get('breakfast')).toBe(3);
    expect(saturdayMeals.get('lunch')).toBe(2);

    const sundayMeals = profile.dayMealFrequency.get(0)!; // Sunday = 0
    expect(sundayMeals.get('breakfast')).toBe(1);
  });

  it('tracks day activity totals correctly', () => {
    const history = [
      ...repeatHistory('2025-10-04T08:00:00Z', 'breakfast', 3),
      ...repeatHistory('2025-10-04T18:00:00Z', 'dinner', 2),
    ];

    const profile = buildTemporalProfile(history);

    expect(profile.dayActivity.get(6)).toBe(5); // Saturday = 6, 3 + 2
  });

  it('normalises snacks to snack', () => {
    const history = [makeHistoryItem({ mealType: 'snacks' })];

    const profile = buildTemporalProfile(history);

    const saturdayMeals = profile.dayMealFrequency.get(6)!;
    expect(saturdayMeals.get('snack')).toBe(1);
    expect(saturdayMeals.has('snacks')).toBe(false);
  });

  it('ignores unrecognised meal types for frequency but counts them in activity', () => {
    const history = [makeHistoryItem({ mealType: 'brunch' })];

    const profile = buildTemporalProfile(history);

    expect(profile.dayActivity.get(6)).toBe(1);
    expect(profile.dayMealFrequency.get(6)!.size).toBe(0);
  });

  it('calculates totalWeeks correctly over a multi-week range', () => {
    const history = [
      makeHistoryItem({ usedDate: '2025-09-01T12:00:00Z' }),
      makeHistoryItem({ usedDate: '2025-10-06T12:00:00Z' }),
    ];

    const profile = buildTemporalProfile(history);

    // Sep 1 to Oct 6 = 35 days = 5 weeks
    expect(profile.totalWeeks).toBe(5);
  });
});

describe('computeTemporalFit', () => {
  it('returns 0.5 when totalWeeks is less than 4', () => {
    const profile: TemporalProfile = {
      dayMealFrequency: new Map(),
      dayActivity: new Map(),
      totalWeeks: 3,
    };

    const score = computeTemporalFit(['breakfast'], profile, 6);

    expect(score).toBe(0.5);
  });

  it('returns high score when user historically cooks breakfast on Saturdays', () => {
    const history = [
      // 8 Saturdays of breakfast, spanning 8+ weeks
      ...repeatHistory('2025-08-02T08:00:00Z', 'breakfast', 1, 'sa'),
      ...repeatHistory('2025-08-09T08:00:00Z', 'breakfast', 1, 'sb'),
      ...repeatHistory('2025-08-16T08:00:00Z', 'breakfast', 1, 'sc'),
      ...repeatHistory('2025-08-23T08:00:00Z', 'breakfast', 1, 'sd'),
      ...repeatHistory('2025-08-30T08:00:00Z', 'breakfast', 1, 'se'),
      ...repeatHistory('2025-09-06T08:00:00Z', 'breakfast', 1, 'sf'),
      ...repeatHistory('2025-09-13T08:00:00Z', 'breakfast', 1, 'sg'),
      ...repeatHistory('2025-09-20T08:00:00Z', 'breakfast', 1, 'sh'),
    ];

    const profile = buildTemporalProfile(history);
    const score = computeTemporalFit(['breakfast', 'quick'], profile, 6);

    expect(score).toBe(1.0);
  });

  it('returns lower score when day has mixed meal types', () => {
    const history = [
      // Spanning enough weeks: Aug 2 to Sep 20 = 7 weeks
      ...repeatHistory('2025-08-02T08:00:00Z', 'breakfast', 3, 'ba'),
      ...repeatHistory('2025-08-02T12:00:00Z', 'lunch', 1, 'la'),
      ...repeatHistory('2025-09-20T18:00:00Z', 'dinner', 1, 'da'),
    ];

    const profile = buildTemporalProfile(history);
    const score = computeTemporalFit(['breakfast'], profile, 6);

    // 3 breakfast out of 5 total Saturday activity = 0.6
    expect(score).toBeCloseTo(0.6, 5);
  });

  it('returns 0.5 when recipe has no recognised meal type tag', () => {
    const history = [
      ...repeatHistory('2025-08-02T08:00:00Z', 'breakfast', 1, 'a'),
      ...repeatHistory('2025-09-20T08:00:00Z', 'breakfast', 1, 'b'),
    ];

    const profile = buildTemporalProfile(history);
    profile.totalWeeks = 5; // force sufficient history
    const score = computeTemporalFit(['quick', 'healthy'], profile, 6);

    expect(score).toBe(0.5);
  });

  it('returns 0 when there is no activity on the target day', () => {
    const history = [
      // Only Saturday data, spanning enough weeks
      ...repeatHistory('2025-08-02T08:00:00Z', 'breakfast', 1, 'a'),
      ...repeatHistory('2025-09-20T08:00:00Z', 'breakfast', 1, 'b'),
    ];

    const profile = buildTemporalProfile(history);
    profile.totalWeeks = 5; // force sufficient history
    const score = computeTemporalFit(['breakfast'], profile, 1); // Monday

    expect(score).toBe(0.0);
  });

  it('handles snacks tag by normalising to snack', () => {
    const history = [
      ...repeatHistory('2025-08-03T15:00:00Z', 'snacks', 2, 'sn'), // Sunday
      ...repeatHistory('2025-09-28T15:00:00Z', 'snacks', 1, 'sx'), // Sunday
    ];

    const profile = buildTemporalProfile(history);
    profile.totalWeeks = 8;
    const score = computeTemporalFit(['snacks'], profile, 0); // Sunday = 0

    expect(score).toBe(1.0);
  });
});
