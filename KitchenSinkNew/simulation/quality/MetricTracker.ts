/**
 * Common interface for all quality metric trackers.
 *
 * Each tracker observes daily snapshots via `record()`, accumulates internal
 * state, and produces a summary via `finalize()` once the simulation completes.
 */

import { DaySnapshot } from '../profiles/types';

export interface MetricTracker {
  /** Human-readable name used for logging and report labels. */
  name: string;

  /** Observe a single day's snapshot and update internal accumulators. */
  record(snapshot: DaySnapshot): void;

  /** Compute and return the final metric summary. */
  finalize(): Record<string, any>;

  /** Clear all accumulated state so the tracker can be reused. */
  reset(): void;
}
