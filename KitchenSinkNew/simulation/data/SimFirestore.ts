import * as admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Local type definitions
// ---------------------------------------------------------------------------
// Mirrors of the app's canonical types, defined locally so that the simulation
// module compiles independently (no rootDir / RN dependency issues).
// These will be imported from bridge/appImports.ts once it exists.
// ---------------------------------------------------------------------------

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  original?: string;
}

export interface MacroBreakdown {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface UnifiedRecipe {
  id: string;
  source: 'tasty' | 'spoonacular';
  title: string;
  imageUrl: string;
  readyInMinutes: number;
  servings: number;
  ingredients: Ingredient[];
  tags: string[];
  instructions?: string[];
  nutrition?: MacroBreakdown;
  popularityScore?: number;
}

export type PantryItemStatus = 'fresh' | 'normal' | 'expiring' | 'expired';

export type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expirationDate?: string;
  status?: PantryItemStatus;
};

export interface Leftover {
  id: string;
  recipeId: string;
  recipeName: string;
  originalServings: number;
  remainingServings: number;
  cookedDate: string;
  estimatedExpiryDate: string;
  mealType: string;
  status: 'available' | 'used' | 'expired';
}

export interface UserPreferences {
  dietary: any;
  food: any;
  cooking: any;
  budget: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface RecipeFeedback {
  recipeId: string;
  userId: string;
  isCooked: boolean;
  isLiked: boolean;
  isDisliked: boolean;
  rating: number;
  feedbackDate: Date;
  mealType?: string;
}

export interface RecipeHistoryItem {
  recipeId: string;
  usedDate: string;
  mealType: string;
}

export class SimFirestore {
  private db: admin.firestore.Firestore;
  private recipeCache: UnifiedRecipe[] | null = null;

  constructor(app: admin.app.App) {
    this.db = app.firestore();
  }

  // --- Recipes (global, cached after first load) ---
  async getAllRecipes(): Promise<UnifiedRecipe[]> {
    if (this.recipeCache) return this.recipeCache;
    const snapshot = await this.db.collection('recipes').get();
    this.recipeCache = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as UnifiedRecipe));
    return this.recipeCache;
  }

  async getRecipeById(id: string): Promise<UnifiedRecipe | null> {
    const recipes = await this.getAllRecipes();
    return recipes.find(r => r.id === id) ?? null;
  }

  async getRecipesByTags(tags: string[]): Promise<UnifiedRecipe[]> {
    const recipes = await this.getAllRecipes();
    return recipes.filter(r =>
      tags.every(tag => r.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
    );
  }

  // --- User Preferences ---
  async setPreferences(uid: string, prefs: UserPreferences): Promise<void> {
    await this.db.doc(`users/${uid}/preferences/main`).set(prefs);
  }

  async getPreferences(uid: string): Promise<UserPreferences> {
    const doc = await this.db.doc(`users/${uid}/preferences/main`).get();
    return doc.data() as UserPreferences;
  }

  // --- Pantry ---
  async addPantryItem(uid: string, item: Omit<PantryItem, 'id'>): Promise<string> {
    const ref = await this.db.collection(`users/${uid}/pantryItems`).add({
      ...item,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async getPantryItems(uid: string): Promise<PantryItem[]> {
    const snapshot = await this.db.collection(`users/${uid}/pantryItems`).get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PantryItem));
  }

  async updatePantryItem(uid: string, id: string, update: Partial<PantryItem>): Promise<void> {
    await this.db.doc(`users/${uid}/pantryItems/${id}`).update(update);
  }

  async removePantryItem(uid: string, id: string): Promise<void> {
    await this.db.doc(`users/${uid}/pantryItems/${id}`).delete();
  }

  // --- Leftovers ---
  async addLeftover(uid: string, leftover: Omit<Leftover, 'id'>): Promise<string> {
    const ref = await this.db.collection(`users/${uid}/leftovers`).add({
      ...leftover,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async getLeftovers(uid: string): Promise<Leftover[]> {
    const snapshot = await this.db.collection(`users/${uid}/leftovers`).get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Leftover));
  }

  async updateLeftover(uid: string, id: string, update: Partial<Leftover>): Promise<void> {
    await this.db.doc(`users/${uid}/leftovers/${id}`).update(update);
  }

  // --- Feedback ---
  async saveFeedback(recipeId: string, uid: string, fb: RecipeFeedback): Promise<void> {
    const docId = `${uid}_${recipeId}`;
    await this.db.collection('recipe_feedback').doc(docId).set({
      ...fb,
      feedbackDate: fb.feedbackDate.toISOString(),
    });
  }

  async getUserFeedback(uid: string): Promise<RecipeFeedback[]> {
    const snapshot = await this.db.collection('recipe_feedback')
      .where('userId', '==', uid).get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { ...data, feedbackDate: new Date(data.feedbackDate) } as RecipeFeedback;
    });
  }

  // --- Saved Recipes (user's meal plan recipes) ---
  async saveRecipe(uid: string, recipe: any): Promise<string> {
    const ref = await this.db.collection(`users/${uid}/recipes`).add({
      ...recipe,
      savedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async getUserRecipes(uid: string): Promise<any[]> {
    const snapshot = await this.db.collection(`users/${uid}/recipes`).get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  }

  async resetWeeklyMealPlanFlags(uid: string): Promise<void> {
    const snapshot = await this.db.collection(`users/${uid}/recipes`)
      .where('isWeeklyMealPlan', '==', true).get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isWeeklyMealPlan: false });
    });
    await batch.commit();
  }

  // --- Grocery Lists ---
  async saveGroceryList(uid: string, list: any): Promise<string> {
    const ref = await this.db.collection(`users/${uid}/groceryLists`).add({
      ...list,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  // --- Weekly Rankings ---
  async saveWeeklyRanking(weekOf: string, data: any): Promise<void> {
    await this.db.collection('weekly_rankings').doc(weekOf).set(data);
  }

  // --- Recipe History (replaces AsyncStorage in simulation) ---
  async addHistoryItem(uid: string, item: RecipeHistoryItem): Promise<void> {
    await this.db.collection(`users/${uid}/history`).add(item);
  }

  async getHistory(uid: string): Promise<RecipeHistoryItem[]> {
    const snapshot = await this.db.collection(`users/${uid}/history`).get();
    return snapshot.docs.map(doc => doc.data() as RecipeHistoryItem);
  }

  // --- Utility ---
  async clearUserData(uid: string): Promise<void> {
    const subcollections = ['preferences', 'pantryItems', 'leftovers', 'recipes', 'groceryLists', 'history'];
    for (const sub of subcollections) {
      const snapshot = await this.db.collection(`users/${uid}/${sub}`).get();
      const batch = this.db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    // Also delete user's feedback from top-level collection
    const feedbackSnapshot = await this.db.collection('recipe_feedback')
      .where('userId', '==', uid).get();
    if (!feedbackSnapshot.empty) {
      const batch = this.db.batch();
      feedbackSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }
}
