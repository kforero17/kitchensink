/**
 * Tests for all quality metric trackers.
 *
 * Each tracker has its own describe block covering normal operation, edge
 * cases, and the reset contract.
 */

import { DiversityTracker } from '../../quality/DiversityTracker';
import { PantryUtilizationTracker } from '../../quality/PantryUtilizationTracker';
import { ExpiryTracker } from '../../quality/ExpiryTracker';
import { FeedbackLoopTracker } from '../../quality/FeedbackLoopTracker';
import { SeasonalFitTracker } from '../../quality/SeasonalFitTracker';
import { QualityTracker } from '../../quality/QualityTracker';
import {
  DaySnapshot,
  DayState,
  ActionResult,
  Season,
} from '../../profiles/types';
import { UnifiedRecipe } from '@app/shared/interfaces';
import { PantryItem } from '@app/types/PantryItem';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRecipe(overrides: Partial<UnifiedRecipe> = {}): UnifiedRecipe {
  return {
    id: overrides.id ?? 'r-1',
    source: 'tasty',
    title: overrides.title ?? 'Test Recipe',
    imageUrl: '',
    readyInMinutes: 30,
    servings: 4,
    ingredients: overrides.ingredients ?? [
      { name: 'chicken', amount: 1, unit: 'lb' },
      { name: 'rice', amount: 2, unit: 'cups' },
    ],
    tags: overrides.tags ?? [],
    ...overrides,
  };
}

function makePantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: overrides.id ?? 'p-1',
    name: overrides.name ?? 'Chicken',
    quantity: overrides.quantity ?? 1,
    unit: overrides.unit ?? 'lb',
    category: overrides.category ?? 'protein',
    ...overrides,
  };
}

function makeDayState(overrides: Partial<DayState> = {}): DayState {
  return {
    pantryItems: overrides.pantryItems ?? [],
    leftovers: overrides.leftovers ?? [],
    currentMealPlan: overrides.currentMealPlan ?? [],
    recipeHistory: overrides.recipeHistory ?? [],
    feedbackHistory: overrides.feedbackHistory ?? [],
    cookedToday: overrides.cookedToday ?? [],
  };
}

function makeSnapshot(overrides: Partial<DaySnapshot> = {}): DaySnapshot {
  return {
    profileId: 'test-profile',
    dayIndex: overrides.dayIndex ?? 0,
    date: overrides.date ?? '2025-06-15',
    season: overrides.season ?? 'summer',
    actionsExecuted: overrides.actionsExecuted ?? [],
    stateAfter: overrides.stateAfter ?? makeDayState(),
    violations: overrides.violations ?? [],
    mealPlanGenerated: overrides.mealPlanGenerated ?? false,
    recipesCooked: overrides.recipesCooked ?? 0,
  };
}

function makeFeedbackAction(
  recipeId: string,
  opts: { isLiked?: boolean; isDisliked?: boolean } = {},
): ActionResult {
  return {
    type: 'give_feedback',
    success: true,
    data: {
      recipeId,
      isLiked: opts.isLiked ?? false,
      isDisliked: opts.isDisliked ?? false,
    },
  };
}

// ---------------------------------------------------------------------------
// DiversityTracker
// ---------------------------------------------------------------------------

