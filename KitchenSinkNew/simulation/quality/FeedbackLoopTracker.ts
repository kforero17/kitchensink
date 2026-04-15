/**
 * FeedbackLoopTracker - Measures whether user feedback influences future plans.
 *
 * The tracker records two kinds of events as they arrive:
 *   1. Feedback events  -- extracted from `actionsExecuted` where type is
 *      'give_feedback'.  Each carries `data.recipeId`, `data.isLiked`,
 *      `data.isDisliked`, and a plan-generation sequence number indicating
 *      which plan the feedback was given relative to.
 *   2. Plan events -- the set of recipe IDs present in the meal plan whenever
 *      a new plan is generated.
 *
 * At finalization the tracker checks, for each feedback event, whether the
 * recipe appears in the next 2 plans that follow the feedback.
 *
 *   positiveCorrelation  = fraction of liked recipes that reappear
 *   negativeCorrelation  = fraction of disliked recipes that reappear
 *   netEffectiveness     = positiveCorrelation - negativeCorrelation
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics } from '../profiles/types';

/** How many subsequent plans to inspect after a feedback event. */
const LOOKAHEAD_PLANS = 2;

interface FeedbackEvent {
  recipeId: string;
  isLiked: boolean;
  isDisliked: boolean;
  /** Index into `planSnapshots` of the plan active when the feedback was given. */
  planIndex: number;
}

interface PlanSnapshot {
  recipeIds: Set<string>;
}

export class FeedbackLoopTracker implements MetricTracker {
  readonly name = 'feedbackLoop';

  private feedbackEvents: FeedbackEvent[] = [];
  private planSnapshots: PlanSnapshot[] = [];

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    // If a new plan was generated, record it.
    if (snapshot.mealPlanGenerated) {
      const recipeIds = new Set(
        snapshot.stateAfter.currentMealPlan.map(r => r.id),
      );
      this.planSnapshots.push({ recipeIds });
    }

    // Extract feedback actions from the day's executed actions.
    for (const action of snapshot.actionsExecuted) {
      if (action.type !== 'give_feedback' || !action.success) continue;

      const data = action.data;
      if (!data || !data.recipeId) continue;

      this.feedbackEvents.push({
        recipeId: data.recipeId,
        isLiked: !!data.isLiked,
        isDisliked: !!data.isDisliked,
        // Current plan index is the latest snapshot (0-based).
        planIndex: Math.max(0, this.planSnapshots.length - 1),
      });
    }
  }

  finalize(): QualityMetrics['feedbackLoop'] {
    const liked = this.feedbackEvents.filter(e => e.isLiked);
    const disliked = this.feedbackEvents.filter(e => e.isDisliked);

    const positiveCorrelation = this.correlationRate(liked, true);
    const negativeCorrelation = this.correlationRate(disliked, false);
    const netEffectiveness = positiveCorrelation - negativeCorrelation;

    return { positiveCorrelation, negativeCorrelation, netEffectiveness };
  }

  reset(): void {
    this.feedbackEvents = [];
    this.planSnapshots = [];
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * For a set of feedback events, compute the fraction whose recipe appears in
   * at least one of the next `LOOKAHEAD_PLANS` plans.
   *
   * For positive feedback (liked) we *want* the recipe to reappear, so a high
   * rate is good.  For negative feedback (disliked) a high rate means the
   * system is ignoring negative signals.
   */
  private correlationRate(
    events: FeedbackEvent[],
    _isPositive: boolean,
  ): number {
    if (events.length === 0) return 0;

    let found = 0;
    for (const event of events) {
      const startPlan = event.planIndex + 1;
      const endPlan = Math.min(
        startPlan + LOOKAHEAD_PLANS,
        this.planSnapshots.length,
      );

      for (let i = startPlan; i < endPlan; i++) {
        if (this.planSnapshots[i].recipeIds.has(event.recipeId)) {
          found++;
          break; // Count once per feedback event.
        }
      }
    }

    return found / events.length;
  }
}
