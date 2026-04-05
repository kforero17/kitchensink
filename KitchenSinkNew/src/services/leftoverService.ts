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

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
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

  const leftovers = await loadLeftovers();
  leftovers.push(leftover);
  await saveLeftovers(leftovers);

  firestoreWrite(leftover);

  logger.debug(`[leftoverService] Recorded leftover: ${recipeName} (${remainingServings} servings)`);
  return leftover;
}

export async function getActiveLeftovers(): Promise<Leftover[]> {
  await expireStaleLeftovers();

  const leftovers = await loadLeftovers();
  return leftovers.filter(l => l.status === 'available');
}

export async function consumeLeftover(leftoverId: string, portions: number): Promise<void> {
  const leftovers = await loadLeftovers();
  const leftover = leftovers.find(l => l.id === leftoverId);
  if (!leftover) {
    logger.warn(`[leftoverService] Leftover not found: ${leftoverId}`);
    return;
  }

  leftover.remainingServings = Math.max(0, leftover.remainingServings - portions);
  if (leftover.remainingServings <= 0) {
    leftover.status = 'used';
  }

  await saveLeftovers(leftovers);

  firestoreUpdate(leftoverId, {
    remainingServings: leftover.remainingServings,
    status: leftover.status,
  });

  logger.debug(
    `[leftoverService] Consumed ${portions} portions of ${leftoverId}, ` +
    `remaining: ${leftover.remainingServings}, status: ${leftover.status}`,
  );
}

export async function expireStaleLeftovers(): Promise<void> {
  const leftovers = await loadLeftovers();
  const today = todayISO();
  let changed = false;

  for (const leftover of leftovers) {
    if (leftover.status === 'available' && leftover.estimatedExpiryDate < today) {
      leftover.status = 'expired';
      changed = true;

      firestoreUpdate(leftover.id, { status: 'expired' });
    }
  }

  if (changed) {
    await saveLeftovers(leftovers);
    logger.debug('[leftoverService] Expired stale leftovers');
  }
}
