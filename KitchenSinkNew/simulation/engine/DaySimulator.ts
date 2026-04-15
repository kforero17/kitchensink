/**
 * DaySimulator - Executes a single simulated day for one user profile.
 *
 * Orchestrates the full day lifecycle:
 *   1. Load current state from Firestore into a DayState
 *   2. Schedule actions based on engagement tier
 *   3. Execute each action sequentially
 *   4. Handle leftover creation inline after cook_recipe
 *   5. Run invariant checks on any generated meal plan
 *   6. Record the day snapshot via QualityTracker
 *   7. Return the immutable DaySnapshot
 */

import { SimFirestore } from '../data/SimFirestore';
import { ActionRegistry } from '../actions/ActionRegistry';
import { ActionContext } from '../actions/ActionExecutor';
import { InvariantChecker } from '../invariants/InvariantChecker';
import { QualityTracker } from '../quality/QualityTracker';
import { getSeason } from '../bridge/appImports';
import { scheduleActions } from './ActionScheduler';
import type {
  SimulationProfile,
  DaySnapshot,
  DayState,
  ActionResult,
  InvariantViolation,
} from '../profiles/types';

export class DaySimulator {
  constructor(
    private firestore: SimFirestore,
    private actions: ActionRegistry,
    private invariantChecker: InvariantChecker,
    private qualityTracker: QualityTracker,
  ) {}

