/**
 * React Native Implementation Guide for Firebase Admin SDK
 * 
 * IMPORTANT NOTE: The Firebase Admin SDK is designed for server-side usage!
 * 
 * For a React Native app, you have two options:
 * 1. Create a backend server/API that uses the Admin SDK
 * 2. Use Firebase Client SDK with authentication for your mobile app
 * 
 * This guide shows both approaches.
 */

// =====================================================================
// OPTION 1: Create a Backend API with Firebase Admin SDK
// =====================================================================

/**
 * This would be your server-side code (Node.js Express server)
 * NOT inside your React Native app.
 */

// server.js (Node.js Express server)
const express = require('express');
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const serverDb = admin.firestore();
const serverApp = express();
serverApp.use(express.json());

// API endpoint to get documents
serverApp.get('/api/documents/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const snapshot = await serverDb.collection(collection).get();
    
    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.status(200).json({ documents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to create a document
serverApp.post('/api/documents/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    const data = req.body;
    
    const docRef = await serverDb.collection(collection).add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(201).json({ id: docRef.id, message: 'Document created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to update a document
serverApp.put('/api/documents/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    const data = req.body;
    
    await serverDb.collection(collection).doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(200).json({ message: 'Document updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete a document
serverApp.delete('/api/documents/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;
    
    await serverDb.collection(collection).doc(id).delete();
    
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
serverApp.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// =====================================================================
// OPTION 2: React Native Firebase Client SDK with Authentication
// =====================================================================

/**
 * This would be your React Native app code (using Firebase client SDK)
 * This is the recommended approach for mobile apps.
 */

// Import Firebase modules in your React Native app
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const clientDb = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Firebase service class for React Native
class FirebaseService {
  // Authenticate user
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }
  
  // Create a document
  async createDocument(collectionName, data) {
    try {
      const docRef = await addDoc(collection(clientDb, collectionName), {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`Document created with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }
  
  // Get a document by ID
  async getDocument(collectionName, id) {
    try {
      const docRef = doc(clientDb, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        console.log(`Document ${id} not found in ${collectionName}`);
        return null;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }
  
  // Get all documents in a collection with optional filtering
  async getAllDocuments(collectionName, options = {}) {
    try {
      let q = collection(clientDb, collectionName);
      
      // Apply filters
      if (options.filters) {
        const { field, operator, value } = options.filters;
        q = query(q, where(field, operator, value));
      }
      
      // Apply ordering
      if (options.orderBy) {
        const { field, direction = 'asc' } = options.orderBy;
        q = query(q, orderBy(field, direction));
      }
      
      // Apply limit
      if (options.limit) {
        q = query(q, limit(options.limit));
      }
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }
  
  // Update a document
  async updateDocument(collectionName, id, data) {
    try {
      const docRef = doc(clientDb, collectionName, id);
      
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
      
      console.log(`Document ${id} updated successfully`);
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }
  
  // Delete a document
  async deleteDocument(collectionName, id) {
    try {
      const docRef = doc(clientDb, collectionName, id);
      await deleteDoc(docRef);
      
      console.log(`Document ${id} deleted successfully`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
}

export const firebaseService = new FirebaseService();

// =====================================================================
// Usage example in a React Native component:
// =====================================================================

import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { firebaseService } from './FirebaseService';

const FirestoreExample = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Load documents when component mounts
    loadDocuments();
  }, []);
  
  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Sign in first to authenticate
      await firebaseService.signIn('user@example.com', 'password123');
      
      // Then get documents
      const docs = await firebaseService.getAllDocuments('test_collection');
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const addDocument = async () => {
    try {
      const newDoc = {
        name: 'New Document',
        description: 'Created from React Native app',
        timestamp: new Date().toISOString()
      };
      
      await firebaseService.createDocument('test_collection', newDoc);
      loadDocuments(); // Reload documents
    } catch (error) {
      console.error('Error adding document:', error);
    }
  };
  
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        Firestore Documents
      </Text>
      
      <Button title="Add Document" onPress={addDocument} />
      
      {loading ? (
        <Text>Loading...</Text>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#ccc' }}>
              <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
              <Text>{item.description}</Text>
              <Text style={{ color: '#666' }}>ID: {item.id}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default FirestoreExample; 