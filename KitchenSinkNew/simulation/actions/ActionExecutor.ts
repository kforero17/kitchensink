/**
 * Core interface for simulation action executors.
 *
 * Every action the simulation can perform on a given day implements
 * `ActionExecutor`. The `ActionContext` bundles everything an executor
 * needs: the user profile, the simulated date, Firestore access, the
 * current day state, and a deterministic RNG.
 */

import { SimFirestore } from '../data/SimFirestore';
import {
  SimulationProfile,
  ActionType,
  ActionResult,
  DayState,
} from '../profiles/types';

export interface ActionContext {
  /** The simulation profile being executed. */
  profile: SimulationProfile;
  /** Firestore uid for the simulated user. */
  uid: string;
  /** The simulated calendar date for this day. */
  currentDate: Date;
  /** Zero-based index of the current simulation day. */
  dayIndex: number;
  /** Firestore adapter for reading/writing simulation data. */
  firestore: SimFirestore;
  /** Snapshot of the user's state at the start of this action. */
  currentState: DayState;
  /** Seeded pseudo-random number generator producing values in [0, 1). */
  rng: () => number;
}

export interface ActionExecutor {
  /** The action type this executor handles. */
  readonly type: ActionType;
  /** Execute the action and return a result. Must never throw. */
  execute(ctx: ActionContext): Promise<ActionResult>;
}