describe('DiversityTracker', () => {
  let tracker: DiversityTracker;

  /** Record a plan for `dayIndex` made up of recipes with the given IDs. */
  function recordPlan(
    t: DiversityTracker,
    dayIndex: number,
    ids: string[],
  ): void {
    t.record(
      makeSnapshot({
        dayIndex,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: ids.map(id => makeRecipe({ id })),
        }),
      }),
    );
  }

  beforeEach(() => {
    tracker = new DiversityTracker();
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('diversity');
  });

  it('should default to a 7-day lookback', () => {
    expect(tracker.lookbackDays).toBe(7);
  });

  it('should accept a custom lookback via the constructor', () => {
    const t = new DiversityTracker(3);
    expect(t.lookbackDays).toBe(3);
  });

  it('should emit NaN sentinels when no plans are recorded', () => {
    const result = tracker.finalize();
    expect(result.perDay).toEqual([]);
    expect(result.mean).toBeNaN();
    expect(result.std).toBeNaN();
    expect(result.min).toBeNaN();
    expect(result.max).toBeNaN();
    expect(result.lookbackDays).toBe(7);
    expect(result.skippedDays).toBe(0);
  });

  it('should skip non-plan-generation snapshots', () => {
    tracker.record(makeSnapshot({ mealPlanGenerated: false }));
    const result = tracker.finalize();
    expect(result.perDay).toHaveLength(0);
    expect(result.skippedDays).toBe(0);
  });

  // 6.1 Repeating planner ⇒ novelty ≈ 0
  it('should report zero novelty when every day repeats the same plan', () => {
    const ids = ['r-1', 'r-2', 'r-3', 'r-4', 'r-5', 'r-6', 'r-7'];
    for (let day = 0; day < 14; day++) {
      recordPlan(tracker, day, ids);
    }

    const result = tracker.finalize();
    // Days 7..13 each have a lookback match at D - 7.
    expect(result.perDay).toHaveLength(7);
    expect(result.perDay.every(v => v === 0)).toBe(true);
    expect(result.mean).toBe(0);
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
    expect(result.std).toBe(0);
    expect(result.skippedDays).toBe(7);
  });

  // 6.2 Fully fresh planner ⇒ novelty ≈ 1
  it('should report full novelty when every day is disjoint from 7 days prior', () => {
    for (let day = 0; day < 14; day++) {
      const ids = Array.from({ length: 7 }, (_, i) => `r-${day}-${i}`);
      recordPlan(tracker, day, ids);
    }

    const result = tracker.finalize();
    expect(result.perDay).toHaveLength(7);
    expect(result.perDay.every(v => v === 1)).toBe(true);
    expect(result.mean).toBe(1);
    expect(result.min).toBe(1);
    expect(result.max).toBe(1);
    expect(result.std).toBe(0);
    expect(result.skippedDays).toBe(7);
  });

  // 6.3 Half-overlap ⇒ novelty ≈ 4/7
  it('should compute partial novelty for partially overlapping plans', () => {
    // Repeat 3 of 7 recipes compared to 7 days prior; rotate the other 4.
    const shared = ['s-1', 's-2', 's-3'];
    for (let day = 0; day < 14; day++) {
      const rotating = Array.from({ length: 4 }, (_, i) => `rot-${day}-${i}`);
      recordPlan(tracker, day, [...shared, ...rotating]);
    }

    const result = tracker.finalize();
    expect(result.perDay).toHaveLength(7);
    for (const v of result.perDay) {
      expect(v).toBeCloseTo(4 / 7, 10);
    }
    expect(result.mean).toBeCloseTo(4 / 7, 10);
    expect(result.std).toBeCloseTo(0, 10);
    expect(result.skippedDays).toBe(7);
  });

  // 6.4 Short run < N days
  it('should emit NaN scalars when the run is shorter than the lookback', () => {
    for (let day = 0; day < 5; day++) {
      recordPlan(tracker, day, [`r-${day}-a`, `r-${day}-b`]);
    }

    const result = tracker.finalize();
    expect(result.perDay).toEqual([]);
    expect(result.mean).toBeNaN();
    expect(result.std).toBeNaN();
    expect(result.min).toBeNaN();
    expect(result.max).toBeNaN();
    expect(result.skippedDays).toBe(5);
    expect(result.lookbackDays).toBe(7);
  });

  // 6.5 Custom lookback with lookbackDays=1
  it('should honor a custom lookback of 1 day', () => {
    const custom = new DiversityTracker(1);
    // Day 0: fresh batch A
    recordPlan(custom, 0, ['a-1', 'a-2']);
    // Day 1: identical to day 0 ⇒ novelty 0
    recordPlan(custom, 1, ['a-1', 'a-2']);
    // Day 2: fully fresh batch B ⇒ novelty 1
    recordPlan(custom, 2, ['b-1', 'b-2']);
    // Day 3: identical to day 2 ⇒ novelty 0
    recordPlan(custom, 3, ['b-1', 'b-2']);

    const result = custom.finalize();
    expect(result.perDay).toEqual([0, 1, 0]);
    expect(result.lookbackDays).toBe(1);
    expect(result.skippedDays).toBe(1); // day 0 has no lookback match
  });

  it('should reset internal state', () => {
    recordPlan(tracker, 0, ['r-1']);
    tracker.reset();

    const result = tracker.finalize();
    expect(result.perDay).toHaveLength(0);
    expect(result.skippedDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PantryUtilizationTracker
// ---------------------------------------------------------------------------

describe('PantryUtilizationTracker', () => {
  let tracker: PantryUtilizationTracker;

  beforeEach(() => {
    tracker = new PantryUtilizationTracker();
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('pantryUtilization');
  });

  it('should return zeros when no plans recorded', () => {
    const result = tracker.finalize();
    expect(result).toEqual({ mean: 0, trend: 0, perPlan: [] });
  });

  it('should skip non-plan snapshots', () => {
    tracker.record(makeSnapshot({ mealPlanGenerated: false }));
    expect(tracker.finalize().perPlan).toHaveLength(0);
  });

  it('should return 1.0 utilization when pantry is empty', () => {
    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          pantryItems: [],
          currentMealPlan: [makeRecipe()],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result.perPlan).toEqual([1.0]);
  });

  it('should match pantry items to recipe ingredients via token overlap', () => {
    const pantry = [
      makePantryItem({ name: 'Chicken Breast' }),
      makePantryItem({ id: 'p-2', name: 'Rice' }),
      makePantryItem({ id: 'p-3', name: 'Broccoli' }),
    ];
    const recipes = [
      makeRecipe({
        ingredients: [
          { name: 'chicken', amount: 1, unit: 'lb' },
          { name: 'rice', amount: 2, unit: 'cups' },
        ],
      }),
    ];

    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({ pantryItems: pantry, currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    // chicken breast -> "chicken" token matches "chicken" ingredient
    // rice -> "rice" token matches "rice" ingredient
    // broccoli -> no match
    // 2/3 = 0.6667
    expect(result.perPlan).toHaveLength(1);
    expect(result.perPlan[0]).toBeCloseTo(2 / 3, 4);
  });

  it('should compute positive trend when utilization improves', () => {
    // Utilization increases over 3 plans: 0.0, 0.5, 1.0
    const pantry1 = [makePantryItem({ name: 'Salmon' })];
    const recipes1 = [makeRecipe({ ingredients: [{ name: 'beef', amount: 1, unit: 'lb' }] })];

    const pantry2 = [
      makePantryItem({ name: 'Chicken' }),
      makePantryItem({ id: 'p-2', name: 'Salmon' }),
    ];
    const recipes2 = [makeRecipe({ ingredients: [{ name: 'chicken', amount: 1, unit: 'lb' }] })];

    const pantry3 = [makePantryItem({ name: 'Rice' })];
    const recipes3 = [makeRecipe({ ingredients: [{ name: 'rice', amount: 2, unit: 'cups' }] })];

    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        mealPlanGenerated: true,
        stateAfter: makeDayState({ pantryItems: pantry1, currentMealPlan: recipes1 }),
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        mealPlanGenerated: true,
        stateAfter: makeDayState({ pantryItems: pantry2, currentMealPlan: recipes2 }),
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 2,
        mealPlanGenerated: true,
        stateAfter: makeDayState({ pantryItems: pantry3, currentMealPlan: recipes3 }),
      }),
    );

    const result = tracker.finalize();
    expect(result.trend).toBeGreaterThan(0);
  });

  it('should compute zero trend for a single plan', () => {
    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          pantryItems: [makePantryItem({ name: 'Rice' })],
          currentMealPlan: [makeRecipe({ ingredients: [{ name: 'rice', amount: 1, unit: 'cup' }] })],
        }),
      }),
    );

    expect(tracker.finalize().trend).toBe(0);
  });

  it('should reset internal state', () => {
    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          pantryItems: [makePantryItem()],
          currentMealPlan: [makeRecipe()],
        }),
      }),
    );
    tracker.reset();
    expect(tracker.finalize().perPlan).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ExpiryTracker
