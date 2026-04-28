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
import { SeasonalRelevanceTracker } from '../../quality/SeasonalRelevanceTracker';
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

  // Legacy tests: construct with lookahead=2 and minSignatureOverlap=999 so the
  // signature path never matches (no recipe has 999 identity tags).  This
  // preserves the behavior the old tests were written against, where scoring
  // effectively depended on exact-id match within a 2-plan lookahead.  The new
  // return shape still applies — we account for the new fields explicitly.
  beforeEach(() => {
    // Override minEventsForSignal=1 so legacy small-N tests still produce
    // numeric correlations rather than the production-default NaN.
    tracker = new FeedbackLoopTracker(2, 999, 1);
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('feedbackLoop');
  });

  it('should return NaN-tagged scalars when no feedback recorded', () => {
    const result = tracker.finalize();
    expect(Number.isNaN(result.positiveCorrelation)).toBe(true);
    expect(Number.isNaN(result.negativeCorrelation)).toBe(true);
    expect(Number.isNaN(result.netEffectiveness)).toBe(true);
    expect(result.feedbackEventCount).toBe(0);
    expect(result.exactRecipeHits).toBe(0);
    expect(result.signatureHits).toBe(0);
    expect(Number.isNaN(result.overlapDensity)).toBe(true);
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
    // With minSignatureOverlap=999, the signature path can never match, so
    // `positiveCorrelation` (which counts only signature hits) is 0.  The
    // exact-id hit still registers via `exactRecipeHits`.
    expect(result.positiveCorrelation).toBe(0);
    expect(Number.isNaN(result.negativeCorrelation)).toBe(true);
    // netEffectiveness = 0 (p) - 0 (NaN neg treated as 0) = 0
    expect(result.netEffectiveness).toBe(0);
    expect(result.exactRecipeHits).toBe(1);
    expect(result.signatureHits).toBe(0);
    expect(result.feedbackEventCount).toBe(1);
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
    // Again, sig path is disabled; negative correlation = 0.
    expect(result.negativeCorrelation).toBe(0);
    expect(Number.isNaN(result.positiveCorrelation)).toBe(true);
    expect(result.netEffectiveness).toBe(0);
    expect(result.exactRecipeHits).toBe(1);
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
    expect(result.exactRecipeHits).toBe(0);
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
    expect(result.exactRecipeHits).toBe(0);
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

    const result = tracker.finalize();
    // Failed feedback produces no events at all -> scalars remain NaN.
    expect(Number.isNaN(result.positiveCorrelation)).toBe(true);
    expect(result.feedbackEventCount).toBe(0);
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
    expect(Number.isNaN(result.positiveCorrelation)).toBe(true);
    expect(Number.isNaN(result.negativeCorrelation)).toBe(true);
    expect(result.feedbackEventCount).toBe(0);
  });

  // ---------------------------------------------------------------------
  // New tests per IMPLEMENTATION_SPEC.md Step 8
  // ---------------------------------------------------------------------

  describe('signature-matching (new behavior)', () => {
    // Default constructor: lookahead=Infinity, minSignatureOverlap=2.
    // Use tracker constructed fresh in each test.

    /**
     * 1. Realistic multi-week sparsity test.
     *
     * 13 plans; plan 0 contains a shared italian-dinner recipe and feedback
     * is given on it.  Every subsequent plan contains at least one recipe
     * that shares both `italian` + `dinner` tags, so signature match with
     * overlap ≥ 2 always hits.  Expect positiveCorrelation = 1.0.
     */
    it('should hit positiveCorrelation = 1.0 when every later plan shares 2 identity tags', () => {
      const t = new FeedbackLoopTracker(Infinity, 2, 1);

      const italianDinnerTags = ['italian', 'dinner'];
      // Plan 0 has recipe r-0 (italian + dinner) + feedback on it.
      t.record(
        makeSnapshot({
          dayIndex: 0,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-0', tags: italianDinnerTags }),
            ],
          }),
          actionsExecuted: [makeFeedbackAction('r-0', { isLiked: true })],
        }),
      );

      // Plans 1..12: each has a distinct recipe id but same tag signature
      // (italian + dinner), ensuring 2-tag overlap with the feedback recipe.
      for (let i = 1; i < 13; i++) {
        t.record(
          makeSnapshot({
            dayIndex: i,
            mealPlanGenerated: true,
            stateAfter: makeDayState({
              currentMealPlan: [
                makeRecipe({ id: `r-${i}`, tags: italianDinnerTags }),
              ],
            }),
          }),
        );
      }

      const result = t.finalize();
      expect(result.positiveCorrelation).toBe(1.0);
      expect(result.netEffectiveness).toBe(1.0);
      expect(result.feedbackEventCount).toBe(1);
      expect(result.signatureHits).toBe(1);
    });

    /**
     * 2. No signature overlap test.  Feedback on a thai dish at plan 0;
     * subsequent 12 plans have disjoint cuisines (none include `thai`).
     * Signature path cannot match: expect genuine-zero (not NaN).
     */
    it('should report positiveCorrelation = 0 (genuine zero) when no later plan shares the signature', () => {
      const t = new FeedbackLoopTracker(Infinity, 2, 1);

      // Plan 0: thai + dinner recipe with feedback.
      t.record(
        makeSnapshot({
          dayIndex: 0,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'thai-1', tags: ['thai', 'dinner'] }),
            ],
          }),
          actionsExecuted: [makeFeedbackAction('thai-1', { isLiked: true })],
        }),
      );

      // Disjoint cuisine pool — none overlap 2 tags with the thai recipe
      // (we deliberately avoid `dinner` too so the signature overlap stays
      // strictly below 2).
      const cuisineTagSets = [
        ['italian', 'lunch'],
        ['mexican', 'breakfast'],
        ['indian', 'snack'],
        ['japanese', 'dessert'],
        ['chinese', 'lunch'],
        ['mediterranean', 'breakfast'],
        ['french', 'snack'],
        ['korean', 'dessert'],
        ['vietnamese', 'lunch'],
        ['american', 'breakfast'],
        ['italian', 'snack'],
        ['mexican', 'dessert'],
      ];
      for (let i = 0; i < 12; i++) {
        t.record(
          makeSnapshot({
            dayIndex: i + 1,
            mealPlanGenerated: true,
            stateAfter: makeDayState({
              currentMealPlan: [
                makeRecipe({ id: `r-${i}`, tags: cuisineTagSets[i] }),
              ],
            }),
          }),
        );
      }

      const result = t.finalize();
      // Genuine zero: exact-number, not NaN.
      expect(result.positiveCorrelation).toBe(0);
      expect(Number.isNaN(result.positiveCorrelation)).toBe(false);
      expect(result.signatureHits).toBe(0);
      expect(result.feedbackEventCount).toBe(1);
    });

    /**
     * 3. Degenerate-case NaN test.  No feedback events whatsoever.
     */
    it('should return NaN netEffectiveness when no feedback is recorded', () => {
      // Use threshold=1 so the NaN comes from "0 events" semantics
      // (0 < 1 → NaN), matching pre-suppression behavior of this test.
      const t = new FeedbackLoopTracker(Infinity, 2, 1);

      // A few plan-only days with no feedback at all.
      for (let i = 0; i < 3; i++) {
        t.record(
          makeSnapshot({
            dayIndex: i,
            mealPlanGenerated: true,
            stateAfter: makeDayState({
              currentMealPlan: [makeRecipe({ id: `r-${i}` })],
            }),
          }),
        );
      }

      const result = t.finalize();
      expect(Number.isNaN(result.netEffectiveness)).toBe(true);
      expect(Number.isNaN(result.positiveCorrelation)).toBe(true);
      expect(Number.isNaN(result.negativeCorrelation)).toBe(true);
      expect(result.feedbackEventCount).toBe(0);
      expect(Number.isNaN(result.overlapDensity)).toBe(true);
    });

    /**
     * 4. Diagnostic counters test.  Mix exact-id hits with signature-only
     * hits and verify each counter is populated correctly.
     */
    it('should populate feedbackEventCount, exactRecipeHits, signatureHits, overlapDensity correctly', () => {
      const t = new FeedbackLoopTracker(Infinity, 2, 1);

      // Plan 0: two recipes.  Feedback on both.
      //   - r-exact (tags: italian+dinner) will reappear by exact-id in plan 1.
      //   - r-sigonly (tags: thai+dinner) reappears only by signature in plan 2
      //     (different id but same thai+dinner tag set).
      t.record(
        makeSnapshot({
          dayIndex: 0,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-exact', tags: ['italian', 'dinner'] }),
              makeRecipe({ id: 'r-sigonly', tags: ['thai', 'dinner'] }),
            ],
          }),
          actionsExecuted: [
            makeFeedbackAction('r-exact', { isLiked: true }),
            makeFeedbackAction('r-sigonly', { isLiked: true }),
          ],
        }),
      );

      // Plan 1: r-exact reappears exactly (id match) AND carries the italian
      // signature.  The signature for r-sigonly (thai+dinner) does NOT overlap
      // with an italian+dinner recipe by ≥2 (only overlap is `dinner`).
      t.record(
        makeSnapshot({
          dayIndex: 1,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-exact', tags: ['italian', 'dinner'] }),
            ],
          }),
        }),
      );

      // Plan 2: a new recipe that matches r-sigonly by signature (thai+dinner)
      // but has a different id.  No italian recipe here.  (r-exact still hit
      // in plan 1, so it doesn't matter; for r-sigonly this is its first
      // signature hit.)
      t.record(
        makeSnapshot({
          dayIndex: 2,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-sig-clone', tags: ['thai', 'dinner'] }),
            ],
          }),
        }),
      );

      const result = t.finalize();

      expect(result.feedbackEventCount).toBe(2);
      // r-exact hits by both id and signature; r-sigonly hits only by signature.
      expect(result.exactRecipeHits).toBe(1);
      expect(result.signatureHits).toBe(2);
      // overlapDensity = signatureHits / feedbackEventCount
      expect(result.overlapDensity).toBeCloseTo(2 / 2, 10);
      // Correlation counts signature hits: 2/2 = 1.0
      expect(result.positiveCorrelation).toBe(1.0);
    });

    /**
     * 5. record() planIndex correctness.  The feedback event's planIndex
     * must reflect the plan active at the time of feedback, not an
     * off-by-one.  We engineer a scenario where an off-by-one would give
     * the wrong answer:
     *
     *   day 0: plan A generated (planIndex 0) — recipe italian+dinner
     *   day 1: no new plan
     *   day 2: feedback given (plan A still active, planIndex should be 0)
     *   day 3: plan B generated (planIndex 1) — recipe italian+dinner
     *
     * Lookahead starts at planIndex+1 = 1, so plan B is inspected and the
     * signature hits.  If planIndex were off-by-one and recorded as 1 (the
     * plan count at day 2 snapshot entry), lookahead would start at plan 2
     * which doesn't exist -> zero correlation.
     */
    it('should assign planIndex based on the plan active when feedback is given', () => {
      const t = new FeedbackLoopTracker(Infinity, 2, 1);

      // Day 0: plan A generated.
      t.record(
        makeSnapshot({
          dayIndex: 0,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-A', tags: ['italian', 'dinner'] }),
            ],
          }),
        }),
      );

      // Day 1: nothing happens (no plan, no feedback).
      t.record(
        makeSnapshot({
          dayIndex: 1,
          mealPlanGenerated: false,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-A', tags: ['italian', 'dinner'] }),
            ],
          }),
        }),
      );

      // Day 2: feedback given while plan A is still active.  No new plan
      // generated on this day.  planIndex recorded on the event should be 0.
      t.record(
        makeSnapshot({
          dayIndex: 2,
          mealPlanGenerated: false,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-A', tags: ['italian', 'dinner'] }),
            ],
          }),
          actionsExecuted: [makeFeedbackAction('r-A', { isLiked: true })],
        }),
      );

      // Day 3: new plan B generated (planIndex 1) — same signature.
      t.record(
        makeSnapshot({
          dayIndex: 3,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-B', tags: ['italian', 'dinner'] }),
            ],
          }),
        }),
      );

      const result = t.finalize();
      // If planIndex is correct (0), lookahead scans plans 1.. which finds
      // the italian+dinner signature in plan B -> positiveCorrelation = 1.
      // If planIndex were off-by-one (1), lookahead would scan plan 2..
      // which doesn't exist -> 0.
      expect(result.positiveCorrelation).toBe(1.0);
      expect(result.signatureHits).toBe(1);
      expect(result.feedbackEventCount).toBe(1);
    });

    /**
     * 6. Small-N suppression test.  When fewer than `minEventsForSignal`
     * (default 5) events are recorded for a side, that side's correlation
     * is suppressed to NaN to avoid metric saturation noise.
     */
    it('returns NaN for sides with fewer than minEventsForSignal events (default 5)', () => {
      // Construct tracker WITHOUT overriding the threshold — uses default 5.
      const t = new FeedbackLoopTracker();

      const italianDinnerTags = ['italian', 'dinner'];

      // Plan 0: 4 liked feedback events on italian+dinner recipes; no
      // dislikes.  4 < 5 → positiveCorrelation should be NaN.
      t.record(
        makeSnapshot({
          dayIndex: 0,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [
              makeRecipe({ id: 'r-0', tags: italianDinnerTags }),
              makeRecipe({ id: 'r-1', tags: italianDinnerTags }),
              makeRecipe({ id: 'r-2', tags: italianDinnerTags }),
              makeRecipe({ id: 'r-3', tags: italianDinnerTags }),
            ],
          }),
          actionsExecuted: [
            makeFeedbackAction('r-0', { isLiked: true }),
            makeFeedbackAction('r-1', { isLiked: true }),
            makeFeedbackAction('r-2', { isLiked: true }),
            makeFeedbackAction('r-3', { isLiked: true }),
          ],
        }),
      );

      // Plans 1..12: identical signatures, so signature path *would* match
      // were it not suppressed.
      for (let i = 1; i < 13; i++) {
        t.record(
          makeSnapshot({
            dayIndex: i,
            mealPlanGenerated: true,
            stateAfter: makeDayState({
              currentMealPlan: [
                makeRecipe({ id: `r-later-${i}`, tags: italianDinnerTags }),
              ],
            }),
          }),
        );
      }

      const result = t.finalize();

      // 4 liked < 5 threshold → NaN.
      expect(Number.isNaN(result.positiveCorrelation)).toBe(true);
      // 0 disliked < 5 threshold → NaN.
      expect(Number.isNaN(result.negativeCorrelation)).toBe(true);
      // Both NaN → netEffectiveness NaN.
      expect(Number.isNaN(result.netEffectiveness)).toBe(true);
      // Events are still recorded.
      expect(result.feedbackEventCount).toBe(4);
    });
  });
});

