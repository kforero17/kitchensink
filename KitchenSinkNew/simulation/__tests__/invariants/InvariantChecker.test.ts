/**
 * Tests for InvariantChecker (the orchestrator).
 *
 * Verifies that the checker delegates to all registered rules and aggregates
 * violations correctly. Uses mock rules to isolate orchestration logic from
 * individual rule implementations.
 */

import { InvariantChecker, InvariantRule } from '../../invariants/InvariantChecker';
import { SimulationProfile, InvariantViolation } from '../../profiles/types';
import { UnifiedRecipe } from '../../bridge/appImports';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipe(id: string = 'r1'): UnifiedRecipe {
  return {
    id,
    source: 'tasty',
    title: `Recipe ${id}`,
    imageUrl: '',
    readyInMinutes: 30,
    servings: 4,
    ingredients: [],
    tags: [],
  };
}

function makeProfile(): SimulationProfile {
  return {
    id: 'profile-1',
    name: 'Test User',
    uid: 'uid-1',
    preferences: {
      dietary: {
        vegetarian: false,
        vegan: false,
        glutenFree: false,
        dairyFree: false,
        nutFree: false,
        lowCarb: false,
        allergies: [],
        restrictions: [],
      },
      food: {} as any,
      cooking: {
        cookingFrequency: 'daily',
        preferredCookingDuration: 'under_30_min',
        skillLevel: 'intermediate',
        mealTypes: ['dinner'],
        servingSizePreference: 4,
        weeklyMealPrepCount: 3,
        householdSize: 2,
        kitchenInstruments: [],
      },
      budget: {} as any,
    },
    engagementTier: 'high',
    startingPantry: [],
    simulationStartDate: '2026-01-01',
    seed: 42,
  };
}

function makeViolation(type: InvariantViolation['type'], recipeId: string): InvariantViolation {
  return {
    profileId: 'profile-1',
    dayIndex: 0,
    date: '2026-01-01',
    type,
    recipeId,
    recipeTitle: `Recipe ${recipeId}`,
    detail: `Mock ${type} violation for ${recipeId}`,
    severity: type === 'dietary' ? 'critical' : 'warning',
  };
}

/** A mock rule that returns pre-configured violations. */
class MockRule implements InvariantRule {
  readonly name: string;
  private violations: InvariantViolation[];

  constructor(name: string, violations: InvariantViolation[]) {
    this.name = name;
    this.violations = violations;
  }

  check(): InvariantViolation[] {
    return this.violations;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvariantChecker', () => {
  it('aggregates violations from multiple rules', () => {
    const dietaryViolation = makeViolation('dietary', 'r1');
    const repetitionViolation = makeViolation('repetition', 'r2');

    const checker = new InvariantChecker([
      new MockRule('mock-dietary', [dietaryViolation]),
      new MockRule('mock-repetition', [repetitionViolation]),
    ]);

    const violations = checker.check(
      [makeRecipe('r1'), makeRecipe('r2')],
      makeProfile(),
      0,
      new Date('2026-01-01'),
    );

    expect(violations).toHaveLength(2);
    expect(violations).toContainEqual(dietaryViolation);
    expect(violations).toContainEqual(repetitionViolation);
  });

  it('returns empty array when no rules find violations', () => {
    const checker = new InvariantChecker([
      new MockRule('clean-1', []),
      new MockRule('clean-2', []),
    ]);

    const violations = checker.check(
      [makeRecipe()],
      makeProfile(),
      0,
      new Date('2026-01-01'),
    );

    expect(violations).toHaveLength(0);
  });

  it('works with no rules', () => {
    const checker = new InvariantChecker([]);

    const violations = checker.check(
      [makeRecipe()],
      makeProfile(),
      0,
      new Date('2026-01-01'),
    );

    expect(violations).toHaveLength(0);
  });

  it('converts Date to ISO date string for rules', () => {
    let receivedDate: string = '';

    const spyRule: InvariantRule = {
      name: 'spy',
      check(_plan, _profile, _dayIndex, date) {
        receivedDate = date;
        return [];
      },
    };

    const checker = new InvariantChecker([spyRule]);
    checker.check([makeRecipe()], makeProfile(), 0, new Date('2026-03-15T14:30:00Z'));

    expect(receivedDate).toBe('2026-03-15');
  });

  it('initializes with default rules when none are provided', () => {
    // The default constructor should create DietaryInvariant, RepetitionInvariant, InstrumentInvariant
    const checker = new InvariantChecker();

    // Verify it works (no errors) with a simple plan
    const violations = checker.check(
      [makeRecipe()],
      makeProfile(),
      0,
      new Date('2026-01-01'),
    );

    // No violations expected for a plain recipe with no dietary preferences
    expect(violations).toHaveLength(0);
  });
});
