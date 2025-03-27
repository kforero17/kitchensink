import { firestoreService } from './firebaseService';
import { GroceryItem, GroceryListDocument } from '../types/FirestoreSchema';
import logger from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

// Key for storing current grocery list in AsyncStorage
const CURRENT_GROCERY_LIST_KEY = '@grocery_list_current';

/**
 * Service for managing grocery lists
 * Uses Firestore for authenticated users, AsyncStorage for anonymous users
 */
class GroceryListService {
  /**
   * Determines if the app should use Firestore for grocery lists
   * This is true if a user is authenticated, false otherwise
   */
  private shouldUseFirestore(): boolean {
    return auth().currentUser !== null;
  }
  
  /**
   * Create a new grocery list
   * @param name Name of the grocery list
   * @param items Initial grocery items (optional)
   * @returns ID of the created grocery list
   */
  async createGroceryList(name: string, items: GroceryItem[] = []): Promise<string | null> {
    try {
      // Generate a local ID
      const localId = 'local-' + Date.now().toString();
      
      // Create the grocery list object
      const groceryList = {
        id: localId,
        name,
        items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Always save to AsyncStorage first
      await AsyncStorage.setItem(
        CURRENT_GROCERY_LIST_KEY, 
        JSON.stringify(groceryList)
      );
      
      // If authenticated, also save to Firestore
      if (this.shouldUseFirestore()) {
        try {
          const firebaseId = await firestoreService.createGroceryList(name, items);
          if (firebaseId) {
            // Update local copy with Firebase ID
            groceryList.id = firebaseId;
            await AsyncStorage.setItem(
              CURRENT_GROCERY_LIST_KEY, 
              JSON.stringify(groceryList)
            );
            return firebaseId;
          }
        } catch (firestoreError) {
          logger.error('Error creating grocery list in Firestore:', firestoreError);
          // Continue with local ID since we saved to AsyncStorage successfully
        }
      }
      
      return localId;
    } catch (error) {
      logger.error('Error creating grocery list:', error);
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
      if (this.shouldUseFirestore()) {
        // Use Firestore if authenticated
        return await firestoreService.getGroceryList(listId);
      } else {
        // For anonymous users, we only have one list in AsyncStorage
        try {
          // Safely check if AsyncStorage is available
          if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
            logger.error("AsyncStorage is undefined or not available");
            return null;
          }
          
          const data = await AsyncStorage.getItem(CURRENT_GROCERY_LIST_KEY);
          if (!data) return null;
          
          const list = JSON.parse(data);
          return {
            id: 'local-grocery-list',
            name: list.name,
            items: list.items,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt
          };
        } catch (asyncError) {
          logger.error('AsyncStorage error:', asyncError);
          return null;
        }
      }
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
      if (this.shouldUseFirestore()) {
        // Use Firestore if authenticated
        return await firestoreService.getAllGroceryLists();
      } else {
        // For anonymous users, we only have one list in AsyncStorage
        try {
          // Safely check if AsyncStorage is available
          if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
            logger.error("AsyncStorage is undefined or not available");
            return [];
          }
          
          const data = await AsyncStorage.getItem(CURRENT_GROCERY_LIST_KEY);
          if (!data) return [];
          
          const list = JSON.parse(data);
          return [{
            id: 'local-grocery-list',
            name: list.name,
            items: list.items,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt
          }];
        } catch (asyncError) {
          logger.error('AsyncStorage error:', asyncError);
          return [];
        }
      }
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
    data: Partial<Pick<GroceryListDocument, 'name' | 'items'>>
  ): Promise<boolean> {
    try {
      // Safely check if AsyncStorage is available
      if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
        logger.error("AsyncStorage is undefined or not available");
        return false;
      }
      
      // Get current grocery list from AsyncStorage
      const currentData = await AsyncStorage.getItem(CURRENT_GROCERY_LIST_KEY);
      if (!currentData) {
        // Create a new list if none exists
        const success = await this.createGroceryList(
          data.name || 'My Grocery List', 
          data.items || []
        );
        return success !== null;
      }
      
      // Update local data
      const list = JSON.parse(currentData);
      const updatedList = {
        ...list,
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      // Always save to AsyncStorage first
      await AsyncStorage.setItem(
        CURRENT_GROCERY_LIST_KEY, 
        JSON.stringify(updatedList)
      );
      
      // If authenticated, also update in Firestore
      if (this.shouldUseFirestore()) {
        try {
          await firestoreService.updateGroceryList(listId, data);
        } catch (firestoreError) {
          logger.error('Error updating grocery list in Firestore:', firestoreError);
          // We still return true since we saved to AsyncStorage successfully
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error updating grocery list:', error);
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
      if (this.shouldUseFirestore()) {
        // Use Firestore if authenticated
        return await firestoreService.deleteGroceryList(listId);
      } else {
        // For anonymous users, just remove from AsyncStorage
        await AsyncStorage.removeItem(CURRENT_GROCERY_LIST_KEY);
        return true;
      }
    } catch (error) {
      logger.error('Error deleting grocery list', error);
      return false;
    }
  }
  
  /**
   * Add items to a grocery list
   * @param listId ID of the grocery list
   * @param items Items to add
   * @returns True if update was successful
   */
  async addItemsToGroceryList(listId: string, items: GroceryItem[]): Promise<boolean> {
    try {
      // First get the current list
      const currentList = await this.getGroceryList(listId);
      if (!currentList) return false;
      
      // Combine current items with new items, preventing duplicates
      const existingNames = new Set(currentList.items.map(item => item.name.toLowerCase()));
      const newItems = items.filter(item => !existingNames.has(item.name.toLowerCase()));
      const updatedItems = [...currentList.items, ...newItems];
      
      // Update the list
      return await this.updateGroceryList(listId, { items: updatedItems });
    } catch (error) {
      logger.error('Error adding items to grocery list', error);
      return false;
    }
  }
  
  /**
   * Remove items from a grocery list
   * @param listId ID of the grocery list
   * @param itemNames Names of items to remove
   * @returns True if update was successful
   */
  async removeItemsFromGroceryList(listId: string, itemNames: string[]): Promise<boolean> {
    try {
      // First get the current list
      const currentList = await this.getGroceryList(listId);
      if (!currentList) return false;
      
      // Create a set of names to remove (case insensitive)
      const namesToRemove = new Set(itemNames.map(name => name.toLowerCase()));
      
      // Filter out items to remove
      const updatedItems = currentList.items.filter(
        item => !namesToRemove.has(item.name.toLowerCase())
      );
      
      // Update the list
      return await this.updateGroceryList(listId, { items: updatedItems });
    } catch (error) {
      logger.error('Error removing items from grocery list', error);
      return false;
    }
  }
  
  /**
   * Toggle the checked state of an item in a grocery list
   * @param listId ID of the grocery list
   * @param itemName Name of the item to toggle
   * @param isChecked New checked state
   * @returns True if update was successful
   */
  async toggleItemChecked(listId: string, itemName: string, isChecked: boolean): Promise<boolean> {
    try {
      // First get the current list
      const currentList = await this.getGroceryList(listId);
      if (!currentList) return false;
      
      // Find and update the item
      const updatedItems = currentList.items.map(item => {
        if (item.name.toLowerCase() === itemName.toLowerCase()) {
          return {
            ...item,
            isChecked
          };
        }
        return item;
      });
      
      // Update the list
      return await this.updateGroceryList(listId, { items: updatedItems });
    } catch (error) {
      logger.error('Error updating item in grocery list', error);
      return false;
    }
  }
  
  /**
   * Migrate local grocery list to Firestore after user signs in
   * @returns True if migration was successful
   */
  async migrateLocalGroceryListToFirestore(): Promise<boolean> {
    try {
      if (!this.shouldUseFirestore()) {
        // Can't migrate if not authenticated
        return false;
      }
      
      // Safely check if AsyncStorage is available
      if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
        logger.error("AsyncStorage is undefined or not available");
        return false;
      }
      
      // Get local grocery list
      const data = await AsyncStorage.getItem(CURRENT_GROCERY_LIST_KEY);
      if (!data) return true; // Nothing to migrate
      
      const localList = JSON.parse(data);
      
      // Create as new list in Firestore
      const listId = await firestoreService.createGroceryList(
        localList.name || 'Migrated List',
        localList.items || []
      );
      
      if (listId) {
        // Remove local list after successful migration
        await AsyncStorage.removeItem(CURRENT_GROCERY_LIST_KEY);
        logger.debug('Successfully migrated grocery list to Firestore');
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error migrating grocery list to Firestore', error);
      return false;
    }
  }
}

// Export singleton instance
export const groceryListService = new GroceryListService(); 