// ---------------------------------------------------------------------------
// SeasonalRelevanceTracker
// ---------------------------------------------------------------------------

describe('SeasonalRelevanceTracker', () => {
  let tracker: SeasonalRelevanceTracker;

  beforeEach(() => {
    tracker = new SeasonalRelevanceTracker();
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('seasonalRelevance');
  });

  it('should return zeros when no plans are recorded', () => {
    const result = tracker.finalize();
    expect(result.meanMatchRate).toBe(0);
    expect(result.perSeason).toEqual({ spring: 0, summer: 0, fall: 0, winter: 0 });
  });

  it('should detect summer tags in summer season', () => {
    const recipes = [
      makeRecipe({ id: 'r-1', tags: ['salad', 'healthy'] }),
      makeRecipe({ id: 'r-2', tags: ['grilled', 'bbq'] }),
      makeRecipe({ id: 'r-3', tags: ['pasta'] }),
    ];

    tracker.record(
      makeSnapshot({
        season: 'summer',
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    // r-1 has 'salad' (summer), r-2 has 'grilled' + 'bbq' (summer), r-3 no match
    // 2/3 = 0.6667
    expect(result.meanMatchRate).toBeCloseTo(2 / 3, 4);
    expect(result.perSeason.summer).toBeCloseTo(2 / 3, 4);
  });

  it('should detect winter tags in winter season', () => {
    const recipes = [
      makeRecipe({ id: 'r-1', tags: ['soup', 'comfort'] }),
      makeRecipe({ id: 'r-2', tags: ['stew'] }),
    ];

    tracker.record(
      makeSnapshot({
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    expect(result.meanMatchRate).toBe(1.0);
    expect(result.perSeason.winter).toBe(1.0);
  });

  it('should be case-insensitive for tag matching', () => {
    const recipes = [makeRecipe({ id: 'r-1', tags: ['SOUP', 'Warm'] })];

    tracker.record(
      makeSnapshot({
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: recipes }),
      }),
    );

    expect(tracker.finalize().meanMatchRate).toBe(1.0);
  });

  it('should handle 0 match rate when no recipes have seasonal tags', () => {
    const recipes = [
      makeRecipe({ id: 'r-1', tags: ['pasta', 'quick'] }),
    ];

    tracker.record(
      makeSnapshot({
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: recipes }),
      }),
    );

    expect(tracker.finalize().meanMatchRate).toBe(0);
  });

  it('should compute per-season averages across multiple plan events', () => {
    // Two winter plans with different rates.
    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ tags: ['soup'] })],
        }),
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        season: 'winter',
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [
            makeRecipe({ id: 'r-2', tags: ['pasta'] }),
            makeRecipe({ id: 'r-3', tags: ['stew'] }),
          ],
        }),
      }),
    );

    const result = tracker.finalize();
    // Winter plan 1: 1/1 = 1.0, plan 2: 1/2 = 0.5, average = 0.75
    expect(result.perSeason.winter).toBeCloseTo(0.75, 4);
  });

  it('should handle empty meal plan in a plan-generation event', () => {
    tracker.record(
      makeSnapshot({
        season: 'summer',
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: [] }),
      }),
    );

    expect(tracker.finalize().meanMatchRate).toBe(0);
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
    expect(result.meanMatchRate).toBe(0);
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
    expect(tracker.finalize().meanMatchRate).toBe(0);
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
    expect(result).toHaveProperty('seasonalRelevance');
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
    expect(result.seasonalRelevance.perSeason.winter).toBeGreaterThan(0);
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