// ---------------------------------------------------------------------------

describe('ExpiryTracker', () => {
  let tracker: ExpiryTracker;

  beforeEach(() => {
    tracker = new ExpiryTracker();
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('expiryDriven');
  });

  it('should return rescueRate 1.0 when nothing is expiring', () => {
    tracker.record(
      makeSnapshot({
        stateAfter: makeDayState({
          pantryItems: [makePantryItem({ expirationDate: '2025-12-31' })],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result).toEqual({ rescueRate: 1.0, totalExpiring: 0, totalRescued: 0 });
  });

  it('should detect items with status "expiring"', () => {
    const pantry = [
      makePantryItem({ name: 'Chicken', status: 'expiring' }),
    ];
    const recipes = [
      makeRecipe({ ingredients: [{ name: 'chicken breast', amount: 1, unit: 'lb' }] }),
    ];

    tracker.record(
      makeSnapshot({
        date: '2025-06-15',
        stateAfter: makeDayState({ pantryItems: pantry, currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    expect(result.totalExpiring).toBe(1);
    expect(result.totalRescued).toBe(1);
    expect(result.rescueRate).toBe(1.0);
  });

  it('should detect items expiring within 3 days by date', () => {
    const pantry = [
      makePantryItem({ name: 'Milk', expirationDate: '2025-06-17' }),
    ];
    // No matching recipe.
    const recipes = [
      makeRecipe({ ingredients: [{ name: 'chicken', amount: 1, unit: 'lb' }] }),
    ];

    tracker.record(
      makeSnapshot({
        date: '2025-06-15',
        stateAfter: makeDayState({ pantryItems: pantry, currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    expect(result.totalExpiring).toBe(1);
    expect(result.totalRescued).toBe(0);
    expect(result.rescueRate).toBe(0);
  });

  it('should not flag items with distant expiration dates', () => {
    const pantry = [
      makePantryItem({ name: 'Canned Beans', expirationDate: '2026-01-01' }),
    ];

    tracker.record(
      makeSnapshot({
        date: '2025-06-15',
        stateAfter: makeDayState({ pantryItems: pantry, currentMealPlan: [] }),
      }),
    );

    const result = tracker.finalize();
    expect(result.totalExpiring).toBe(0);
  });

  it('should not flag items with no expirationDate and no status', () => {
    const pantry = [makePantryItem({ name: 'Salt' })];

    tracker.record(
      makeSnapshot({
        stateAfter: makeDayState({ pantryItems: pantry, currentMealPlan: [] }),
      }),
    );

    expect(tracker.finalize().totalExpiring).toBe(0);
  });

  it('should accumulate across multiple days', () => {
    const pantry1 = [makePantryItem({ name: 'Chicken', status: 'expiring' })];
    const pantry2 = [makePantryItem({ name: 'Rice', status: 'expiring' })];
    const recipes = [
      makeRecipe({ ingredients: [{ name: 'chicken', amount: 1, unit: 'lb' }] }),
    ];

    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        date: '2025-06-15',
        stateAfter: makeDayState({ pantryItems: pantry1, currentMealPlan: recipes }),
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        date: '2025-06-16',
        stateAfter: makeDayState({ pantryItems: pantry2, currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    expect(result.totalExpiring).toBe(2);
    // chicken matched, rice not matched
    expect(result.totalRescued).toBe(1);
    expect(result.rescueRate).toBe(0.5);
  });

  it('should reset internal state', () => {
    tracker.record(
      makeSnapshot({
        stateAfter: makeDayState({
          pantryItems: [makePantryItem({ name: 'X', status: 'expiring' })],
          currentMealPlan: [],
        }),
      }),
    );
    tracker.reset();
    const result = tracker.finalize();
    expect(result).toEqual({ rescueRate: 1.0, totalExpiring: 0, totalRescued: 0 });
  });
});

// ---------------------------------------------------------------------------
// FeedbackLoopTracker
// ---------------------------------------------------------------------------

describe('FeedbackLoopTracker', () => {
  let tracker: FeedbackLoopTracker;

  beforeEach(() => {
    tracker = new FeedbackLoopTracker();
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('feedbackLoop');
  });

  it('should return zeros when no feedback recorded', () => {
    const result = tracker.finalize();
    expect(result).toEqual({
      positiveCorrelation: 0,
      negativeCorrelation: 0,
      netEffectiveness: 0,
    });
  });

  it('should detect positive correlation when liked recipe reappears', () => {
    // Plan 0 -> feedback liked r-1 -> Plan 1 includes r-1
    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' }), makeRecipe({ id: 'r-2' })],
        }),
        actionsExecuted: [makeFeedbackAction('r-1', { isLiked: true })],
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' }), makeRecipe({ id: 'r-3' })],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result.positiveCorrelation).toBe(1.0);
    expect(result.negativeCorrelation).toBe(0);
    expect(result.netEffectiveness).toBe(1.0);
  });

  it('should detect negative correlation when disliked recipe reappears', () => {
    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
        actionsExecuted: [makeFeedbackAction('r-1', { isDisliked: true })],
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result.negativeCorrelation).toBe(1.0);
    expect(result.netEffectiveness).toBe(-1.0);
  });

  it('should report zero correlation when liked recipe does not reappear', () => {
    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
        actionsExecuted: [makeFeedbackAction('r-1', { isLiked: true })],
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-99' })],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result.positiveCorrelation).toBe(0);
  });

  it('should only look ahead 2 plans from the feedback event', () => {
    // Plan 0 (feedback) -> Plan 1 (no match) -> Plan 2 (no match) -> Plan 3 (match but out of range)
    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
        actionsExecuted: [makeFeedbackAction('r-1', { isLiked: true })],
      }),
    );
    for (let i = 1; i <= 2; i++) {
      tracker.record(
        makeSnapshot({
          dayIndex: i,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [makeRecipe({ id: `r-other-${i}` })],
          }),
        }),
      );
    }
    tracker.record(
      makeSnapshot({
        dayIndex: 3,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result.positiveCorrelation).toBe(0);
  });

  it('should ignore failed feedback actions', () => {
    const failedAction: ActionResult = {
      type: 'give_feedback',
      success: false,
      data: { recipeId: 'r-1', isLiked: true },
    };
    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
        actionsExecuted: [failedAction],
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
      }),
    );

    expect(tracker.finalize().positiveCorrelation).toBe(0);
  });

  it('should reset internal state', () => {
    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
        actionsExecuted: [makeFeedbackAction('r-1', { isLiked: true })],
      }),
    );
    tracker.reset();
    const result = tracker.finalize();
    expect(result.positiveCorrelation).toBe(0);
    expect(result.negativeCorrelation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SeasonalFitTracker
// ---------------------------------------------------------------------------

describe('SeasonalFitTracker', () => {
  let tracker: SeasonalFitTracker;

  beforeEach(() => {
    tracker = new SeasonalFitTracker();
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('seasonalFitScore');
  });

  it('should return zeros and null rank bias when no plans are recorded', () => {
    const result = tracker.finalize();
    expect(result.meanFitScore).toBe(0);
    expect(result.perSeason).toEqual({ spring: 0, summer: 0, fall: 0, winter: 0 });
    expect(result.meanRankBias).toBeNull();
  });

  it('should average prior-only fit across recipes in a single plan', () => {
    // Winter plan: 2 'soup' (winter prior -> 1.0), 2 'salad' (summer prior -> 0.0),
    // 1 'american' (no prior -> 0.5).  Mean = (1 + 1 + 0 + 0 + 0.5) / 5 = 0.5.
    const recipes = [
      makeRecipe({ id: 'r-1', tags: ['soup'] }),
      makeRecipe({ id: 'r-2', tags: ['soup'] }),
      makeRecipe({ id: 'r-3', tags: ['salad'] }),
      makeRecipe({ id: 'r-4', tags: ['salad'] }),
      makeRecipe({ id: 'r-5', tags: ['american'] }),
    ];

    tracker.record(
      makeSnapshot({
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    expect(result.meanFitScore).toBeCloseTo(0.5, 10);
    expect(result.perSeason.winter).toBeCloseTo(0.5, 10);
  });

  it('should aggregate per-season averages across multiple plans', () => {
    // Summer plan with two 'salad' recipes -> both 1.0 -> per-season summer = 1.0.
    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        season: 'summer',
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [
            makeRecipe({ id: 'r-1', tags: ['salad'] }),
            makeRecipe({ id: 'r-2', tags: ['salad'] }),
          ],
        }),
      }),
    );
    // Winter plan with two 'salad' recipes -> both 0.0 -> per-season winter = 0.0.
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [
            makeRecipe({ id: 'r-3', tags: ['salad'] }),
            makeRecipe({ id: 'r-4', tags: ['salad'] }),
          ],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result.perSeason.summer).toBeCloseTo(1.0, 10);
    expect(result.perSeason.winter).toBeCloseTo(0.0, 10);
  });

  it('should emit null meanRankBias (stubbed pending candidate-pool plumbing)', () => {
    tracker.record(
      makeSnapshot({
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ tags: ['soup'] })],
        }),
      }),
    );

    expect(tracker.finalize().meanRankBias).toBeNull();
  });

  it('should handle empty meal plan in a plan-generation event', () => {
    tracker.record(
      makeSnapshot({
        season: 'summer',
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: [] }),
      }),
    );

    expect(tracker.finalize().meanFitScore).toBe(0);
  });

  it('should skip non-plan snapshots', () => {
    tracker.record(
      makeSnapshot({
        season: 'summer',
        mealPlanGenerated: false,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ tags: ['salad'] })],
        }),
      }),
    );

    const result = tracker.finalize();
    expect(result.meanFitScore).toBe(0);
    expect(result.perSeason.summer).toBe(0);
  });

  it('should reset internal state', () => {
    tracker.record(
      makeSnapshot({
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ tags: ['soup'] })],
        }),
      }),
    );
    tracker.reset();
    expect(tracker.finalize().meanFitScore).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// QualityTracker (orchestrator)
