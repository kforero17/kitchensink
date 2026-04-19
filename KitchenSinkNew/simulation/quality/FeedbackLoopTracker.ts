/**
 * FeedbackLoopTracker - Measures whether user feedback influences future plans.
 *
 * The tracker records two kinds of events as they arrive:
 *   1. Feedback events  -- extracted from `actionsExecuted` where type is
 *      'give_feedback'.  Each carries `data.recipeId`, `data.isLiked`,
 *      `data.isDisliked`, and a plan-generation sequence number indicating
 *      which plan the feedback was given relative to.
 *   2. Plan events -- the set of recipe IDs (plus per-recipe identity-tag
 *      "signatures") present in the meal plan whenever a new plan is generated.
 *
 * At finalization the tracker checks, for each feedback event, whether the
 * recipe reappears in any subsequent plan within `lookaheadPlans`.  Because
 * exact recipe-id matches are sparse (the ranker routinely surfaces a
 * different recipe with the same identity), we match on a cuisine/protein/
 * meal-type *signature* that overlaps by at least `minSignatureOverlap` tags.
 *
 *   positiveCorrelation  = fraction of liked recipes whose signature reappears
 *   negativeCorrelation  = fraction of disliked recipes whose signature reappears
 *   netEffectiveness     = positiveCorrelation - negativeCorrelation
 *
 * We also expose diagnostic counters so operators can see exact-id hits vs
 * signature hits separately.
 */

import { MetricTracker } from './MetricTracker';
import { DaySnapshot, QualityMetrics } from '../profiles/types';

/**
 * Identity tags we consider when building a recipe "signature".  The
 * simulation's recipe corpus uses flat lowercase tokens (see
 * `scripts/tasty-scraper/firestore-uploader.js`), so we list both the common
 * bare forms and any `prefix:` forms we might encounter in future data.
 */
const IDENTITY_TAG_PREFIXES = new Set<string>([
  // Cuisine
  'cuisine:', 'italian', 'thai', 'mexican', 'indian', 'japanese', 'chinese',
  'mediterranean', 'french', 'american', 'korean', 'vietnamese', 'asian',
  // Primary protein
  'chicken', 'beef', 'pork', 'fish', 'salmon', 'tofu', 'vegetarian', 'vegan',
  'seafood', 'shrimp',
  // Meal type
  'breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'snacks',
]);

function recipeSignature(tags: string[]): Set<string> {
  const prefixes = [...IDENTITY_TAG_PREFIXES].filter(p => p.endsWith(':'));
  return new Set(
    tags
      .map(t => t.toLowerCase().trim())
      .filter(
        t =>
          IDENTITY_TAG_PREFIXES.has(t) ||
          prefixes.some(p => t.startsWith(p)),
      ),
  );
}

interface FeedbackEvent {
  recipeId: string;
  /** Identity-tag signature derived from the recipe at feedback time. */
  signature: Set<string>;
  isLiked: boolean;
  isDisliked: boolean;
  /** Index into `planSnapshots` of the plan active when the feedback was given. */
  planIndex: number;
}

interface PlanSnapshot {
  recipeIds: Set<string>;
  /** One identity-tag signature per recipe in the plan. */
  recipeSignatures: Array<Set<string>>;
}

export class FeedbackLoopTracker implements MetricTracker {
  readonly name = 'feedbackLoop';

  private feedbackEvents: FeedbackEvent[] = [];
  private planSnapshots: PlanSnapshot[] = [];

  /**
   * @param lookaheadPlans        How many subsequent plans to inspect after a
   *                              feedback event.  Defaults to `Infinity` so
   *                              the entire remaining simulation is scanned.
   * @param minSignatureOverlap   Minimum number of identity tags that must
   *                              overlap between the feedback's recipe and a
   *                              plan recipe for a signature match to count.
   */
  constructor(
    private lookaheadPlans: number = Infinity,
    private minSignatureOverlap: number = 2,
  ) {}

  // ---------------------------------------------------------------------------
  // MetricTracker interface
  // ---------------------------------------------------------------------------

