import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { RecommendationPayload } from '../types/Recommendation';

export type RecoEventType = 'recipeViewed' | 'recipeDismissed' | 'addedToMealPlan' | 'rejectedWithReason';

interface RecoEventBase {
  userId: string;
  recipeId: string;
  timestamp: number;
  type: RecoEventType;
}

export interface RejectedWithReasonEvent extends RecoEventBase {
  type: 'rejectedWithReason';
  reason: string;
}

type RecoEvent = RecoEventBase | RejectedWithReasonEvent;

function getUserId(): string {
  const user = auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

export async function logRecoEvent(event: RecoEvent): Promise<void> {
  await firestore()
    .collection('users')
    .doc(event.userId)
    .collection('recoEvents')
    .add(event);
}

// Convenience wrappers
export async function logRecipeViewed(recipeId: string): Promise<void> {
  return logRecoEvent({
    userId: getUserId(),
    recipeId,
    timestamp: Date.now(),
    type: 'recipeViewed',
  });
}

export async function logRecipeDismissed(recipeId: string): Promise<void> {
  return logRecoEvent({
    userId: getUserId(),
    recipeId,
    timestamp: Date.now(),
    type: 'recipeDismissed',
  });
}

export async function logAddedToMealPlan(recipeId: string): Promise<void> {
  return logRecoEvent({
    userId: getUserId(),
    recipeId,
    timestamp: Date.now(),
    type: 'addedToMealPlan',
  });
}

export async function logRejectedWithReason(recipeId: string, reason: string): Promise<void> {
  return logRecoEvent({
    userId: getUserId(),
    recipeId,
    timestamp: Date.now(),
    type: 'rejectedWithReason',
    reason,
  } as RejectedWithReasonEvent);
} 