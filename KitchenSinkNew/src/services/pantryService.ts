import { firestoreService } from './firebaseService';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { 
  PantryItemDocument, 
  MeasurementUnit, 
  ItemStatus,
  FIRESTORE_PATHS
} from '../types/FirestoreSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

// Key for storing pantry items in AsyncStorage (for unauthenticated users)
const PANTRY_ITEMS_KEY = '@pantry_items';

/**
 * Service for managing pantry items
 * Uses Firestore for authenticated users, AsyncStorage for anonymous users
 */
class PantryService {
  /**
   * Determines if the app should use Firestore
   * This is true if a user is authenticated, false otherwise
   */
  private shouldUseFirestore(): boolean {
    return auth().currentUser !== null;
  }

  /**
   * Get pantry collection reference for current user
   * @returns Firestore collection reference or null if not authenticated
   */
  private getPantryCollectionRef(): FirebaseFirestoreTypes.CollectionReference | null {
    const userId = auth().currentUser?.uid;
    if (!userId) return null;
    
    return firestore()
      .collection(FIRESTORE_PATHS.USERS)
      .doc(userId)
      .collection(FIRESTORE_PATHS.PANTRY_ITEMS);
  }

  /**
   * Add a new item to the pantry
   * @param item Pantry item data
   * @returns ID of created item or null if failed
   */
  async addPantryItem(
    item: Omit<PantryItemDocument, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<string | null> {
    try {
      // Calculate status based on expiration date if provided
      let status: ItemStatus = 'normal';
      
      if (item.expirationDate) {
        const now = new Date();
        const expirationDate = item.expirationDate.toDate();
        const daysUntilExpiration = Math.floor(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysUntilExpiration < 0) {
          status = 'expired';
        } else if (daysUntilExpiration < 7) {
          status = 'expiring';
        } else {
          status = 'fresh';
        }
      }
      
      // Check quantity for low status
      if (item.reorderThreshold && item.quantity <= item.reorderThreshold) {
        status = 'low';
      }
      
      // Generate a local ID and set dates
      const id = 'local-' + Date.now().toString();
      const timestamp = new Date();
      
      // Create the complete item
      const newItem: PantryItemDocument = {
        id,
        ...item,
        status,
        createdAt: { toDate: () => timestamp } as any,
        updatedAt: { toDate: () => timestamp } as any,
      };
      
      // Get existing items
      const existingItems = await this.getAllPantryItems();
      
      // Always save to AsyncStorage first
      await AsyncStorage.setItem(
        PANTRY_ITEMS_KEY,
        JSON.stringify([...existingItems, newItem])
      );
      
      // If authenticated, also save to Firestore
      if (this.shouldUseFirestore()) {
        try {
          const pantryRef = this.getPantryCollectionRef();
          if (pantryRef) {
            const timestamp = firestore.FieldValue.serverTimestamp();
            
            const docRef = await pantryRef.add({
              ...item,
              status,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
            
            // Update local item with Firestore ID
            newItem.id = docRef.id;
            
            // Update AsyncStorage with new ID
            const updatedItems = existingItems.filter(i => i.id !== id).concat(newItem);
            await AsyncStorage.setItem(PANTRY_ITEMS_KEY, JSON.stringify(updatedItems));
            
            return docRef.id;
          }
        } catch (firestoreError) {
          logger.error('Error saving pantry item to Firestore:', firestoreError);
          // We still return the local ID since we saved to AsyncStorage successfully
        }
      }
      
      return id;
    } catch (error) {
      logger.error('Error adding pantry item:', error);
      return null;
    }
  }

  /**
   * Get all pantry items for the current user
   * @returns Array of pantry items
   */
  async getAllPantryItems(): Promise<PantryItemDocument[]> {
    try {
      if (this.shouldUseFirestore()) {
        // Use Firestore for authenticated users
        const pantryRef = this.getPantryCollectionRef();
        if (!pantryRef) return [];
        
        const snapshot = await pantryRef.orderBy('name').get();
        
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data
          } as PantryItemDocument;
        });
      } else {
        // Use AsyncStorage for anonymous users
        const data = await AsyncStorage.getItem(PANTRY_ITEMS_KEY);
        if (!data) return [];
        
        return JSON.parse(data) as PantryItemDocument[];
      }
    } catch (error) {
      logger.error('Error getting pantry items:', error);
      return [];
    }
  }

