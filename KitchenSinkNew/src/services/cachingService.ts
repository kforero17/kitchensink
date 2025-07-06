import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { md5 } from '../utils/cryptoWrapper';

const COLLECTION = 'spoonacularCandidateCache';
// 48 hours TTL
const TTL_MS = 48 * 60 * 60 * 1000;

interface CacheDoc {
  timestamp: FirebaseFirestoreTypes.Timestamp;
  value: any;
}

/** Compute deterministic cache key from input params (stringifiable). */
export async function computeCacheKey(params: Record<string, any>): Promise<string> {
  return md5(JSON.stringify(params));
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  try {
    const doc = await firestore().collection(COLLECTION).doc(key).get();
    if (!doc.exists) return null;
    const data = doc.data() as CacheDoc | undefined;
    if (!data || !data.timestamp) return null;
    const tsMillis = (data.timestamp instanceof Date)
      ? data.timestamp.getTime()
      : (data.timestamp as FirebaseFirestoreTypes.Timestamp).toMillis();
    if (Date.now() - tsMillis > TTL_MS) {
      return null; // expired
    }
    return data.value as T;
  } catch (err) {
    console.warn('[Cache] get error', err);
    return null;
  }
}

export async function setCachedValue(key: string, value: any): Promise<void> {
  try {
    await firestore().collection(COLLECTION).doc(key).set({
      timestamp: firestore.FieldValue.serverTimestamp(),
      value,
    });
  } catch (err) {
    console.warn('[Cache] set error', err);
  }
} 