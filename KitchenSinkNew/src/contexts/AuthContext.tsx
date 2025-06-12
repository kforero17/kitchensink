import React, { createContext, useState, useEffect, useContext } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firebase from '@react-native-firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, type User, type NativeModuleError } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { firestoreService } from '../services/firebaseService';
import logger from '../utils/logger';
import { migratePreferencesToFirestore } from '../utils/preferences';
import { groceryListService } from '../services/groceryListService';
import { saveMealPlanToFirestore } from '../utils/recipeHistory';
import { useMealPlan } from './MealPlanContext';

interface AuthContextData {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const { mealPlan } = useMealPlan();

  // Initialize Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '246901092207-4tm5d0gnvvn0ahct7d4si6f0ddl540rb.apps.googleusercontent.com',
      iosClientId: Platform.OS === 'ios' ? '246901092207-9ai76fuog5q9bltpuqrtdscjrt0ve7vl.apps.googleusercontent.com' : undefined,
      offlineAccess: true,
    });
  }, []);

  useEffect(() => {
    // Check if user has completed onboarding
    const checkOnboardingStatus = async () => {
      try {
        const onboardingStatus = await AsyncStorage.getItem('@onboarding_completed');
        if (onboardingStatus) {
          setHasCompletedOnboarding(JSON.parse(onboardingStatus));
        }
      } catch (error) {
        console.log('Error checking onboarding status:', error);
      }
    };

    checkOnboardingStatus();

    // Initialize Firebase auth with proper error handling
    const initializeFirebaseAuth = async () => {
      try {
        // Check if Firebase is available and initialized
        const apps = firebase.apps;
        if (apps.length === 0) {
          console.log('[AuthProvider] Firebase not initialized yet, waiting...');
          // Wait a bit for Firebase to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check again
          const appsAfterWait = firebase.apps;
          if (appsAfterWait.length === 0) {
            console.warn('[AuthProvider] Firebase still not available, will retry later');
            setLoading(false);
            return;
          }
        }

        console.log('[AuthProvider] Firebase is available, setting up auth listener');
        
        // Subscribe to auth state changes
        const subscriber = auth().onAuthStateChanged(async (userState) => {
          setUser(userState);
          
          if (userState) {
            // User is signed in
            logger.debug('User auth state changed - signed in:', userState.uid);
            
            try {
              // Check if user document exists in Firestore
              // Log user details for debugging
              console.log('Current user details:', {
                uid: userState.uid,
                email: userState.email,
                emailVerified: userState.emailVerified,
                displayName: userState.displayName,
                isAnonymous: userState.isAnonymous,
                metadata: userState.metadata
              });
              
              // Get current token for debugging
              try {
                const token = await userState.getIdToken(true);
                console.log('User token successfully refreshed');
              } catch (tokenError) {
                console.error('Error refreshing user token:', tokenError);
              }
              
              // Add retry logic for Firestore operations
              const retryOperation = async <T,>(
                operation: () => Promise<T>,
                maxRetries: number = 3,
                delay: number = 1000
              ): Promise<T> => {
                let lastError: any;
                
                for (let i = 0; i < maxRetries; i++) {
                  try {
                    return await operation();
                  } catch (error: any) {
                    lastError = error;
                    
                    // Check if it's a temporary Firestore issue
                    if (error.message?.includes('firestore/unavailable') || 
                        error.message?.includes('The service is currently unavailable')) {
                      logger.debug(`Firestore operation failed, retrying (${i + 1}/${maxRetries})...`);
                      // Wait before retry with exponential backoff
                      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                      continue;
                    }
                    
                    // Also retry permission denied errors in case security rules are updating
                    if (error.message?.includes('firestore/permission-denied')) {
                      logger.debug(`Firestore permission denied, retrying (${i + 1}/${maxRetries})...`);
                      // Wait before retry with exponential backoff
                      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                      continue;
                    }
                    
                    // If it's not a temporary issue, don't retry
                    throw error;
                  }
                }
                
                // If we've exhausted retries, throw the last error
                throw lastError;
              };
              
              // Check if user document exists in Firestore with retry
              const userExists = await retryOperation(async () => {
                logger.debug('Checking if user document exists in Firestore...');
                return await firestoreService.userExists();
              });
              
              if (!userExists) {
                // Create new user document in Firestore with retry
                logger.debug('User document does not exist, creating it in Firestore...');
                await retryOperation(async () => {
                  await firestoreService.initializeNewUser(
                    userState.uid,
                    userState.email || 'no-email@example.com',
                    userState.displayName || undefined,
                    userState.photoURL || undefined
                  );
                });
                
                logger.debug('Created new Firestore user document', { uid: userState.uid });
                
                // Migrate any existing AsyncStorage preferences to Firestore with retry
                logger.debug('Migrating preferences from AsyncStorage to Firestore...');
                let migrationSuccess = false;
                try {
                  migrationSuccess = await retryOperation(async () => {
                    return await migratePreferencesToFirestore();
                  });
                  logger.debug('Preference migration result:', migrationSuccess ? 'Success' : 'Failed');
                } catch (error) {
                  logger.error('Failed to migrate preferences to Firestore:', error);
                }
                
                // Migrate any existing local grocery lists to Firestore with retry
                logger.debug('Migrating grocery lists from AsyncStorage to Firestore...');
                try {
                  const grocerySuccess = await retryOperation(async () => {
                    return await groceryListService.migrateLocalGroceryListToFirestore();
                  });
                  logger.debug('Grocery list migration result:', grocerySuccess ? 'Success' : 'Failed');
                } catch (error) {
                  logger.error('Failed to migrate grocery lists to Firestore:', error);
                }

                // Save meal plan to Firestore with retry
                logger.debug('Migrating meal plan to Firestore...');
                try {
                  // Only migrate recipes that are explicitly marked as part of the weekly meal plan
                  const selectedRecipes = mealPlan.filter(recipe => recipe.isWeeklyMealPlan === true);
                  
                  if (selectedRecipes.length > 0) {
                    logger.debug(`Found ${selectedRecipes.length} recipes marked as weekly meal plan to migrate`);
                    const mealPlanSuccess = await retryOperation(async () => {
                      return await saveMealPlanToFirestore(selectedRecipes);
                    });
                    logger.debug('Meal plan migration result:', mealPlanSuccess ? 'Success' : 'Failed');
                  } else {
                    logger.debug('No recipes marked as weekly meal plan found, skipping migration');
                  }
                } catch (error) {
                  logger.error('Failed to migrate meal plan to Firestore:', error);
                }
              } else {
                logger.debug('User document already exists in Firestore', { uid: userState.uid });
              }
            } catch (error) {
              logger.error('Error ensuring user document exists', error);
            }
          }
          
          setLoading(false);
        });

        // Return the unsubscribe function
        return subscriber;
      } catch (error) {
        console.error('[AuthProvider] Error initializing Firebase auth:', error);
        setLoading(false);
        return () => {}; // Return empty unsubscribe function
      }
    };

    // Initialize Firebase auth
    let unsubscribe: (() => void) | undefined;
    
    initializeFirebaseAuth().then((unsub) => {
      unsubscribe = unsub;
    });

    // Unsubscribe on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [mealPlan]);

  // Save onboarding status to AsyncStorage
  useEffect(() => {
    AsyncStorage.setItem('@onboarding_completed', JSON.stringify(hasCompletedOnboarding));
  }, [hasCompletedOnboarding]);

  const signIn = async (email: string, password: string) => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // Create user in Firebase Auth
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      
      // User document will be created in the onAuthStateChanged listener
      // but we can also explicitly initialize it here if needed
      if (userCredential.user) {
        logger.debug('User created in Firebase Auth, initializing in Firestore...');
      }
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Sign out from Firebase
      await auth().signOut();
      
      // Try to sign out from Google
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore Google sign out errors
        console.log('Error signing out from Google:', e);
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices();
      
      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();
      
      // Get tokens
      const { accessToken } = await GoogleSignin.getTokens();
      
      if (!accessToken) {
        throw new Error('Failed to get access token from Google Sign In');
      }
      
      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(null, accessToken);
      
      // Sign-in with credential
      const userCredential = await auth().signInWithCredential(googleCredential);
      
      // User document will be created in the onAuthStateChanged listener
      // if it doesn't already exist
      if (userCredential.user) {
        logger.debug('User signed in with Google, ensuring Firestore record exists...');
      }
    } catch (error) {
      if ((error as NativeModuleError).code === 'SIGN_IN_CANCELLED') {
        // User cancelled the sign-in flow
        return;
      }
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        forgotPassword,
        hasCompletedOnboarding,
        setHasCompletedOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 