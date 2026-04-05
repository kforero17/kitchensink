import { RecipeHistoryItem } from '../utils/recipeHistory';
import {
  getSeason,
  buildSeasonalProfile,
  computeSeasonalFit,
  Season,
  SeasonalProfile,
} from './seasonalSignal';

function makeHistoryItem(overrides: Partial<RecipeHistoryItem>): RecipeHistoryItem {
  return {
    recipeId: 'r1',
    usedDate: new Date().toISOString(),
    mealType: 'dinner',
    ...overrides,
  };
}

describe('getSeason', () => {
  it('returns spring for March', () => {
    expect(getSeason(new Date('2025-03-15'))).toBe('spring');
  });

  it('returns spring for May', () => {
    expect(getSeason(new Date('2025-05-01'))).toBe('spring');
  });

  it('returns summer for June', () => {
    expect(getSeason(new Date('2025-06-21'))).toBe('summer');
  });

  it('returns summer for August', () => {
    expect(getSeason(new Date('2025-08-31'))).toBe('summer');
  });

  it('returns fall for September', () => {
    expect(getSeason(new Date('2025-09-15'))).toBe('fall');
  });

  it('returns fall for November', () => {
    expect(getSeason(new Date('2025-11-30'))).toBe('fall');
  });

  it('returns winter for December', () => {
    expect(getSeason(new Date('2025-12-25'))).toBe('winter');
  });

  it('returns winter for January', () => {
    expect(getSeason(new Date('2025-01-15'))).toBe('winter');
  });

  it('returns winter for February', () => {
    expect(getSeason(new Date('2025-02-28'))).toBe('winter');
  });
});

describe('buildSeasonalProfile', () => {
  it('counts tag occurrences per season correctly', () => {
    const history: RecipeHistoryItem[] = [
      makeHistoryItem({ recipeId: 'soup1', usedDate: '2025-01-10T00:00:00Z' }),
      makeHistoryItem({ recipeId: 'soup1', usedDate: '2025-12-05T00:00:00Z' }),
      makeHistoryItem({ recipeId: 'soup1', usedDate: '2025-07-15T00:00:00Z' }),
    ];

    const tagLookup = new Map<string, string[]>([
      ['soup1', ['soup', 'comfort']],
    ]);

    const profile = buildSeasonalProfile(history, tagLookup);

    expect(profile.tagSeasonal.get('soup')!.get('winter')).toBe(2);
    expect(profile.tagSeasonal.get('soup')!.get('summer')).toBe(1);
    expect(profile.tagSeasonal.get('comfort')!.get('winter')).toBe(2);
    expect(profile.tagSeasonal.get('comfort')!.get('summer')).toBe(1);
  });

  it('handles multiple recipes with different tags', () => {
    const history: RecipeHistoryItem[] = [
      makeHistoryItem({ recipeId: 'soup1', usedDate: '2025-01-10T00:00:00Z' }),
      makeHistoryItem({ recipeId: 'salad1', usedDate: '2025-07-15T00:00:00Z' }),
    ];

    const tagLookup = new Map<string, string[]>([
      ['soup1', ['soup']],
      ['salad1', ['salad', 'light']],
    ]);

    const profile = buildSeasonalProfile(history, tagLookup);

    expect(profile.tagSeasonal.get('soup')!.get('winter')).toBe(1);
    expect(profile.tagSeasonal.get('salad')!.get('summer')).toBe(1);
    expect(profile.tagSeasonal.get('light')!.get('summer')).toBe(1);
  });

  it('returns empty profile for empty history', () => {
    const profile = buildSeasonalProfile([], new Map());

    expect(profile.tagSeasonal.size).toBe(0);
  });

  it('skips recipes not found in tag lookup', () => {
    const history: RecipeHistoryItem[] = [
      makeHistoryItem({ recipeId: 'unknown', usedDate: '2025-01-10T00:00:00Z' }),
    ];

    const tagLookup = new Map<string, string[]>();

    const profile = buildSeasonalProfile(history, tagLookup);

    expect(profile.tagSeasonal.size).toBe(0);
  });

  it('skips recipes with empty tag arrays', () => {
    const history: RecipeHistoryItem[] = [
      makeHistoryItem({ recipeId: 'r1', usedDate: '2025-01-10T00:00:00Z' }),
    ];

    const tagLookup = new Map<string, string[]>([['r1', []]]);

    const profile = buildSeasonalProfile(history, tagLookup);

    expect(profile.tagSeasonal.size).toBe(0);
  });
});

