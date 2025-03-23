/**
 * Firebase Admin Service
 * 
 * This module provides access to Firestore using the Firebase Admin SDK,
 * which bypasses security rules and provides more reliable database access.
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin only once
let firebaseApp = null;
let firestoreDb = null;

/**
 * Initialize the Firebase Admin SDK
 */
function initializeFirebaseAdmin() {
  if (firebaseApp) {
    return { app: firebaseApp, db: firestoreDb };
  }

  try {
    // Get the absolute path to the service account file
    const serviceAccountPath = path.join(__dirname, '../../service-account.json');
    const serviceAccount = require(serviceAccountPath);
    
    // Initialize with the specific database ID that worked
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseId: '(default)'
    });
    
    // Get Firestore reference
    firestoreDb = admin.firestore(firebaseApp);
    
    console.log('Firebase Admin SDK initialized successfully');
    return { app: firebaseApp, db: firestoreDb };
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
}

/**
 * Firebase Admin Service Class
 * 
 * Provides a clean API for interacting with Firestore
 */
class FirebaseAdminService {
  constructor() {
    const { db } = initializeFirebaseAdmin();
    this.db = db;
  }

  /**
   * Create a document in a collection
   * 
   * @param {string} collection - Collection name
   * @param {object} data - Document data
   * @returns {Promise<string>} - Document ID
   */
  async createDocument(collection, data) {
    try {
      const docRef = await this.db.collection(collection).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error(`Error creating document in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Get a document by ID
   * 
   * @param {string} collection - Collection name
   * @param {string} id - Document ID
   * @returns {Promise<object|null>} - Document data or null if not found
   */
  async getDocument(collection, id) {
    try {
      const docRef = this.db.collection(collection).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`Error getting document ${id} from ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Get all documents in a collection
   * 
   * @param {string} collection - Collection name
   * @param {object} options - Options for filtering and sorting
   * @returns {Promise<Array<object>>} - Array of documents
   */
  async getAllDocuments(collection, options = {}) {
    try {
      let query = this.db.collection(collection);

      // Apply filters
      if (options.where) {
        for (const filter of options.where) {
          query = query.where(filter.field, filter.operator, filter.value);
        }
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`Error getting documents from ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Update a document
   * 
   * @param {string} collection - Collection name
   * @param {string} id - Document ID
   * @param {object} data - Document data to update
   * @returns {Promise<void>}
   */
  async updateDocument(collection, id, data) {
    try {
      const docRef = this.db.collection(collection).doc(id);
      await docRef.update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error(`Error updating document ${id} in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   * 
   * @param {string} collection - Collection name
   * @param {string} id - Document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(collection, id) {
    try {
      const docRef = this.db.collection(collection).doc(id);
      await docRef.delete();
    } catch (error) {
      console.error(`Error deleting document ${id} from ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Perform a batch write operation
   * 
   * @param {Array<object>} operations - Array of operations to perform
   * @returns {Promise<void>}
   */
  async batchOperation(operations) {
    try {
      const batch = this.db.batch();

      operations.forEach(op => {
        const docRef = op.id 
          ? this.db.collection(op.collection).doc(op.id)
          : this.db.collection(op.collection).doc();

        if (op.type === 'set') {
          batch.set(docRef, {
            ...op.data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else if (op.type === 'update') {
          batch.update(docRef, {
            ...op.data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else if (op.type === 'delete') {
          batch.delete(docRef);
        }
      });

      await batch.commit();
    } catch (error) {
      console.error('Error performing batch operation:', error);
      throw error;
    }
  }
}

// Export singleton instance
const firebaseAdminService = new FirebaseAdminService();
module.exports = firebaseAdminService; 