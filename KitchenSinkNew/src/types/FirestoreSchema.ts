import { DietaryPreferences } from './DietaryPreferences';
import { FoodPreferences } from './FoodPreferences';
import { CookingPreferences } from './CookingPreferences';
import { BudgetPreferences } from './BudgetPreferences';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

/**
 * Defines the shape of our Firestore database
 * This follows the structure:
 * 
 * users (collection)
 *   └── userId (document)
 *        ├── preferences (map)
 *        ├── groceryLists (collection)
 *        │     ├── listId (document)
 *        │     │     └── items: [array]
 *        ├── pantryItems (collection)
 *        │     ├── itemId (document)
 *        │     │     ├── name: string
 *        │     │     ├── quantity: number
 *        │     │     ├── unit: string
 *        │     │     ├── category: string
 *        │     │     ├── expirationDate: timestamp
 *        │     │     └── notes: string
 *        └── recipes (collection)
 *              ├── recipeId (document)
 *              │     ├── name: string
 *              │     ├── ingredients: [array]
 *              │     └── instructions: string
 */

// Base user preferences document
export interface UserPreferences {
  dietary: DietaryPreferences;
  food: FoodPreferences;
  cooking: CookingPreferences;
  budget: BudgetPreferences;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

// User document in Firestore
export interface UserDocument {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  preferences: UserPreferences;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

// GroceryList item type
export interface GroceryItem {
  name: string;
  measurement: string;
  category: string;
  recipeId?: string;
  recipeName?: string;
  recommendedPackage?: string;
  isChecked?: boolean;
  note?: string;
}

// GroceryList document in Firestore
export interface GroceryListDocument {
  id: string;
  name: string;
  items: GroceryItem[];
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

// Unit of measurement for pantry items
export type MeasurementUnit = 
  | 'grams'
  | 'kilograms'
  | 'ounces'
  | 'pounds'
  | 'milliliters'
  | 'liters'
  | 'teaspoons'
  | 'tablespoons'
  | 'cups'
  | 'pieces'
  | 'slices'
  | 'whole' 
  | 'package'
  | 'can'
  | 'bottle'
  | 'box'
  | 'bag'
  | 'bunch'
  | 'other';

// Status of pantry item (for tracking freshness)
export type ItemStatus = 
  | 'fresh'    // Recently added, far from expiration
  | 'normal'   // Normal state
  | 'expiring' // Getting close to expiration (within 7 days)
  | 'expired'  // Past expiration date
  | 'low';     // Quantity is low

// Pantry item document
export interface PantryItemDocument {
  id: string;
  name: string;
  quantity: number;
  unit: MeasurementUnit;
  category: string;
  location?: string;         // Where in the kitchen it's stored
  expirationDate?: FirebaseFirestoreTypes.Timestamp;
  purchaseDate?: FirebaseFirestoreTypes.Timestamp;
  status?: ItemStatus;
  notes?: string;
  barcode?: string;          // For scanning products
  brand?: string;            // Brand name if applicable
  nutritionInfo?: {          // Optional nutrition information
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  isStaple?: boolean;        // Whether it's a staple item to keep stocked
  reorderThreshold?: number; // Quantity to trigger reorder/shopping list addition
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

// Recipe ingredient type
export interface RecipeIngredient {
  name: string;
  amount: number;
  unit: string;
  originalString: string;
}

// Recipe step type
export interface RecipeStep {
  number: number;
  instruction: string;
}

// Recipe document in Firestore
export interface RecipeDocument {
  id: string;
  name: string;
  imageUrl?: string;
  servings: number;
  readyInMinutes: number;
  ingredients: RecipeIngredient[];
  instructions: RecipeStep[];
  cuisines?: string[];
  diets?: string[];
  dishTypes?: string[];
  summary?: string;
  sourceUrl?: string;
  isFavorite: boolean;
  isWeeklyMealPlan: boolean; // Flag to identify recipes that are part of the weekly meal plan
  tags: string[];
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

// Paths to collections and documents in Firestore
export const FIRESTORE_PATHS = {
  USERS: 'users',
  GROCERY_LISTS: 'groceryLists',
  RECIPES: 'recipes',
  PANTRY_ITEMS: 'pantryItems',
  APP_SETTINGS: 'appSettings',
}; 