// ---------------------------------------------------------------------------

describe('QualityTracker', () => {
  let tracker: QualityTracker;

  beforeEach(() => {
    tracker = new QualityTracker();
  });

  it('should return a complete QualityMetrics object from finalize', () => {
    const result = tracker.finalize();
    expect(result).toHaveProperty('diversity');
    expect(result).toHaveProperty('pantryUtilization');
    expect(result).toHaveProperty('feedbackLoop');
    expect(result).toHaveProperty('seasonalFitScore');
    expect(result).toHaveProperty('expiryDriven');
  });

  it('should fan out record calls to all sub-trackers', () => {
    const recipes = [
      makeRecipe({ id: 'r-1', tags: ['soup'] }),
      makeRecipe({ id: 'r-2', tags: ['stew'] }),
    ];
    const pantry = [
      makePantryItem({ name: 'Chicken', status: 'expiring' }),
    ];

    const snapshot = makeSnapshot({
      season: 'winter',
      mealPlanGenerated: true,
      stateAfter: makeDayState({
        currentMealPlan: recipes,
        pantryItems: pantry,
      }),
    });

    tracker.record(snapshot);
    const result = tracker.finalize();

    // Diversity should have seen 1 plan but needs a lookback match to score.
    expect(result.diversity.skippedDays).toBeGreaterThanOrEqual(1);
    expect(result.diversity.lookbackDays).toBe(7);
    // Seasonal should have a non-zero winter entry.
    expect(result.seasonalFitScore.perSeason.winter).toBeGreaterThan(0);
    // Expiry should have seen 1 expiring item.
    expect(result.expiryDriven.totalExpiring).toBe(1);
  });

  it('should retain snapshots for getSnapshots()', () => {
    const s1 = makeSnapshot({ dayIndex: 0 });
    const s2 = makeSnapshot({ dayIndex: 1 });

    tracker.record(s1);
    tracker.record(s2);

    const snapshots = tracker.getSnapshots();
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].dayIndex).toBe(0);
    expect(snapshots[1].dayIndex).toBe(1);
  });

  it('should collect violations via getAllViolations()', () => {
    const violation = {
      profileId: 'p1',
      dayIndex: 0,
      date: '2025-06-15',
      type: 'dietary' as const,
      recipeId: 'r-1',
      recipeTitle: 'Test',
      detail: 'test violation',
      severity: 'warning' as const,
    };

    tracker.record(makeSnapshot({ violations: [violation] }));
    expect(tracker.getAllViolations()).toHaveLength(1);
    expect(tracker.getAllViolations()[0].detail).toBe('test violation');
  });

  it('should reset all sub-trackers and snapshots', () => {
    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe()],
          pantryItems: [makePantryItem()],
        }),
      }),
    );
    tracker.reset();

    expect(tracker.getSnapshots()).toHaveLength(0);

    const result = tracker.finalize();
    expect(result.diversity.perDay).toHaveLength(0);
    expect(result.diversity.skippedDays).toBe(0);
    expect(result.pantryUtilization.perPlan).toHaveLength(0);
  });
});
