/**
 * Firebase Connection Status Utility
 * 
 * Provides functions to check and monitor Firebase connection status
 */

import firebase from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import { BehaviorSubject } from 'rxjs';
import logger from './logger';
import { withFirebaseRetry } from './firebaseRetry';

// Connection status enum
export enum FirebaseConnectionStatus {
  UNKNOWN = 'unknown',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

// Observable for connection status
export const connectionStatus = new BehaviorSubject<FirebaseConnectionStatus>(
  FirebaseConnectionStatus.UNKNOWN
);

// Keep track of the Firestore connectivity state listener
let firestoreListener: () => void;

/**
 * Start monitoring Firestore connection status
 */
export function startConnectionMonitoring(): void {
  try {
    // Set status to connecting
    connectionStatus.next(FirebaseConnectionStatus.CONNECTING);
    
    // Create a Firestore instance
    const db = firestore();
    
    // Set up the connectivity listener
    firestoreListener = db.enableNetwork()
      .then(() => {
        logger.debug('Firebase network enabled');
        
        // Listen to connectivity state changes
        return db.collection('__connectionStatus__').doc('status').onSnapshot(
          () => {
            // Successful connection to Firestore
            connectionStatus.next(FirebaseConnectionStatus.CONNECTED);
            logger.debug('Firebase connection: CONNECTED');
          },
          (error) => {
            // Error in connection
            connectionStatus.next(FirebaseConnectionStatus.DISCONNECTED);
            logger.error('Firebase connection: DISCONNECTED', error);
          }
        );
      })
      .catch((error) => {
        connectionStatus.next(FirebaseConnectionStatus.DISCONNECTED);
        logger.error('Failed to enable Firebase network:', error);
        return () => {}; // Return empty function as fallback
      });
  } catch (error) {
    logger.error('Error setting up Firebase connection monitoring:', error);
    connectionStatus.next(FirebaseConnectionStatus.DISCONNECTED);
  }
}

/**
 * Stop monitoring Firestore connection status
 */
export function stopConnectionMonitoring(): void {
  if (firestoreListener) {
    firestoreListener();
    firestoreListener = undefined as any;
  }
}

/**
 * Check if Firestore is currently available
 * Attempts a simple read operation to verify connectivity
 * 
 * @returns Promise resolving to a boolean indicating if Firestore is available
 */
export async function isFirestoreAvailable(): Promise<boolean> {
  try {
    // Try to get the Firestore instance
    const db = firestore();
    
    // Attempt a simple read operation with retries
    await withFirebaseRetry(async () => {
      // Use a system collection or any collection that exists and is readable
      const testDoc = await db.collection('__test__').doc('connectivity').get();
      return testDoc;
    }, 3, 500); // Only retry 3 times with short delay for quick check
    
    return true;
  } catch (error) {
    logger.debug('Firestore availability check failed:', error);
    return false;
  }
}

/**
 * Waits for Firestore to become available
 * 
 * @param timeoutMs Maximum time to wait in milliseconds (default: 30000)
 * @returns Promise resolving to a boolean indicating if Firestore became available
 */
export async function waitForFirestoreAvailability(timeoutMs: number = 30000): Promise<boolean> {
  // If already connected, return immediately
  if (connectionStatus.value === FirebaseConnectionStatus.CONNECTED) {
    return true;
  }
  
  return new Promise<boolean>((resolve) => {
    // Set a timeout
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      resolve(false);
    }, timeoutMs);
    
    // Subscribe to connection status changes
    const subscription = connectionStatus.subscribe((status) => {
      if (status === FirebaseConnectionStatus.CONNECTED) {
        clearTimeout(timeout);
        subscription.unsubscribe();
        resolve(true);
      }
    });
    
    // Start connection monitoring if not already started
    if (connectionStatus.value === FirebaseConnectionStatus.UNKNOWN) {
      startConnectionMonitoring();
    }
  });
} 