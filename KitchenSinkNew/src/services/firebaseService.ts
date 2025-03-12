import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
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
import logger from '../utils/logger';

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
        displayName,
        photoURL,
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
      
      await firestore()
        .collection(FIRESTORE_PATHS.USERS)
        .doc(userId)
        .set(userData);
      
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
      const querySnapshot = await recipesRef
        .where('name', '==', recipe.name)
        .limit(1)
        .get();
      
      if (!querySnapshot.empty) {
        // Update existing recipe
        const existingDoc = querySnapshot.docs[0];
        await existingDoc.ref.update({
          ...recipe,
          updatedAt: timestamp
        });
        return existingDoc.id;
      }
      
      // Create new recipe
      const docRef = await recipesRef.add({
        ...recipe,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      
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
  }): Promise<RecipeDocument[]> {
    try {
      const userRef = this.getUserDocRef();
      if (!userRef) throw new Error('User not authenticated');
      
      const recipesRef = userRef.collection(FIRESTORE_PATHS.RECIPES);
      
      let query: FirebaseFirestoreTypes.Query = recipesRef;
      
      // Apply filters if provided
      if (options?.isFavorite !== undefined) {
        query = query.where('isFavorite', '==', options.isFavorite);
      }
      
      // Sort by updated time
      query = query.orderBy('updatedAt', 'desc');
      
      // Apply limit if provided
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      const querySnapshot = await query.get();
      
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
}

// Export singleton instance
export const firestoreService = new FirestoreService(); 