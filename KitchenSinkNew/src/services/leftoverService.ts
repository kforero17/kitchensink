import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { STORAGE_KEYS } from '../constants/storage';
import { FIRESTORE_PATHS } from '../types/FirestoreSchema';
import { Leftover } from '../types/Leftover';
import logger from '../utils/logger';

const DEFAULT_EXPIRY_DAYS = 3;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function todayISO(): string {
  return formatLocalDate(new Date());
}

async function loadLeftovers(): Promise<Leftover[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LEFTOVERS);
    if (!raw) return [];
    return JSON.parse(raw) as Leftover[];
  } catch (error) {
    logger.error('[leftoverService] Error loading leftovers from storage', error);
    return [];
  }
}

let mutationQueue = Promise.resolve();

function withLeftoversMutation<T>(
  fn: (leftovers: Leftover[]) => Promise<{ leftovers: Leftover[]; result: T }>,
): Promise<T> {
  const run = mutationQueue.then(async () => {
    const leftovers = await loadLeftovers();
    const { leftovers: updated, result } = await fn(leftovers);
    await saveLeftovers(updated);
    return result;
  });
  mutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function saveLeftovers(leftovers: Leftover[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LEFTOVERS, JSON.stringify(leftovers));
  } catch (error) {
    logger.error('[leftoverService] Error saving leftovers to storage', error);
  }
}

async function firestoreWrite(leftover: Leftover): Promise<void> {
  try {
    const user = auth().currentUser;
    if (!user) return;

    await firestore()
      .collection(FIRESTORE_PATHS.USERS)
      .doc(user.uid)
      .collection(FIRESTORE_PATHS.LEFTOVERS)
      .doc(leftover.id)
      .set({
        ...leftover,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    logger.error('[leftoverService] Firestore write failed (non-blocking)', error);
  }
}

async function firestoreUpdate(leftoverId: string, data: Partial<Leftover>): Promise<void> {
  try {
    const user = auth().currentUser;
    if (!user) return;

    await firestore()
      .collection(FIRESTORE_PATHS.USERS)
      .doc(user.uid)
      .collection(FIRESTORE_PATHS.LEFTOVERS)
      .doc(leftoverId)
      .update({
        ...data,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    logger.error('[leftoverService] Firestore update failed (non-blocking)', error);
  }
}

export async function recordLeftover(
  recipeId: string,
  recipeName: string,
  originalServings: number,
  portionsEaten: number,
  mealType: string,
): Promise<Leftover | null> {
  if (!Number.isFinite(originalServings) || originalServings <= 0) return null;
  if (!Number.isFinite(portionsEaten) || portionsEaten < 0) return null;

  const remainingServings = originalServings - portionsEaten;
  if (remainingServings <= 0) return null;

  const cookedDate = todayISO();
  const leftover: Leftover = {
    id: generateId(),
    recipeId,
    recipeName,
    originalServings,
    remainingServings,
    cookedDate,
    estimatedExpiryDate: addDays(cookedDate, DEFAULT_EXPIRY_DAYS),
    mealType,
    status: 'available',
  };

  return withLeftoversMutation<Leftover>(async (leftovers) => {
    leftovers.push(leftover);
    return { leftovers, result: leftover };
  }).then((result) => {
    firestoreWrite(leftover);
    logger.debug(`[leftoverService] Recorded leftover: ${recipeName} (${remainingServings} servings)`);
    return result;
  });
}

export async function getActiveLeftovers(): Promise<Leftover[]> {
  await expireStaleLeftovers();

  const leftovers = await loadLeftovers();
  return leftovers.filter(l => l.status === 'available');
}

export async function consumeLeftover(leftoverId: string, portions: number): Promise<void> {
  if (!Number.isFinite(portions) || portions <= 0) return;

  const updated = await withLeftoversMutation<Pick<Leftover, 'remainingServings' | 'status'> | null>(async (leftovers) => {
    const leftover = leftovers.find(l => l.id === leftoverId);
    if (!leftover) {
      logger.warn(`[leftoverService] Leftover not found: ${leftoverId}`);
      return { leftovers, result: null };
    }

    leftover.remainingServings = Math.max(0, leftover.remainingServings - portions);
    if (leftover.remainingServings <= 0) {
      leftover.status = 'used';
    }

    return {
      leftovers,
      result: { remainingServings: leftover.remainingServings, status: leftover.status },
    };
  });

  if (updated) {
    firestoreUpdate(leftoverId, {
      remainingServings: updated.remainingServings,
      status: updated.status,
    });

    logger.debug(
      `[leftoverService] Consumed ${portions} portions of ${leftoverId}, ` +
      `remaining: ${updated.remainingServings}, status: ${updated.status}`,
    );
  }
}

export async function expireStaleLeftovers(): Promise<void> {
  const expiredIds = await withLeftoversMutation<string[]>(async (leftovers) => {
    const today = todayISO();
    const expired: string[] = [];

    for (const leftover of leftovers) {
      if (leftover.status === 'available' && leftover.estimatedExpiryDate < today) {
        leftover.status = 'expired';
        expired.push(leftover.id);
      }
    }

    return { leftovers, result: expired };
  });

  for (const id of expiredIds) {
    firestoreUpdate(id, { status: 'expired' });
  }

  if (expiredIds.length > 0) {
    logger.debug('[leftoverService] Expired stale leftovers');
  }
}
