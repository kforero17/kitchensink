/**
 * ActionRegistry - Maps ActionType to ActionExecutor instances.
 *
 * All concrete action executors are registered at construction time.
 * The `log_leftover` action type intentionally has no executor here;
 * it is handled inline by the DaySimulator.
 */

import { ActionExecutor } from './ActionExecutor';
import { ActionType } from '../profiles/types';
import { MealPlanAction } from './MealPlanAction';
import { CookRecipeAction } from './CookRecipeAction';
import { FeedbackAction } from './FeedbackAction';
import { PantryAction } from './PantryAction';
import { GroceryRestockAction } from './GroceryRestockAction';
import { SwapRecipeAction } from './SwapRecipeAction';
import { InsightsAction } from './InsightsAction';

export class ActionRegistry {
  private executors: Map<ActionType, ActionExecutor>;

  constructor() {
    this.executors = new Map();
    this.register(new MealPlanAction());
    this.register(new CookRecipeAction());
    this.register(new FeedbackAction());
    this.register(new PantryAction());
    this.register(new GroceryRestockAction());
    this.register(new SwapRecipeAction());
    this.register(new InsightsAction());
  }

  private register(executor: ActionExecutor): void {
    this.executors.set(executor.type, executor);
  }

  get(type: ActionType): ActionExecutor {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`No executor registered for action type: ${type}`);
    }
    return executor;
  }

  /** Returns all registered action types. */
  registeredTypes(): ActionType[] {
    return Array.from(this.executors.keys());
  }

  /** Returns true if an executor is registered for the given type. */
  has(type: ActionType): boolean {
    return this.executors.has(type);
  }
}
