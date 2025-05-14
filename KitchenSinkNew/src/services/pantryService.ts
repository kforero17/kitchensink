import { firestoreService } from './firebaseService';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { 
  FIRESTORE_PATHS
} from '../types/FirestoreSchema';
import { PantryItem } from '../types/PantryItem';
import logger from '../utils/logger';

export const getPantryItems = async (uid: string): Promise<PantryItem[]> => {
  try {
    const snapshot = await firestore()
      .collection(FIRESTORE_PATHS.USERS)
      .doc(uid)
      .collection(FIRESTORE_PATHS.PANTRY_ITEMS)
      .get();

    const items: PantryItem[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: typeof data.name === 'string' ? data.name : 'Unknown Item',
        quantity: typeof data.quantity === 'number' ? data.quantity : 0,
        unit: typeof data.unit === 'string' ? data.unit : 'units',
        category: typeof data.category === 'string' ? data.category : 'Other',
      };
    });
    return items;

  } catch (error) {
    console.error('Error fetching pantry items:', error);
    return [];
  }
};

export const addPantryItem = async (uid: string, item: Omit<PantryItem, 'id'>): Promise<string | null> => {
  try {
    const docRef = await firestore()
      .collection(FIRESTORE_PATHS.USERS)
      .doc(uid)
      .collection(FIRESTORE_PATHS.PANTRY_ITEMS)
      .add(item);
            
            return docRef.id;
    } catch (error) {
    console.error('Error adding pantry item:', error);
      return null;
  }
};

export const deletePantryItem = async (uid: string, itemId: string): Promise<boolean> => {
  try {
    await firestore()
      .collection(FIRESTORE_PATHS.USERS)
      .doc(uid)
      .collection(FIRESTORE_PATHS.PANTRY_ITEMS)
      .doc(itemId)
      .delete();
    
    return true;
    } catch (error) {
    console.error('Error deleting pantry item:', error);
    return false;
  }
};

export const updatePantryItem = async (
  uid: string, 
  itemId: string, 
  itemData: Partial<Omit<PantryItem, 'id'>>
): Promise<boolean> => {
  if (!uid || !itemId || !itemData) {
    logger.error('[pantryService] Error updating pantry item: Missing uid, itemId, or itemData');
    return false;
  }
  try {
    await firestore()
      .collection(FIRESTORE_PATHS.USERS)
      .doc(uid)
      .collection(FIRESTORE_PATHS.PANTRY_ITEMS)
      .doc(itemId)
      .update(itemData);
    
    logger.debug(`[pantryService] Successfully updated pantry item: ${itemId} for user: ${uid}`);
    return true;
  } catch (error) {
    logger.error(`[pantryService] Error updating pantry item ${itemId} for user ${uid}:`, error);
    return false;
  }
};

export const isIngredientInPantryFirestore = async (uid: string, ingredientName: string): Promise<boolean> => {
  if (!uid || !ingredientName) {
      return false;
  }

  try {
    const normalizedSearchName = ingredientName.toLowerCase().trim();
    if (!normalizedSearchName) {
      return false;
    }

    const pantryItems = await getPantryItems(uid);

    return pantryItems.some(item => {
      const normalizedItemName = item.name.toLowerCase().trim();
      return (
        normalizedItemName.includes(normalizedSearchName) ||
        normalizedSearchName.includes(normalizedItemName)
      );
    });
    } catch (error) {
    console.error('Error checking ingredient in pantry (Firestore):', error);
    return false;
  }
};

export const addGroceryItemsToPantryFirestore = async (
  uid: string,
  groceryItems: Array<{ name: string; measurement: string; category: string }>
): Promise<number> => {
  if (!uid || !groceryItems || groceryItems.length === 0) {
    return 0;
  }

  let successCount = 0;
  const pantryRef = firestore().collection(FIRESTORE_PATHS.USERS).doc(uid).collection(FIRESTORE_PATHS.PANTRY_ITEMS);

  try {
    const existingPantryItems = await getPantryItems(uid);
    const pantryMap = new Map(existingPantryItems.map(item => [
      `${item.name.toLowerCase()}_${item.unit.toLowerCase()}`,
      item
    ]));

    const writeBatch = firestore().batch();

      for (const groceryItem of groceryItems) {
      const measurementParts = groceryItem.measurement.trim().split(' ');
      const quantity = parseFloat(measurementParts[0]) || 1;
      const unit = measurementParts.length > 1 ? measurementParts.slice(1).join(' ') : 'units';

      const itemKey = `${groceryItem.name.toLowerCase()}_${unit.toLowerCase()}`;
      const existingItem = pantryMap.get(itemKey);
        
        if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        const docRef = pantryRef.doc(existingItem.id);
        writeBatch.update(docRef, { quantity: newQuantity });
        successCount++;
        } else {
        const newItemData = {
            name: groceryItem.name,
          quantity: quantity,
          unit: unit,
        };
        writeBatch.set(pantryRef.doc(), newItemData);
        successCount++;
      }
    }

    await writeBatch.commit();
    console.log(`Successfully added/updated ${successCount} items to pantry via batch.`);

    } catch (error) {
    console.error('Error adding grocery items to pantry (Firestore):', error);
    return 0;
  }

  return successCount;
}; 