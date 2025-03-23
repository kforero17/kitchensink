/**
 * Firebase Admin SDK Implementation
 * 
 * This provides an example of how to integrate the Firebase Admin SDK
 * into your application.
 */

const admin = require('firebase-admin');
const path = require('path');

// Import service account
// Note: In a production environment, consider using environment variables
// for sensitive information instead of a file path
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get Firestore instance
const db = admin.firestore();

/**
 * Firestore Service Class
 * 
 * This class provides an abstraction over Firestore operations
 * to make them easy to use in your application.
 */
class FirestoreService {
  /**
   * Create a new document in a collection
   * 
   * @param {string} collection Collection name
   * @param {object} data Document data
   * @returns {Promise<string>} Document ID
   */
  async createDocument(collection, data) {
    try {
      // Add a timestamp
      const docData = {
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection(collection).add(docData);
      console.log(`Document created with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }
  
  /**
   * Get a document by ID
   * 
   * @param {string} collection Collection name
   * @param {string} id Document ID
   * @returns {Promise<object|null>} Document data or null if not found
   */
  async getDocument(collection, id) {
    try {
      const docRef = await db.collection(collection).doc(id).get();
      
      if (!docRef.exists) {
        console.log(`Document ${id} not found in ${collection}`);
        return null;
      }
      
      return { id: docRef.id, ...docRef.data() };
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }
  
  /**
   * Get all documents in a collection
   * 
   * @param {string} collection Collection name
   * @param {object} options Options for filtering and ordering
   * @returns {Promise<Array>} Array of documents
   */
  async getAllDocuments(collection, options = {}) {
    try {
      let query = db.collection(collection);
      
      // Apply filters if provided
      if (options.where) {
        options.where.forEach(({ field, operator, value }) => {
          query = query.where(field, operator, value);
        });
      }
      
      // Apply ordering if provided
      if (options.orderBy) {
        const { field, direction = 'asc' } = options.orderBy;
        query = query.orderBy(field, direction);
      }
      
      // Apply limit if provided
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }
  
  /**
   * Update a document
   * 
   * @param {string} collection Collection name
   * @param {string} id Document ID
   * @param {object} data Data to update
   * @returns {Promise<void>}
   */
  async updateDocument(collection, id, data) {
    try {
      // Add updated timestamp
      const updateData = {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection(collection).doc(id).update(updateData);
      console.log(`Document ${id} updated successfully`);
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }
  
  /**
   * Delete a document
   * 
   * @param {string} collection Collection name
   * @param {string} id Document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(collection, id) {
    try {
      await db.collection(collection).doc(id).delete();
      console.log(`Document ${id} deleted successfully`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
  
  /**
   * Batch write multiple documents
   * 
   * @param {Array} operations Array of operations (create, update, delete)
   * @returns {Promise<void>}
   */
  async batchOperation(operations) {
    try {
      const batch = db.batch();
      
      operations.forEach(op => {
        const docRef = db.collection(op.collection).doc(op.id || db.collection(op.collection).doc().id);
        
        if (op.type === 'create') {
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
      console.log(`Batch operation completed successfully`);
    } catch (error) {
      console.error('Error in batch operation:', error);
      throw error;
    }
  }
}

// Export the FirestoreService
module.exports = {
  db,
  admin,
  FirestoreService: new FirestoreService()
};

// If this file is run directly, run a sample test
if (require.main === module) {
  const firestoreService = new FirestoreService();
  
  async function runTest() {
    try {
      // Create a test document
      const docId = await firestoreService.createDocument('test_collection', {
        name: 'Test Document',
        description: 'Created by Admin SDK',
        isTest: true
      });
      
      // Get the document back
      const doc = await firestoreService.getDocument('test_collection', docId);
      console.log('Retrieved document:', doc);
      
      // Update the document
      await firestoreService.updateDocument('test_collection', docId, {
        updated: true,
        description: 'Updated by Admin SDK'
      });
      
      // Get all documents
      const allDocs = await firestoreService.getAllDocuments('test_collection', {
        where: [{ field: 'isTest', operator: '==', value: true }],
        orderBy: { field: 'createdAt', direction: 'desc' }
      });
      
      console.log(`Found ${allDocs.length} test documents`);
      
      // Delete the document (comment out if you want to keep it)
      // await firestoreService.deleteDocument('test_collection', docId);
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
  
  runTest();
} 