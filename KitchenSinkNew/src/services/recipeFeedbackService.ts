import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Recipe } from '../types/Recipe';

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

class RecipeFeedbackService {
  private collection = 'recipe_feedback';
  private db = firestore();
  private initialized = false;

  /**
   * Initialize the feedback collection if it doesn't exist
   */
  private async ensureCollectionExists(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Check if the collection exists by trying to get a document from it
      const testQuery = await this.db.collection(this.collection).limit(1).get();
      
      // If we get here without error, the collection exists
      this.initialized = true;
    } catch (error) {
      console.log('Need to initialize collection:', error);
      
      // Try to create a placeholder document to initialize the collection
      try {
        const user = auth().currentUser;
        if (!user) throw new Error('No authenticated user found');
        
        // Create a placeholder document in the collection
        await this.db.collection(this.collection).doc('_placeholder').set({
          created: firestore.FieldValue.serverTimestamp(),
          createdBy: user.uid
        });
        
        this.initialized = true;
      } catch (initError) {
        console.error('Failed to initialize collection:', initError);
        throw initError;
      }
    }
  }

  /**
   * Save feedback for a recipe
   */
  async saveFeedback(
    recipeId: string,
    feedback: Omit<RecipeFeedback, 'recipeId' | 'userId' | 'feedbackDate'>
  ): Promise<boolean> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        console.error('No authenticated user found');
        return false;
      }

      // Ensure collection exists
      await this.ensureCollectionExists();

      const feedbackData: RecipeFeedback = {
        ...feedback,
        recipeId,
        userId,
        feedbackDate: new Date(),
      };

      // Create a unique document ID using recipeId and userId
      const docId = `${recipeId}_${userId}`;

      await this.db
        .collection(this.collection)
        .doc(docId)
        .set(feedbackData, { merge: true });

      return true;
    } catch (error) {
      console.error('Error saving recipe feedback:', error);
      
      // If we get a permission-denied error, try to log the details to help debugging
      if (error instanceof Error && error.message.includes('permission-denied')) {
        const userId = auth().currentUser?.uid;
        console.error(`Permission denied for user ${userId} writing to ${this.collection}`);
      }
      
      return false;
    }
  }

  /**
   * Get feedback for a specific recipe
   */
  async getFeedback(recipeId: string): Promise<RecipeFeedback | null> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        console.error('No authenticated user found');
        return null;
      }

      // Ensure collection exists
      await this.ensureCollectionExists();

      const docId = `${recipeId}_${userId}`;
      const doc = await this.db
        .collection(this.collection)
        .doc(docId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as RecipeFeedback;
    } catch (error) {
      console.error('Error getting recipe feedback:', error);
      return null;
    }
  }

  /**
   * Get aggregated feedback for a recipe (for meal generation algorithm)
   */
  async getAggregatedFeedback(recipeId: string): Promise<{
    totalCooked: number;
    averageRating: number;
    totalLikes: number;
    totalDislikes: number;
  }> {
    try {
      // Ensure collection exists
      await this.ensureCollectionExists();
      
      const snapshot = await this.db
        .collection(this.collection)
        .where('recipeId', '==', recipeId)
        .get();

      const feedbacks = snapshot.docs.map(doc => doc.data() as RecipeFeedback);
      
      return {
        totalCooked: feedbacks.filter(f => f.isCooked).length,
        averageRating: feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length || 0,
        totalLikes: feedbacks.filter(f => f.isLiked).length,
        totalDislikes: feedbacks.filter(f => f.isDisliked).length,
      };
    } catch (error) {
      console.error('Error getting aggregated feedback:', error);
      return {
        totalCooked: 0,
        averageRating: 0,
        totalLikes: 0,
        totalDislikes: 0,
      };
    }
  }

  /**
   * Get user's feedback history
   */
  async getUserFeedbackHistory(limit: number = 50): Promise<RecipeFeedback[]> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        console.error('No authenticated user found');
        return [];
      }

      // Ensure collection exists
      await this.ensureCollectionExists();

      const snapshot = await this.db
        .collection(this.collection)
        .where('userId', '==', userId)
        .orderBy('feedbackDate', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as RecipeFeedback);
    } catch (error) {
      console.error('Error getting user feedback history:', error);
      return [];
    }
  }
}

export const recipeFeedbackService = new RecipeFeedbackService(); 