  /**
   * Simulate a single day for the given profile.
   *
   * @param profile     - The simulation profile to run.
   * @param dayIndex    - Zero-based day within the 90-day simulation.
   * @param currentDate - The calendar date for this simulated day.
   * @param rng         - Seeded PRNG returning values in [0, 1).
   * @returns An immutable snapshot of the day's events and resulting state.
   */
  async simulateDay(
    profile: SimulationProfile,
    dayIndex: number,
    currentDate: Date,
    rng: () => number,
  ): Promise<DaySnapshot> {
    // 1. Load current state from Firestore
    const currentState = await this.loadDayState(profile.uid);

    // 2. Schedule actions
    const scheduled = scheduleActions(
      profile.engagementTier,
      dayIndex,
      currentState,
      rng,
    );

    // 3. Execute each action sequentially
    const executedActions: ActionResult[] = [];
    let mealPlanGenerated = false;
    let recipesCooked = 0;

    for (const scheduledAction of scheduled) {
      // log_leftover is handled inline (no executor in ActionRegistry)
      if (scheduledAction.type === 'log_leftover') {
        const leftoverResult = await this.handleLeftoverCreation(
          profile.uid,
          currentDate,
          currentState,
        );
        executedActions.push(leftoverResult);
        continue;
      }

      const result = await this.executeAction(
        scheduledAction.type,
        profile,
        dayIndex,
        currentDate,
        currentState,
        rng,
      );

      executedActions.push(result);

      // Post-action state updates
      if (result.success) {
        switch (scheduledAction.type) {
          case 'generate_meal_plan':
            mealPlanGenerated = true;
            // Reload meal plan from Firestore after generation
            await this.refreshMealPlan(profile.uid, currentState);
            break;

          case 'cook_recipe':
            if (result.data?.recipeId) {
              currentState.cookedToday.push(result.data.recipeId);
              recipesCooked++;

              // Add to recipe history
              currentState.recipeHistory.push({
                recipeId: result.data.recipeId,
                usedDate: result.data.date ?? currentDate.toISOString().split('T')[0],
                mealType: result.data.mealType ?? 'dinner',
              });
            }
            break;
        }
      }
    }

    // 5. Run invariant checks if a meal plan was generated
    let violations: InvariantViolation[] = [];
    if (mealPlanGenerated && currentState.currentMealPlan.length > 0) {
      violations = this.invariantChecker.check(
        currentState.currentMealPlan,
        profile,
        dayIndex,
        currentDate,
      );
    }

    // Build the snapshot
    const snapshot: DaySnapshot = {
      profileId: profile.id,
      dayIndex,
      date: currentDate.toISOString().split('T')[0],
      season: getSeason(currentDate),
      actionsExecuted: executedActions,
      stateAfter: { ...currentState },
      violations,
      mealPlanGenerated,
      recipesCooked,
    };

    // 6. Record snapshot
    this.qualityTracker.record(snapshot);

    // 7. Return
    return snapshot;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Load the user's current state from Firestore into a DayState structure.
   */
  private async loadDayState(uid: string): Promise<DayState> {
    const [pantryItems, leftovers, recipeHistory, feedbackHistory, userRecipes] =
      await Promise.all([
        this.firestore.getPantryItems(uid),
        this.firestore.getLeftovers(uid),
        this.firestore.getHistory(uid),
        this.firestore.getUserFeedback(uid),
        this.firestore.getUserRecipes(uid),
      ]);

    return {
      pantryItems,
      leftovers,
      currentMealPlan: userRecipes.filter((r: any) => r.isWeeklyMealPlan === true),
      recipeHistory,
      feedbackHistory,
      cookedToday: [],
    };
  }

  /**
   * Execute a single action via the registry. Wraps execution in try/catch
   * so that a failing action never crashes the day simulation.
   */
  private async executeAction(
    actionType: string,
    profile: SimulationProfile,
    dayIndex: number,
    currentDate: Date,
    currentState: DayState,
    rng: () => number,
  ): Promise<ActionResult> {
    const typedAction = actionType as ActionResult['type'];

    if (!this.actions.has(typedAction)) {
      return {
        type: typedAction,
        success: false,
        error: `No executor registered for action type "${actionType}"`,
      };
    }

    const ctx: ActionContext = {
      profile,
      uid: profile.uid,
      currentDate,
      dayIndex,
      firestore: this.firestore,
      currentState,
      rng,
    };

    try {
      const executor = this.actions.get(typedAction);
      return await executor.execute(ctx);
    } catch (err: any) {
      return {
        type: typedAction,
        success: false,
        error: `Unhandled error in ${actionType}: ${err.message ?? err}`,
      };
    }
  }

  /**
   * After generate_meal_plan succeeds, refresh the meal plan in currentState
   * from Firestore to reflect the newly generated plan.
   */
  private async refreshMealPlan(uid: string, state: DayState): Promise<void> {
    const userRecipes = await this.firestore.getUserRecipes(uid);
    state.currentMealPlan = userRecipes.filter(
      (r: any) => r.isWeeklyMealPlan === true,
    );
  }

  /**
   * Handle leftover creation inline (no executor in ActionRegistry).
   *
   * If a recipe was cooked today, create a Leftover document in Firestore
   * and update the local state. The leftover gets:
   *   - remainingServings = recipe.servings - 1
   *   - estimatedExpiryDate = currentDate + 3 days
   */
  private async handleLeftoverCreation(
    uid: string,
    currentDate: Date,
    state: DayState,
  ): Promise<ActionResult> {
    try {
      if (state.cookedToday.length === 0) {
        return {
          type: 'log_leftover',
          success: false,
          error: 'No recipes cooked today to log leftovers for',
        };
      }

      // Use the most recently cooked recipe
      const lastCookedId = state.cookedToday[state.cookedToday.length - 1];
      const recipe = state.currentMealPlan.find(r => r.id === lastCookedId);

      if (!recipe) {
        return {
          type: 'log_leftover',
          success: false,
          error: `Cooked recipe "${lastCookedId}" not found in current meal plan`,
        };
      }

      const dateStr = currentDate.toISOString().split('T')[0];
      const expiryDate = new Date(currentDate);
      expiryDate.setDate(expiryDate.getDate() + 3);
      const expiryStr = expiryDate.toISOString().split('T')[0];

      const leftoverData = {
        recipeId: recipe.id,
        recipeName: recipe.title,
        originalServings: recipe.servings,
        remainingServings: Math.max(recipe.servings - 1, 0),
        cookedDate: dateStr,
        estimatedExpiryDate: expiryStr,
        mealType: 'dinner',
        status: 'available' as const,
      };

      const leftoverId = await this.firestore.addLeftover(uid, leftoverData);

      // Update local state
      state.leftovers.push({
        id: leftoverId,
        ...leftoverData,
      });

      return {
        type: 'log_leftover',
        success: true,
        data: {
          leftoverId,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          remainingServings: leftoverData.remainingServings,
          estimatedExpiryDate: expiryStr,
        },
      };
    } catch (err: any) {
      return {
        type: 'log_leftover',
        success: false,
        error: `log_leftover failed: ${err.message ?? err}`,
      };
    }
  }
}