describe('computeSeasonalFit', () => {
  it('scores high for soup in winter when user historically cooks soup in winter', () => {
    const tagSeasonal = new Map<string, Map<Season, number>>([
      ['soup', new Map<Season, number>([['winter', 8], ['summer', 1], ['spring', 1]])],
      ['comfort', new Map<Season, number>([['winter', 7], ['fall', 3]])],
    ]);
    const profile: SeasonalProfile = { tagSeasonal };

    const score = computeSeasonalFit(['soup', 'comfort'], profile, 'winter');

    // soup: 8/10 = 0.8, comfort: 7/10 = 0.7, avg = 0.75
    expect(score).toBeCloseTo(0.75, 2);
  });

  it('scores low for soup in summer when user historically cooks soup in winter', () => {
    const tagSeasonal = new Map<string, Map<Season, number>>([
      ['soup', new Map<Season, number>([['winter', 8], ['summer', 1], ['spring', 1]])],
      ['comfort', new Map<Season, number>([['winter', 7], ['fall', 3]])],
    ]);
    const profile: SeasonalProfile = { tagSeasonal };

    const score = computeSeasonalFit(['soup', 'comfort'], profile, 'summer');

    // soup: 1/10 = 0.1, comfort: 0/10 = 0.0, avg = 0.05
    expect(score).toBeCloseTo(0.05, 2);
  });

  it('returns 0.5 fallback when profile has insufficient data', () => {
    const tagSeasonal = new Map<string, Map<Season, number>>([
      ['soup', new Map<Season, number>([['winter', 3]])],
    ]);
    const profile: SeasonalProfile = { tagSeasonal };

    const score = computeSeasonalFit(['soup', 'rare-tag'], profile, 'winter');

    expect(score).toBe(0.5);
  });

  it('returns 0.5 for recipe with no tags', () => {
    const profile: SeasonalProfile = { tagSeasonal: new Map() };

    const score = computeSeasonalFit([], profile, 'winter');

    expect(score).toBe(0.5);
  });

  it('returns 0.5 when no recipe tags match the profile', () => {
    const tagSeasonal = new Map<string, Map<Season, number>>([
      ['soup', new Map<Season, number>([['winter', 5]])],
    ]);
    const profile: SeasonalProfile = { tagSeasonal };

    const score = computeSeasonalFit(['grilled', 'bbq'], profile, 'summer');

    expect(score).toBe(0.5);
  });

  it('returns 0.5 when empty profile', () => {
    const profile: SeasonalProfile = { tagSeasonal: new Map() };

    const score = computeSeasonalFit(['soup', 'comfort'], profile, 'winter');

    expect(score).toBe(0.5);
  });

  it('handles tags where all cooks are in the current season', () => {
    const tagSeasonal = new Map<string, Map<Season, number>>([
      ['grilled', new Map<Season, number>([['summer', 10]])],
      ['bbq', new Map<Season, number>([['summer', 5]])],
    ]);
    const profile: SeasonalProfile = { tagSeasonal };

    const score = computeSeasonalFit(['grilled', 'bbq'], profile, 'summer');

    // grilled: 10/10 = 1.0, bbq: 5/5 = 1.0, avg = 1.0
    expect(score).toBe(1.0);
  });

  it('handles tags where zero cooks are in the current season', () => {
    const tagSeasonal = new Map<string, Map<Season, number>>([
      ['grilled', new Map<Season, number>([['summer', 10]])],
      ['bbq', new Map<Season, number>([['summer', 5]])],
    ]);
    const profile: SeasonalProfile = { tagSeasonal };

    const score = computeSeasonalFit(['grilled', 'bbq'], profile, 'winter');

    // grilled: 0/10 = 0.0, bbq: 0/5 = 0.0, avg = 0.0
    expect(score).toBe(0.0);
  });
});
