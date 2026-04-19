/**
 * QualityTracker - Orchestrates all individual metric trackers.
 *
 * This is the single entry point that the simulation engine uses.  It fans out
 * each day snapshot to every registered tracker and, at the end of the run,
 * assembles the unified `QualityMetrics` object.
 *
 * It also retains raw snapshots for downstream report generation.
 */

import { MetricTracker } from './MetricTracker';
import { DiversityTracker } from './DiversityTracker';
import { PantryUtilizationTracker } from './PantryUtilizationTracker';
import { FeedbackLoopTracker } from './FeedbackLoopTracker';
import { SeasonalRelevanceTracker } from './SeasonalRelevanceTracker';
import { ExpiryTracker } from './ExpiryTracker';
import { DaySnapshot, InvariantViolation, QualityMetrics } from '../profiles/types';

export class QualityTracker {
  private trackers: MetricTracker[];
  private snapshots: DaySnapshot[] = [];

  constructor() {
    this.trackers = [
      new DiversityTracker(),
      new PantryUtilizationTracker(),
      // Scan the full remainder of the run (lookaheadPlans = Infinity) and
      // require >=2 identity-tag overlap for a signature match -- matches the
      // defaults, listed explicitly so the intent is obvious at the call site.
      new FeedbackLoopTracker(Infinity, 2),
      new SeasonalRelevanceTracker(),
      new ExpiryTracker(),
    ];
  }

  /** Forward a day snapshot to every tracker and retain it for reports. */
  record(snapshot: DaySnapshot): void {
    this.snapshots.push(snapshot);
    for (const tracker of this.trackers) {
      tracker.record(snapshot);
    }
  }

  /** Collect results from every tracker and assemble QualityMetrics. */
  finalize(): QualityMetrics {
    const [diversity, pantry, feedback, seasonal, expiry] =
      this.trackers.map(t => t.finalize());

    return {
      diversity: diversity as QualityMetrics['diversity'],
      pantryUtilization: pantry as QualityMetrics['pantryUtilization'],
      feedbackLoop: feedback as QualityMetrics['feedbackLoop'],
      seasonalRelevance: seasonal as QualityMetrics['seasonalRelevance'],
      expiryDriven: expiry as QualityMetrics['expiryDriven'],
    };
  }

  /** Return all recorded snapshots (for report generation). */
  getSnapshots(): DaySnapshot[] {
    return [...this.snapshots];
  }

  /** Return all violations across all recorded days. */
  getAllViolations(): InvariantViolation[] {
    return this.snapshots.flatMap(s => s.violations);
  }

  /** Reset all trackers and clear snapshots so the instance can be reused. */
  reset(): void {
    this.snapshots = [];
    for (const tracker of this.trackers) {
      tracker.reset();
    }
  }
}
