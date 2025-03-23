/**
 * This script demonstrates how to properly initialize Firestore
 * to avoid the "NOT_FOUND" error.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

// Firebase configuration from your app
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Important: Initialize Firestore with the correct database ID format
// For Firebase 9.18.0, the database ID is passed directly, not as an option object
const db = getFirestore(app, '(default)');  // Pass the database ID directly

// Write a document to Firestore
async function writeToFirestore() {
  try {
    // Test document
    const docData = {
      message: 'Successfully wrote to Firestore with correct database ID',
      timestamp: new Date().toISOString()
    };
    
    console.log('Attempting to write document to Firestore...');
    const docRef = await addDoc(collection(db, 'test_collection'), docData);
    
    console.log('✅ SUCCESS! Document written with ID:', docRef.id);
    console.log('\nHow to fix your app:');
    console.log('1. Make sure you initialize Firestore with the correct database ID FORMAT');
    console.log('2. Use the following code in your app:');
    console.log('   const db = getFirestore(app, \'(default)\');');  // Note the correct format
    console.log('3. Check security rules in Firebase Console if this solution works');
  } catch (error) {
    console.error('❌ Error writing document:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Provide specific solutions based on error
    if (error.code === 'permission-denied') {
      console.log('\n🔒 This is a security rules issue:');
      console.log('1. Go to Firebase Console > Firestore Database > Rules');
      console.log('2. Update rules to:');
      console.log('rules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}');
    } else if (error.code === 'not-found') {
      console.log('\n🔍 Database or collection not found:');
      console.log('1. Verify your database exists in Firebase Console');
      console.log('2. Try creating test_collection manually in the console');
      console.log('3. Consider recreating your database with the default name');
    }

    // Try different database IDs
    const otherIdsToTry = ['kitchensink', 'default', 'prod', 'firestore'];
    console.log('\nConsider trying these other database IDs:');
    otherIdsToTry.forEach(id => {
      console.log(`const db = getFirestore(app, '${id}');`);
    });
  }
}

// Run the test
writeToFirestore(); 