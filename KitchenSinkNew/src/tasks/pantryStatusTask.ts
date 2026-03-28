import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import auth from '@react-native-firebase/auth';
import { refreshPantryStatuses } from '../services/pantryService';
import logger from '../utils/logger';

const TASK_NAME = 'PANTRY_STATUS_REFRESH';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const user = auth().currentUser;
    if (!user) return BackgroundFetch.BackgroundFetchResult.NoData;

    const updated = await refreshPantryStatuses(user.uid);
    logger.debug(`[pantryStatusTask] Background refresh updated ${updated} items`);

    return updated > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    logger.error('[pantryStatusTask] Background task failed', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerPantryStatusTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 24 * 60 * 60, // once per day (seconds)
    stopOnTerminate: false,
    startOnBoot: true,
  });

  logger.debug('[pantryStatusTask] Registered daily background task');
}

export async function unregisterPantryStatusTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (!isRegistered) return;

  await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
}