  /**
   * Get a pantry item by ID
   * @param itemId ID of the pantry item
   * @returns Pantry item or null if not found
   */
  async getPantryItem(itemId: string): Promise<PantryItemDocument | null> {
    try {
      if (this.shouldUseFirestore()) {
        // Use Firestore for authenticated users
        const pantryRef = this.getPantryCollectionRef();
        if (!pantryRef) return null;
        
        const doc = await pantryRef.doc(itemId).get();
        
        if (!doc.exists) return null;
        
        return {
          id: doc.id,
          ...doc.data()
        } as PantryItemDocument;
      } else {
        // Use AsyncStorage for anonymous users
        const items = await this.getAllPantryItems();
        return items.find(item => item.id === itemId) || null;
      }
    } catch (error) {
      logger.error('Error getting pantry item:', error);
      return null;
    }
  }

  /**
   * Update a pantry item
   * @param itemId ID of the pantry item
   * @param updates Partial data to update
   * @returns True if update was successful
   */
  async updatePantryItem(
    itemId: string,
    updates: Partial<Omit<PantryItemDocument, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<boolean> {
    try {
      // Calculate status if expiration date is being updated
      if (updates.expirationDate) {
        const now = new Date();
        const expirationDate = updates.expirationDate.toDate();
        const daysUntilExpiration = Math.floor(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysUntilExpiration < 0) {
          updates.status = 'expired';
        } else if (daysUntilExpiration < 7) {
          updates.status = 'expiring';
        } else {
          updates.status = 'fresh';
        }
      }
      
      // Check quantity for low status if it's being updated
      if (updates.quantity !== undefined) {
        // Get the current item to check against reorderThreshold
        const currentItem = await this.getPantryItem(itemId);
        
        if (currentItem && 
            (updates.reorderThreshold || currentItem.reorderThreshold) && 
            updates.quantity <= (updates.reorderThreshold || currentItem.reorderThreshold || 0)) {
          updates.status = 'low';
        }
      }
      
      if (this.shouldUseFirestore()) {
        // Use Firestore for authenticated users
        const pantryRef = this.getPantryCollectionRef();
        if (!pantryRef) return false;
        
        await pantryRef.doc(itemId).update({
          ...updates,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        
        return true;
      } else {
        // Use AsyncStorage for anonymous users
        const items = await this.getAllPantryItems();
        const itemIndex = items.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) return false;
        
        // Update the item
        items[itemIndex] = {
          ...items[itemIndex],
          ...updates,
          updatedAt: { toDate: () => new Date() } as any,
        };
        
        // Save back to AsyncStorage
        await AsyncStorage.setItem(PANTRY_ITEMS_KEY, JSON.stringify(items));
        
        return true;
      }
    } catch (error) {
      logger.error('Error updating pantry item:', error);
      return false;
    }
  }

  /**
   * Delete a pantry item
   * @param itemId ID of the pantry item
   * @returns True if deletion was successful
   */
  async deletePantryItem(itemId: string): Promise<boolean> {
    try {
      if (this.shouldUseFirestore()) {
        // Use Firestore for authenticated users
        const pantryRef = this.getPantryCollectionRef();
        if (!pantryRef) return false;
        
        await pantryRef.doc(itemId).delete();
        
        return true;
      } else {
        // Use AsyncStorage for anonymous users
        const items = await this.getAllPantryItems();
        const filteredItems = items.filter(item => item.id !== itemId);
        
        // Save back to AsyncStorage
        await AsyncStorage.setItem(PANTRY_ITEMS_KEY, JSON.stringify(filteredItems));
        
        return true;
      }
    } catch (error) {
      logger.error('Error deleting pantry item:', error);
      return false;
    }
  }

  /**
   * Get pantry items by category
   * @param category Category to filter by
   * @returns Array of pantry items in the specified category
   */
  async getPantryItemsByCategory(category: string): Promise<PantryItemDocument[]> {
    try {
      if (this.shouldUseFirestore()) {
        // Use Firestore for authenticated users
        const pantryRef = this.getPantryCollectionRef();
        if (!pantryRef) return [];
        
        const snapshot = await pantryRef
          .where('category', '==', category)
          .orderBy('name')
          .get();
        
        return snapshot.docs.map(doc => {
          return {
            id: doc.id,
            ...doc.data()
          } as PantryItemDocument;
        });
      } else {
        // Use AsyncStorage for anonymous users
        const items = await this.getAllPantryItems();
        return items.filter(item => item.category === category);
      }
    } catch (error) {
      logger.error('Error getting pantry items by category:', error);
      return [];
    }
  }

  /**
   * Get pantry items by status
   * @param status Status to filter by
   * @returns Array of pantry items with the specified status
   */
  async getPantryItemsByStatus(status: ItemStatus): Promise<PantryItemDocument[]> {
    try {
      if (this.shouldUseFirestore()) {
        // Use Firestore for authenticated users
        const pantryRef = this.getPantryCollectionRef();
        if (!pantryRef) return [];
        
        const snapshot = await pantryRef
          .where('status', '==', status)
          .orderBy('name')
          .get();
        
        return snapshot.docs.map(doc => {
          return {
            id: doc.id,
            ...doc.data()
          } as PantryItemDocument;
        });
      } else {
        // Use AsyncStorage for anonymous users
        const items = await this.getAllPantryItems();
        return items.filter(item => item.status === status);
      }
    } catch (error) {
      logger.error('Error getting pantry items by status:', error);
      return [];
    }
  }

  /**
   * Get expiring pantry items
   * @param daysThreshold Number of days to consider for expiration (default: 7)
   * @returns Array of pantry items that will expire within the threshold
   */
  async getExpiringItems(daysThreshold: number = 7): Promise<PantryItemDocument[]> {
    try {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
      
      if (this.shouldUseFirestore()) {
        // Use Firestore for authenticated users
        const pantryRef = this.getPantryCollectionRef();
        if (!pantryRef) return [];
        
        // We need to get all items with an expiration date and filter client-side
        // since Firestore doesn't support <= and >= in the same query
        const snapshot = await pantryRef
          .where('expirationDate', '>=', firestore.Timestamp.fromDate(now))
          .where('expirationDate', '<=', firestore.Timestamp.fromDate(thresholdDate))
          .get();
        
        return snapshot.docs.map(doc => {
          return {
            id: doc.id,
            ...doc.data()
          } as PantryItemDocument;
        });
      } else {
        // Use AsyncStorage for anonymous users
        const items = await this.getAllPantryItems();
        
        return items.filter(item => {
          if (!item.expirationDate) return false;
          
          const expirationDate = item.expirationDate.toDate();
          return expirationDate >= now && expirationDate <= thresholdDate;
        });
      }
    } catch (error) {
      logger.error('Error getting expiring pantry items:', error);
      return [];
    }
  }

  /**
   * Update the quantity of a pantry item
   * @param itemId ID of the pantry item
   * @param quantity New quantity
   * @returns True if update was successful
   */
  async updateItemQuantity(itemId: string, quantity: number): Promise<boolean> {
    return this.updatePantryItem(itemId, { quantity });
  }

  /**
   * Get low stock items (below reorder threshold)
   * @returns Array of pantry items with quantity below reorder threshold
   */
  async getLowStockItems(): Promise<PantryItemDocument[]> {
    try {
      // For simplicity, we'll just filter all items rather than doing complex queries
      const allItems = await this.getAllPantryItems();
      
      return allItems.filter(item => 
        item.reorderThreshold !== undefined && 
        item.quantity <= item.reorderThreshold
      );
    } catch (error) {
      logger.error('Error getting low stock items:', error);
      return [];
    }
  }

  /**
   * Add items from grocery list to pantry
   * @param groceryItems Array of grocery items to add to pantry
   * @returns Number of items successfully added
   */
  async addGroceryItemsToPantry(groceryItems: Array<{
    name: string;
    measurement: string;
    category: string;
  }>): Promise<number> {
    try {
      let successCount = 0;
      
      // Process each grocery item
      for (const groceryItem of groceryItems) {
        // Parse quantity and unit from measurement
        const { quantity, unit } = this.parseMeasurement(groceryItem.measurement);
        
        // Check if item already exists in pantry
        const existingItems = await this.getAllPantryItems();
        const existingItem = existingItems.find(
          item => item.name.toLowerCase() === groceryItem.name.toLowerCase() && 
                 item.unit === unit
        );
        
        if (existingItem) {
          // Update existing item quantity
          const success = await this.updateItemQuantity(
            existingItem.id, 
            existingItem.quantity + quantity
          );
          
          if (success) successCount++;
        } else {
          // Add as new pantry item
          const itemId = await this.addPantryItem({
            name: groceryItem.name,
            quantity,
            unit: unit as MeasurementUnit,
            category: groceryItem.category,
            purchaseDate: firestore.Timestamp.now(),
          });
          
          if (itemId) successCount++;
        }
      }
      
      return successCount;
    } catch (error) {
      logger.error('Error adding grocery items to pantry:', error);
      return 0;
    }
  }

  /**
   * Check if an ingredient is available in the pantry
   * @param ingredientName Name of the ingredient
   * @param requiredQuantity Required quantity (optional)
   * @param requiredUnit Required unit (optional)
   * @returns True if ingredient is available in sufficient quantity
   */
  async isIngredientAvailable(
    ingredientName: string,
    requiredQuantity?: number,
    requiredUnit?: string
  ): Promise<boolean> {
    try {
      const allItems = await this.getAllPantryItems();
      
      // Find items with matching name (case insensitive)
      const matchingItems = allItems.filter(item => 
        item.name.toLowerCase() === ingredientName.toLowerCase()
      );
      
      if (matchingItems.length === 0) return false;
      
      // If no quantity is required, just check if the ingredient exists
      if (requiredQuantity === undefined) return true;
      
      // If a specific unit is required, check if we have that unit
      if (requiredUnit) {
        const itemWithMatchingUnit = matchingItems.find(
          item => item.unit.toLowerCase() === requiredUnit.toLowerCase()
        );
        
        return itemWithMatchingUnit !== undefined && 
               itemWithMatchingUnit.quantity >= requiredQuantity;
      }
      
      // Otherwise, just check if any matching item has sufficient quantity
      return matchingItems.some(item => item.quantity >= requiredQuantity);
    } catch (error) {
      logger.error('Error checking ingredient availability:', error);
      return false;
    }
  }

  /**
   * Check if a recipe ingredient exists in the pantry
   * @param ingredientName The name of the ingredient to check
   * @returns Boolean indicating if the ingredient is available
   */
  async isIngredientInPantry(ingredientName: string): Promise<boolean> {
    try {
      const items = await this.getAllPantryItems();
      
      // Normalize the ingredient name for comparison
      const normalizedName = ingredientName.toLowerCase().trim();
      
      // Check if any pantry item name contains or is contained in the ingredient name
      // This is a simple approach that handles partial matches
      return items.some(item => {
        const pantryItemName = item.name.toLowerCase().trim();
        return pantryItemName.includes(normalizedName) || 
               normalizedName.includes(pantryItemName);
      });
    } catch (error) {
      logger.error('Error checking ingredient in pantry:', error);
      return false;
    }
  }

  /**
   * Parse quantity and unit from a measurement string
   * @param measurement Measurement string (e.g., "2 cups", "1 pound")
   * @returns Object with quantity and unit
   */
  private parseMeasurement(measurement: string): { quantity: number; unit: string } {
    try {
      // Default values
      let quantity = 1;
      let unit = 'whole';
      
      // Try to extract numeric part
      const match = measurement.match(/^([\d./]+)\s*(.*)$/);
      
      if (match) {
        // Parse the quantity
        const quantityStr = match[1];
        if (quantityStr.includes('/')) {
          // Handle fractions
          const [numerator, denominator] = quantityStr.split('/').map(Number);
          quantity = numerator / denominator;
        } else {
          quantity = parseFloat(quantityStr);
        }
        
        // Get the unit part
        const unitPart = match[2].trim().toLowerCase();
        
        // Map common unit variations to our standard units
        const unitMapping: { [key: string]: MeasurementUnit } = {
          'cup': 'cups',
          'cups': 'cups',
          'tbsp': 'tablespoons',
          'tablespoon': 'tablespoons',
          'tablespoons': 'tablespoons',
          'tsp': 'teaspoons',
          'teaspoon': 'teaspoons',
          'teaspoons': 'teaspoons',
          'oz': 'ounces',
          'ounce': 'ounces',
          'ounces': 'ounces',
          'lb': 'pounds',
          'pound': 'pounds',
          'pounds': 'pounds',
          'g': 'grams',
          'gram': 'grams',
          'grams': 'grams',
          'kg': 'kilograms',
          'kilogram': 'kilograms',
          'kilograms': 'kilograms',
          'ml': 'milliliters',
          'milliliter': 'milliliters',
          'milliliters': 'milliliters',
          'l': 'liters',
          'liter': 'liters',
          'liters': 'liters',
          'piece': 'pieces',
          'pieces': 'pieces',
          'slice': 'slices',
          'slices': 'slices',
          'whole': 'whole',
        };
        
        // Set the unit if it's recognized, otherwise keep default
        if (unitPart in unitMapping) {
          unit = unitMapping[unitPart];
        } else if (unitPart) {
          // If not in our mapping but not empty, use as is
          unit = unitPart;
        }
      }
      
      return { quantity, unit };
    } catch (error) {
      logger.error('Error parsing measurement:', error);
      return { quantity: 1, unit: 'whole' };
    }
  }

  /**
   * Migrate local pantry items to Firestore when a user signs in
   * @returns True if migration was successful
   */
  async migrateLocalPantryItemsToFirestore(): Promise<boolean> {
    try {
      if (!this.shouldUseFirestore()) {
        // Can't migrate if not authenticated
        return false;
      }
      
      // Get local pantry items
      const data = await AsyncStorage.getItem(PANTRY_ITEMS_KEY);
      if (!data) return true; // Nothing to migrate
      
      const localItems = JSON.parse(data) as PantryItemDocument[];
      let successCount = 0;
      
      // Add each item to Firestore
      for (const item of localItems) {
        const { id, createdAt, updatedAt, ...itemData } = item;
        
        const itemId = await this.addPantryItem(itemData);
        if (itemId) successCount++;
      }
      
      // Clear local storage if all items were migrated
      if (successCount === localItems.length) {
        await AsyncStorage.removeItem(PANTRY_ITEMS_KEY);
        logger.debug('Successfully migrated pantry items to Firestore');
        return true;
      }
      
      logger.debug(`Partially migrated pantry items: ${successCount}/${localItems.length}`);
      return false;
    } catch (error) {
      logger.error('Error migrating pantry items to Firestore:', error);
      return false;
    }
  }
}

// Export singleton instance
export const pantryService = new PantryService(); 