/**
 * Firestore Database Service (Node.js version)
 * 
 * This is a JavaScript implementation of the Firestore service that uses
 * the Firebase Admin SDK for reliable database access. This version is
 * meant to be used on the server-side (Node.js) in React Native.
 */

// Import the admin Firebase service
const adminFirebaseService = require('./adminFirebaseService');
const admin = require('firebase-admin');

// Import Firebase path constants (adapted from your TypeScript code)
const FIRESTORE_PATHS = {
  USERS: 'users',
  GROCERY_LISTS: 'groceryLists',
  RECIPES: 'recipes',
  PANTRY_ITEMS: 'pantryItems',
  APP_SETTINGS: 'appSettings',
};

/**
 * Utility function to clean objects before sending to Firestore
 * Removes undefined values that cause errors
 */
const cleanForFirestore = (data) => {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item));
  }

  if (typeof data === 'object' && data !== null) {
    const cleanObject = {};
    
    Object.keys(data).forEach(key => {
      // Remove undefined values, but keep null values
      if (data[key] !== undefined) {
        cleanObject[key] = cleanForFirestore(data[key]);
      }
    });
    
    return cleanObject;
  }
  
  return data;
};

/**
 * Firestore Database Service
 * Provides methods for interacting with Firestore database
 */
class FirestoreService {
  constructor() {
    this.db = adminFirebaseService.db;
  }

  /**
   * Get the current user ID from request or context
   * @param {string} userId - The user ID to use (must be provided in Node.js)
   * @returns {string|null} - User ID or null
   */
  getCurrentUserId(userId) {
    // In this Node.js version, userId must be provided
    return userId || null;
  }

  /**
   * Get a reference to a user's document
   * @param {string} userId - The user ID
   * @returns {FirebaseFirestore.DocumentReference|null} - Document reference or null
   */
  getUserDocRef(userId) {
    if (!userId) return null;
    return this.db.collection(FIRESTORE_PATHS.USERS).doc(userId);
  }

  /**
   * Get a reference to a user's app settings collection
   * @param {string} userId - The user ID
   * @returns {FirebaseFirestore.DocumentReference|null} - Document reference or null
   */
  getAppSettingsRef(userId) {
    const userRef = this.getUserDocRef(userId);
    if (!userRef) return null;
    
    return userRef.collection(FIRESTORE_PATHS.APP_SETTINGS).doc('settings');
  }

  /**
   * Initialize a new user in Firestore after registration
   * @param {string} userId - The user ID from Firebase Auth
   * @param {string} email - The user's email address
   * @param {string} [displayName] - Optional display name
   * @param {string} [photoURL] - Optional photo URL
   * @returns {Promise<void>}
   */
  async initializeNewUser(
    userId, 
    email, 
    displayName, 
    photoURL
  ) {
    try {
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      // Create initial user document with empty preferences
      const userData = {
        uid: userId,
        email,
        displayName: displayName || undefined,
        photoURL: photoURL || undefined,
        preferences: {
          dietary: {
            vegetarian: false,
            vegan: false,
            glutenFree: false,
            dairyFree: false,
            nutFree: false,
            lowCarb: false,
            allergies: [],
            restrictions: []
          },
          food: {
            favoriteIngredients: [],
            dislikedIngredients: []
          },
          cooking: {
            cookingFrequency: 'few_times_week',
            preferredCookingDuration: '30_to_60_min',
            skillLevel: 'intermediate',
            mealTypes: ['breakfast', 'lunch', 'dinner'],
            servingSizePreference: 2,
            weeklyMealPrepCount: 3,
            householdSize: 2
          },
          budget: {
            amount: 100,
            frequency: 'weekly'
          },
          createdAt: timestamp,
          updatedAt: timestamp
        },
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      // Clean the data to remove undefined values
      const cleanedData = cleanForFirestore(userData);
      
      await this.db
        .collection(FIRESTORE_PATHS.USERS)
        .doc(userId)
        .set(cleanedData);
      
      console.log('New user initialized in Firestore', { userId });
    } catch (error) {
      console.error('Error initializing new user in Firestore', error);
      throw error;
    }
  }

  /**
   * Check if a user exists in Firestore
   * @param {string} userId - The user ID to check
   * @returns {Promise<boolean>} - True if user exists, false otherwise
   */
  async userExists(userId) {
    try {
      const userRef = this.getUserDocRef(userId);
      if (!userRef) return false;
      
      const doc = await userRef.get();
      return doc.exists;
    } catch (error) {
      console.error('Error checking if user exists', error);
      return false;
    }
  }

  // USER PREFERENCES METHODS

  /**
   * Save dietary preferences to Firestore
   * @param {string} userId - The user ID
   * @param {object} preferences - Dietary preferences to save
   * @returns {Promise<boolean>} - True if save was successful
   */
  async saveDietaryPreferences(userId, preferences) {
    try {
      const userRef = this.getUserDocRef(userId);
      if (!userRef) throw new Error('User not found');
      
      await userRef.update({
        'preferences.dietary': preferences,
        'preferences.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error saving dietary preferences', error);
      return false;
    }
  }

  /**
   * Get dietary preferences from Firestore
   * @param {string} userId - The user ID
   * @returns {Promise<object|null>} - Dietary preferences or null if not found
   */
  async getDietaryPreferences(userId) {
    try {
      const userRef = this.getUserDocRef(userId);
      if (!userRef) throw new Error('User not found');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences?.dietary || null;
    } catch (error) {
      console.error('Error getting dietary preferences', error);
      return null;
    }
  }

  /**
   * Save food preferences to Firestore
   * @param {string} userId - The user ID
   * @param {object} preferences - Food preferences to save
   * @returns {Promise<boolean>} - True if save was successful
   */
  async saveFoodPreferences(userId, preferences) {
    try {
      const userRef = this.getUserDocRef(userId);
      if (!userRef) throw new Error('User not found');
      
      await userRef.update({
        'preferences.food': preferences,
        'preferences.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error saving food preferences', error);
      return false;
    }
  }

  /**
   * Get food preferences from Firestore
   * @param {string} userId - The user ID
   * @returns {Promise<object|null>} - Food preferences or null if not found
   */
  async getFoodPreferences(userId) {
    try {
      const userRef = this.getUserDocRef(userId);
      if (!userRef) throw new Error('User not found');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences?.food || null;
    } catch (error) {
      console.error('Error getting food preferences', error);
      return null;
    }
  }

  /**
   * Save cooking preferences to Firestore
   * @param {string} userId - The user ID
   * @param {object} preferences - Cooking preferences to save
   * @returns {Promise<boolean>} - True if save was successful
   */
  async saveCookingPreferences(userId, preferences) {
    try {
      const userRef = this.getUserDocRef(userId);
      if (!userRef) throw new Error('User not found');
      
      await userRef.update({
        'preferences.cooking': preferences,
        'preferences.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error saving cooking preferences', error);
      return false;
    }
  }

  /**
   * Get cooking preferences from Firestore
   * @param {string} userId - The user ID
   * @returns {Promise<object|null>} - Cooking preferences or null if not found
   */
  async getCookingPreferences(userId) {
    try {
      const userRef = this.getUserDocRef(userId);
      if (!userRef) throw new Error('User not found');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences?.cooking || null;
    } catch (error) {
      console.error('Error getting cooking preferences', error);
      return null;
    }
  }
}

// Export a singleton instance
const firestoreService = new FirestoreService();
module.exports = firestoreService; 