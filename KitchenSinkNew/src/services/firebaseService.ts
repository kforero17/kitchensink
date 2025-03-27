import logger from '../utils/logger';
import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { 
  UserDocument, 
  UserPreferences, 
  GroceryListDocument, 
  GroceryItem, 
  RecipeDocument,
  FIRESTORE_PATHS
} from '../types/FirestoreSchema';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';

/**
 * Utility function to clean objects before sending to Firestore
 * Removes undefined values that cause errors
 */
const cleanForFirestore = (data: any): any => {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item));
  }

  if (typeof data === 'object' && data !== null) {
    const cleanObject: {[key: string]: any} = {};
    
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
 * 
 * Provides methods for interacting with Firestore database
 */
class FirestoreService {
  /**
   * Get current user ID from Firebase Auth
   * @returns User ID or null if not authenticated
   */
  private getCurrentUserId(): string | null {
    const user = auth().currentUser;
    return user ? user.uid : null;
  }

  /**
   * Get a reference to the current user's document
   * @returns Firestore document reference or null if not authenticated
   */
  private getUserDocRef(): FirebaseFirestoreTypes.DocumentReference | null {
    const userId = this.getCurrentUserId();
    if (!userId) return null;
    
    return firestore().collection(FIRESTORE_PATHS.USERS).doc(userId);
  }

  /**
   * Get a reference to the current user's app settings collection
   * @returns Firestore document reference or null if not authenticated
   */
  private getAppSettingsRef(): FirebaseFirestoreTypes.DocumentReference | null {
    const userRef = this.getUserDocRef();
    if (!userRef) return null;
    
    return userRef.collection(FIRESTORE_PATHS.APP_SETTINGS).doc('settings');
  }

  /**
   * Initialize a new user in Firestore after registration
   * @param userId The user ID from Firebase Auth
   * @param email The user's email address
   * @param displayName Optional display name
   * @param photoURL Optional photo URL
   */
  async initializeNewUser(
    userId: string, 
    email: string, 
    displayName?: string, 
    photoURL?: string
  ): Promise<void> {
    try {
      const timestamp = firestore.FieldValue.serverTimestamp();
      
      // Create initial user document with empty preferences
      const userData: Partial<UserDocument> = {
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
          // TypeScript workaround: Cast the server timestamp as any since it will be converted to Timestamp on write
          createdAt: timestamp as any,
          updatedAt: timestamp as any
        },
        createdAt: timestamp as any,
        updatedAt: timestamp as any
      };
      
      // Clean the data to remove undefined values
      const cleanedData = cleanForFirestore(userData);
      
      await firestore()
        .collection(FIRESTORE_PATHS.USERS)
        .doc(userId)
        .set(cleanedData);
      
      logger.debug('New user initialized in Firestore', { userId });
    } catch (error) {
      logger.error('Error initializing new user in Firestore', error);
      throw error;
    }
  }

  /**
   * Check if the current user exists in Firestore
   * @returns True if user exists, false otherwise
   */
  async userExists(): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) return false;
      
      const doc = await userRef.get();
      return doc.exists;
    } catch (error) {
      logger.error('Error checking if user exists', error);
      return false;
    }
  }

  // ======== USER PREFERENCES METHODS ========

  /**
   * Save dietary preferences to Firestore
   * @param preferences Dietary preferences to save
   * @returns True if save was successful
   */
  async saveDietaryPreferences(preferences: DietaryPreferences): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      await userRef.update({
        'preferences.dietary': preferences,
        'preferences.updatedAt': firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      logger.error('Error saving dietary preferences', error);
      return false;
    }
  }

  /**
   * Get dietary preferences from Firestore
   * @returns Dietary preferences or null if not found
   */
  async getDietaryPreferences(): Promise<DietaryPreferences | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences?.dietary || null;
    } catch (error) {
      logger.error('Error getting dietary preferences', error);
      return null;
    }
  }

  /**
   * Save food preferences to Firestore
   * @param preferences Food preferences to save
   * @returns True if save was successful
   */
  async saveFoodPreferences(preferences: FoodPreferences): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      await userRef.update({
        'preferences.food': preferences,
        'preferences.updatedAt': firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      logger.error('Error saving food preferences', error);
      return false;
    }
  }

  /**
   * Get food preferences from Firestore
   * @returns Food preferences or null if not found
   */
  async getFoodPreferences(): Promise<FoodPreferences | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences?.food || null;
    } catch (error) {
      logger.error('Error getting food preferences', error);
      return null;
    }
  }

  /**
   * Save cooking preferences to Firestore
   * @param preferences Cooking preferences to save
   * @returns True if save was successful
   */
  async saveCookingPreferences(preferences: CookingPreferences): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      await userRef.update({
        'preferences.cooking': preferences,
        'preferences.updatedAt': firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      logger.error('Error saving cooking preferences', error);
      return false;
    }
  }

  /**
   * Get cooking preferences from Firestore
   * @returns Cooking preferences or null if not found
   */
  async getCookingPreferences(): Promise<CookingPreferences | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences?.cooking || null;
    } catch (error) {
      logger.error('Error getting cooking preferences', error);
      return null;
    }
  }

  /**
   * Save budget preferences to Firestore
   * @param preferences Budget preferences to save
   * @returns True if save was successful
   */
  async saveBudgetPreferences(preferences: BudgetPreferences): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      await userRef.update({
        'preferences.budget': preferences,
        'preferences.updatedAt': firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      logger.error('Error saving budget preferences', error);
      return false;
    }
  }

  /**
   * Get budget preferences from Firestore
   * @returns Budget preferences or null if not found
   */
  async getBudgetPreferences(): Promise<BudgetPreferences | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences?.budget || null;
    } catch (error) {
      logger.error('Error getting budget preferences', error);
      return null;
    }
  }

  /**
   * Get all user preferences from Firestore
   * @returns User preferences or null if not found
   */
  async getAllPreferences(): Promise<UserPreferences | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const doc = await userRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data();
      return data?.preferences || null;
    } catch (error) {
      logger.error('Error getting all preferences', error);
      return null;
    }
  }

  // ======== GROCERY LIST METHODS ========

  /**
   * Create a new grocery list
   * @param name Name of the grocery list
   * @param items Initial grocery items (optional)
   * @returns ID of the created grocery list
   */
  async createGroceryList(
    name: string, 
    items: GroceryItem[] = []
  ): Promise<string | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const timestamp = firestore.FieldValue.serverTimestamp();
      
      const groceryListsRef = userRef.collection(FIRESTORE_PATHS.GROCERY_LISTS);
      const docRef = await groceryListsRef.add({
        name,
        items,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      
      return docRef.id;
    } catch (error) {
      logger.error('Error creating grocery list', error);
      return null;
    }
  }

  /**
   * Get a grocery list by ID
   * @param listId ID of the grocery list
   * @returns Grocery list document or null if not found
   */
  async getGroceryList(listId: string): Promise<GroceryListDocument | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const groceryListRef = userRef
        .collection(FIRESTORE_PATHS.GROCERY_LISTS)
        .doc(listId);
      
      const doc = await groceryListRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data() as Omit<GroceryListDocument, 'id'>;
      return {
        id: doc.id,
        ...data
      };
    } catch (error) {
      logger.error('Error getting grocery list', error);
      return null;
    }
  }

  /**
   * Get all grocery lists for the current user
   * @returns Array of grocery list documents
   */
  async getAllGroceryLists(): Promise<GroceryListDocument[]> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const groceryListsRef = userRef.collection(FIRESTORE_PATHS.GROCERY_LISTS);
      const querySnapshot = await groceryListsRef
        .orderBy('updatedAt', 'desc')
        .get();
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<GroceryListDocument, 'id'>;
        return {
          id: doc.id,
          ...data
        };
      });
    } catch (error) {
      logger.error('Error getting all grocery lists', error);
      return [];
    }
  }

  /**
   * Update a grocery list
   * @param listId ID of the grocery list
   * @param data Data to update
   * @returns True if update was successful
   */
  async updateGroceryList(
    listId: string, 
    data: Partial<Omit<GroceryListDocument, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const groceryListRef = userRef
        .collection(FIRESTORE_PATHS.GROCERY_LISTS)
        .doc(listId);
      
      await groceryListRef.update({
        ...data,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      logger.error('Error updating grocery list', error);
      return false;
    }
  }

  /**
   * Delete a grocery list
   * @param listId ID of the grocery list
   * @returns True if deletion was successful
   */
  async deleteGroceryList(listId: string): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const groceryListRef = userRef
        .collection(FIRESTORE_PATHS.GROCERY_LISTS)
        .doc(listId);
      
      await groceryListRef.delete();
      
      return true;
    } catch (error) {
      logger.error('Error deleting grocery list', error);
      return false;
    }
  }

  // ======== RECIPE METHODS ========

  /**
   * Save a recipe to the user's collection
   * @param recipe Recipe data to save
   * @returns ID of the saved recipe
   */
  async saveRecipe(recipe: Omit<RecipeDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const timestamp = firestore.FieldValue.serverTimestamp();
      
      const recipesRef = userRef.collection(FIRESTORE_PATHS.RECIPES);
      
      // Check if recipe already exists by name to avoid duplicates
      const existingQuery = recipesRef.where('name', '==', recipe.name);
      const querySnapshot = await existingQuery.limit(1).get();
      
      // Ensure isWeeklyMealPlan has a default value
      const isWeeklyMealPlan = recipe.isWeeklyMealPlan ?? false;
      
      // Clean the recipe data
      const cleanedRecipe = cleanForFirestore({
        ...recipe,
        isWeeklyMealPlan, // Assign the variable here
        createdAt: timestamp,
        updatedAt: timestamp
      });
      
      if (!querySnapshot.empty) {
        // Update existing recipe - preserve existing values if not provided
        const existingDoc = querySnapshot.docs[0];
        const existingData = existingDoc.data();
        
        // Always update isWeeklyMealPlan flag if it's explicitly set to true
        // This ensures recipes get properly tagged when added to a meal plan
        if (isWeeklyMealPlan) {
          cleanedRecipe.isWeeklyMealPlan = true;
        } else {
          // Otherwise preserve the existing flag value
          cleanedRecipe.isWeeklyMealPlan = existingData.isWeeklyMealPlan || false;
        }
        
        await existingDoc.ref.update({
          ...cleanedRecipe,
          updatedAt: timestamp
        });
        
        console.log(`Updated existing recipe: ${recipe.name}, isWeeklyMealPlan: ${cleanedRecipe.isWeeklyMealPlan}`);
        return existingDoc.id;
      }
      
      // Create new recipe
      const docRef = await recipesRef.add(cleanedRecipe);
      console.log(`Created new recipe: ${recipe.name}, isWeeklyMealPlan: ${isWeeklyMealPlan}`);
      
      return docRef.id;
    } catch (error) {
      logger.error('Error saving recipe', error);
      return null;
    }
  }

  /**
   * Get a recipe by ID
   * @param recipeId ID of the recipe
   * @returns Recipe document or null if not found
   */
  async getRecipe(recipeId: string): Promise<RecipeDocument | null> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const recipeRef = userRef
        .collection(FIRESTORE_PATHS.RECIPES)
        .doc(recipeId);
      
      const doc = await recipeRef.get();
      if (!doc.exists) return null;
      
      const data = doc.data() as Omit<RecipeDocument, 'id'>;
      return {
        id: doc.id,
        ...data
      };
    } catch (error) {
      logger.error('Error getting recipe', error);
      return null;
    }
  }

  /**
   * Get all recipes for the current user
   * @param options Options for filtering and sorting
   * @returns Array of recipe documents
   */
  async getAllRecipes(options?: {
    limit?: number;
    tags?: string[];
    isFavorite?: boolean;
    isWeeklyMealPlan?: boolean;
    forceRefresh?: number; // Timestamp to force cache bypass
  }): Promise<RecipeDocument[]> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const recipesRef = userRef.collection(FIRESTORE_PATHS.RECIPES);
      
      let query: FirebaseFirestoreTypes.Query = recipesRef;
      
      // Start with base query with required conditions
      if (options?.isWeeklyMealPlan !== undefined) {
        // Explicitly filter for weekly meal plan recipes
        query = query.where('isWeeklyMealPlan', '==', options.isWeeklyMealPlan);
      }
      
      // Additional filters
      if (options?.isFavorite !== undefined) {
        query = query.where('isFavorite', '==', options.isFavorite);
      }
      
      // Sort by updated time
      query = query.orderBy('updatedAt', 'desc');
      
      // Apply limit if provided
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      // If forceRefresh is provided, use it to create a cache-busting source option
      let querySnapshot;
      if (options?.forceRefresh) {
        // Use getOptions to force server read and bypass cache
        querySnapshot = await query.get({ source: 'server' });
        console.log('Forcing fresh data from server for recipes query');
      } else {
        querySnapshot = await query.get();
      }
      
      // Log number of recipes found for debugging
      console.log(`Found ${querySnapshot.size} recipes matching query${options?.isWeeklyMealPlan ? ' (weekly meal plan)' : ''}`);
      
      let recipes = querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<RecipeDocument, 'id'>;
        return {
          id: doc.id,
          ...data
        };
      });
      
      // Filter by tags if provided (client-side filtering since Firestore doesn't support array contains any directly)
      if (options?.tags && options.tags.length > 0) {
        recipes = recipes.filter(recipe => {
          return recipe.tags.some(tag => options.tags!.includes(tag));
        });
      }
      
      return recipes;
    } catch (error) {
      logger.error('Error getting all recipes', error);
      return [];
    }
  }

  /**
   * Update a recipe
   * @param recipeId ID of the recipe
   * @param data Data to update
   * @returns True if update was successful
   */
  async updateRecipe(
    recipeId: string, 
    data: Partial<Omit<RecipeDocument, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const recipeRef = userRef
        .collection(FIRESTORE_PATHS.RECIPES)
        .doc(recipeId);
      
      await recipeRef.update({
        ...data,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      logger.error('Error updating recipe', error);
      return false;
    }
  }

  /**
   * Toggle favorite status for a recipe
   * @param recipeId ID of the recipe
   * @param isFavorite Whether to mark as favorite
   * @returns True if update was successful
   */
  async toggleFavoriteRecipe(recipeId: string, isFavorite: boolean): Promise<boolean> {
    return this.updateRecipe(recipeId, { isFavorite });
  }

  /**
   * Delete a recipe
   * @param recipeId ID of the recipe
   * @returns True if deletion was successful
   */
  async deleteRecipe(recipeId: string): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const recipeRef = userRef
        .collection(FIRESTORE_PATHS.RECIPES)
        .doc(recipeId);
      
      await recipeRef.delete();
      
      return true;
    } catch (error) {
      logger.error('Error deleting recipe', error);
      return false;
    }
  }

  // ======== APP SETTINGS METHODS ========

  /**
   * Get all app settings from Firestore
   * @returns App settings object or null if not authenticated or not found
   */
  async getAppSettings(): Promise<Record<string, any> | null> {
    try {
      const settingsRef = this.getAppSettingsRef();
      if (!settingsRef) return null;
      
      const doc = await settingsRef.get();
      if (!doc.exists) return null;
      
      return doc.data() as Record<string, any>;
    } catch (error) {
      logger.error('Error getting app settings', error);
      return null;
    }
  }
  
  /**
   * Save a single app setting to Firestore
   * @param key Setting key
   * @param value Setting value
   * @returns True if save was successful
   */
  async saveAppSetting(key: string, value: any): Promise<boolean> {
    try {
      const settingsRef = this.getAppSettingsRef();
      if (!settingsRef) throw new Error('User not authenticated');
      
      await settingsRef.set({
        [key]: value,
        updatedAt: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      return true;
    } catch (error) {
      logger.error(`Error saving app setting ${key}`, error);
      return false;
    }
  }
  
  /**
   * Delete an app setting from Firestore
   * @param key Setting key to delete
   * @returns True if deletion was successful
   */
  async deleteAppSetting(key: string): Promise<boolean> {
    try {
      const settingsRef = this.getAppSettingsRef();
      if (!settingsRef) throw new Error('User not authenticated');
      
      // Use the field delete operation to remove the field
      await settingsRef.update({
        [key]: firestore.FieldValue.delete(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      logger.error(`Error deleting app setting ${key}`, error);
      return false;
    }
  }

  /**
   * Reset the weekly meal plan flag on all recipes
   * This is useful for cleaning up data
   * @returns Promise resolving to true if successful
   */
  async resetAllWeeklyMealPlanFlags(): Promise<boolean> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const recipesRef = userRef.collection(FIRESTORE_PATHS.RECIPES);
      
      // First get all recipes that have isWeeklyMealPlan = true
      const querySnapshot = await recipesRef.where('isWeeklyMealPlan', '==', true).get();
      
      console.log(`Found ${querySnapshot.size} recipes with isWeeklyMealPlan=true to reset`);
      
      if (querySnapshot.size === 0) {
        console.log('No recipes with isWeeklyMealPlan=true found, nothing to reset');
        return true;
      }
      
      // Use a batch to update multiple documents
      const batch = firestore().batch();
      
      // Track recipes being reset
      const resetRecipes: string[] = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        resetRecipes.push(data.name);
        
        batch.update(doc.ref, { 
          isWeeklyMealPlan: false,
          updatedAt: firestore.FieldValue.serverTimestamp()
        });
      });
      
      // Log which recipes are being reset
      console.log(`Resetting weekly meal plan flag for recipes: ${resetRecipes.join(', ')}`);
      
      // Commit the batch
      await batch.commit();
      console.log(`Reset isWeeklyMealPlan flag on ${querySnapshot.size} recipes`);
      
      return true;
    } catch (error) {
      logger.error('Error resetting weekly meal plan flags', error);
      return false;
    }
  }

  /**
   * Test Firestore permissions by writing and reading a test document
   * @returns Promise that resolves on success or rejects on error
   */
  async testFirestorePermissions(): Promise<void> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      // Test writing to a user-specific document (should be allowed)
      const testDocRef = userRef
        .collection('test')
        .doc('permissions_test');
      
      await testDocRef.set({
        timestamp: firestore.FieldValue.serverTimestamp(),
        message: 'Permissions test successful'
      });
      
      console.log('Successfully wrote to test document');
      
      // Test reading the document back
      const docSnapshot = await testDocRef.get();
      if (!docSnapshot.exists) {
        throw new Error('Test document not found after writing');
      }
      
      console.log('Successfully read test document');
    } catch (error) {
      logger.error('Firestore permissions test failed', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firestoreService = new FirestoreService(); 