  record(snapshot: DaySnapshot): void {
    // If a new plan was generated, record it.
    if (snapshot.mealPlanGenerated) {
      const plan = snapshot.stateAfter.currentMealPlan;
      const recipeIds = new Set(plan.map(r => r.id));
      const recipeSignatures = plan.map(r => recipeSignature(r.tags ?? []));
      this.planSnapshots.push({ recipeIds, recipeSignatures });
    }

    // Extract feedback actions from the day's executed actions.
    for (const action of snapshot.actionsExecuted) {
      if (action.type !== 'give_feedback' || !action.success) continue;

      const data = action.data;
      if (!data || !data.recipeId) continue;

      // Resolve the recipe's tags from the current meal plan to compute a
      // signature.  If the recipe isn't present (edge case: feedback on a
      // recipe that's already rolled off the plan), fall back to an empty
      // signature -- the event still counts but can only hit via exact-id.
      const recipeInPlan = snapshot.stateAfter.currentMealPlan.find(
        r => r.id === data.recipeId,
      );
      const signature = recipeInPlan
        ? recipeSignature(recipeInPlan.tags ?? [])
        : new Set<string>();

      this.feedbackEvents.push({
        recipeId: data.recipeId,
        signature,
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

    const pos = this.correlationRate(liked);
    const neg = this.correlationRate(disliked);

    const positiveCorrelation = pos.rate; // NaN when liked.length === 0
    const negativeCorrelation = neg.rate; // NaN when disliked.length === 0

    let netEffectiveness: number;
    if (
      Number.isNaN(positiveCorrelation) &&
      Number.isNaN(negativeCorrelation)
    ) {
      netEffectiveness = NaN;
    } else {
      const p = Number.isNaN(positiveCorrelation) ? 0 : positiveCorrelation;
      const n = Number.isNaN(negativeCorrelation) ? 0 : negativeCorrelation;
      netEffectiveness = p - n;
    }

    const totalEvents = this.feedbackEvents.length;
    const totalIdHits = pos.idHits + neg.idHits;
    const totalSigHits = pos.sigHits + neg.sigHits;

    return {
      positiveCorrelation,
      negativeCorrelation,
      netEffectiveness,
      feedbackEventCount: totalEvents,
      exactRecipeHits: totalIdHits,
      signatureHits: totalSigHits,
      overlapDensity: totalEvents === 0 ? NaN : totalSigHits / totalEvents,
    };
  }

  reset(): void {
    this.feedbackEvents = [];
    this.planSnapshots = [];
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * For a set of feedback events, compute the fraction whose signature
   * reappears in at least one of the next `lookaheadPlans` plans.  Also
   * returns diagnostic counts for exact-id hits and signature hits so the
   * caller can see how much of the correlation comes from each pathway.
   */
  private correlationRate(events: FeedbackEvent[]): {
    rate: number;
    idHits: number;
    sigHits: number;
  } {
    if (events.length === 0) return { rate: NaN, idHits: 0, sigHits: 0 };

    let idHits = 0;
    let sigHits = 0;

    for (const event of events) {
      const startPlan = event.planIndex + 1;
      const endPlan = Math.min(
        startPlan + this.lookaheadPlans,
        this.planSnapshots.length,
      );

      let hitById = false;
      let hitBySig = false;
      for (let i = startPlan; i < endPlan; i++) {
        const plan = this.planSnapshots[i];
        if (!hitById && plan.recipeIds.has(event.recipeId)) hitById = true;
        if (!hitBySig && this.planHasSignatureMatch(plan, event.signature))
          hitBySig = true;
        if (hitById && hitBySig) break;
      }
      if (hitById) idHits++;
      if (hitBySig) sigHits++;
    }

    return { rate: sigHits / events.length, idHits, sigHits };
  }

  private planHasSignatureMatch(
    plan: PlanSnapshot,
    eventSig: Set<string>,
  ): boolean {
    if (eventSig.size === 0) return false;
    for (const recipeSig of plan.recipeSignatures) {
      let overlap = 0;
      for (const t of eventSig) if (recipeSig.has(t)) overlap++;
      if (overlap >= this.minSignatureOverlap) return true;
    }
    return false;
  }
}
