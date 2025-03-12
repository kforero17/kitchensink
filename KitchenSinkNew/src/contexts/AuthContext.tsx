import React, { createContext, useState, useEffect, useContext } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, type User, type NativeModuleError } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { firestoreService } from '../services/firebaseService';
import logger from '../utils/logger';
import { migratePreferencesToFirestore } from '../utils/preferences';
import { groceryListService } from '../services/groceryListService';
import { pantryService } from '../services/pantryService';
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

    // Subscribe to auth state changes
    const subscriber = auth().onAuthStateChanged(async (userState) => {
      setUser(userState);
      
      // When a user logs in, ensure they have a Firestore user document
      if (userState) {
        try {
          // Check if user document exists in Firestore
          const userExists = await firestoreService.userExists();
          
          if (!userExists) {
            // Create new user document in Firestore
            await firestoreService.initializeNewUser(
              userState.uid,
              userState.email || 'no-email@example.com',
              userState.displayName || undefined,
              userState.photoURL || undefined
            );
            logger.debug('Created new Firestore user document', { uid: userState.uid });
            
            // Migrate any existing AsyncStorage preferences to Firestore
            await migratePreferencesToFirestore();
            
            // Migrate any existing local grocery lists to Firestore
            await groceryListService.migrateLocalGroceryListToFirestore();
            
            // Migrate any existing local pantry items to Firestore
            await pantryService.migrateLocalPantryItemsToFirestore();

            // Save meal plan to Firestore
            await saveMealPlanToFirestore(mealPlan);
          } else {
            logger.debug('User document already exists in Firestore', { uid: userState.uid });
          }
        } catch (error) {
          logger.error('Error ensuring user document exists', error);
        }
      }
      
      setLoading(false);
    });

    // Unsubscribe on unmount
    return subscriber;
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