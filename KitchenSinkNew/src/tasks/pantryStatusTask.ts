import logger from '../utils/logger';

let BackgroundFetch: typeof import('expo-background-fetch') | null = null;
let TaskManager: typeof import('expo-task-manager') | null = null;

const TASK_NAME = 'PANTRY_STATUS_REFRESH';

try {
  BackgroundFetch = require('expo-background-fetch');
  TaskManager = require('expo-task-manager');

  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      const auth = require('@react-native-firebase/auth').default;
      const { refreshPantryStatuses } = require('../services/pantryService');
      const user = auth().currentUser;
      if (!user) return BackgroundFetch!.BackgroundFetchResult.NoData;

      const updated = await refreshPantryStatuses(user.uid);
      logger.debug(`[pantryStatusTask] Background refresh updated ${updated} items`);

      return updated > 0
        ? BackgroundFetch!.BackgroundFetchResult.NewData
        : BackgroundFetch!.BackgroundFetchResult.NoData;
    } catch (error) {
      logger.error('[pantryStatusTask] Background task failed', error);
      return BackgroundFetch!.BackgroundFetchResult.Failed;
    }
  });
} catch {
  logger.debug('[pantryStatusTask] Native module unavailable — skipping background task');
}

export async function registerPantryStatusTask(): Promise<void> {
  if (!TaskManager || !BackgroundFetch) return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 24 * 60 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  logger.debug('[pantryStatusTask] Registered daily background task');
}

export async function unregisterPantryStatusTask(): Promise<void> {
  if (!TaskManager || !BackgroundFetch) return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!isRegistered) return;

  await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
}
