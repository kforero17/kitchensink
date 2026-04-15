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

  beforeEach(() => {
    tracker = new DiversityTracker();
  });

  it('should have the correct name', () => {
    expect(tracker.name).toBe('diversity');
  });

  it('should return perfect diversity when no plans are recorded', () => {
    const result = tracker.finalize();
    expect(result).toEqual({ mean: 1.0, min: 1.0, max: 1.0, perWindow: [] });
  });

  it('should skip non-plan-generation snapshots', () => {
    tracker.record(makeSnapshot({ mealPlanGenerated: false }));
    const result = tracker.finalize();
    expect(result.perWindow).toHaveLength(0);
  });

  it('should compute 1.0 diversity when all recipes are unique', () => {
    const recipes = [
      makeRecipe({ id: 'r-1' }),
      makeRecipe({ id: 'r-2' }),
      makeRecipe({ id: 'r-3' }),
    ];
    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: recipes }),
      }),
    );

    const result = tracker.finalize();
    expect(result.perWindow).toHaveLength(1);
    expect(result.mean).toBe(1.0);
  });

  it('should compute reduced diversity for repeated recipes across windows', () => {
    // Generate 2 plan events with overlapping recipes.
    const plan1 = [makeRecipe({ id: 'r-1' }), makeRecipe({ id: 'r-2' })];
    const plan2 = [makeRecipe({ id: 'r-1' }), makeRecipe({ id: 'r-3' })];

    tracker.record(
      makeSnapshot({
        dayIndex: 0,
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: plan1 }),
      }),
    );
    tracker.record(
      makeSnapshot({
        dayIndex: 1,
        mealPlanGenerated: true,
        stateAfter: makeDayState({ currentMealPlan: plan2 }),
      }),
    );

    const result = tracker.finalize();
    // Only 2 plans, window size is 14 so there is 1 window with all 4 IDs.
    // 3 unique / 4 total = 0.75
    expect(result.perWindow).toHaveLength(1);
    expect(result.mean).toBe(0.75);
  });

  it('should produce multiple windows when plan count exceeds window size', () => {
    // Create 15 plans (window size = 14, so 2 windows).
    for (let i = 0; i < 15; i++) {
      tracker.record(
        makeSnapshot({
          dayIndex: i,
          mealPlanGenerated: true,
          stateAfter: makeDayState({
            currentMealPlan: [makeRecipe({ id: `r-${i}` })],
          }),
        }),
      );
    }

    const result = tracker.finalize();
    // 15 - 14 + 1 = 2 windows
    expect(result.perWindow).toHaveLength(2);
    // Each window has 14 unique recipes out of 14 total = 1.0
    expect(result.mean).toBe(1.0);
  });

  it('should reset internal state', () => {
    tracker.record(
      makeSnapshot({
        mealPlanGenerated: true,
        stateAfter: makeDayState({
          currentMealPlan: [makeRecipe({ id: 'r-1' })],
        }),
      }),
    );

    tracker.reset();
    const result = tracker.finalize();
    expect(result.perWindow).toHaveLength(0);
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

    // Diversity should have recorded 1 plan.
    expect(result.diversity.perWindow.length).toBeGreaterThanOrEqual(1);
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
    expect(result.diversity.perWindow).toHaveLength(0);
    expect(result.pantryUtilization.perPlan).toHaveLength(0);
  });
});
