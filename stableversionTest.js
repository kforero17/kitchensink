/**
 * Stable Version Firebase Test
 * 
 * This test uses a specific version of Firebase (9.18.0) which is known to be stable
 * for Firestore operations.
 */

// Import Firebase modules - using specific versions imported by our npm command
const firebase = require('firebase/app');
const firestore = require('firebase/firestore');

// Firebase configuration directly from the Firebase console
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

// Output Firebase version
console.log(`Firebase SDK Version: ${firebase.SDK_VERSION}`);

async function runStableVersionTest() {
  try {
    console.log('\nInitializing Firebase with stable version...');
    // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    
    // Get Firestore instance
    const db = firestore.getFirestore(app);
    
    // Try to read from Firestore
    console.log('\nTesting read operation...');
    try {
      const querySnapshot = await firestore.getDocs(firestore.collection(db, 'test_collection'));
      console.log(`✅ Successfully read ${querySnapshot.size} documents`);
      
      if (querySnapshot.size > 0) {
        console.log('Documents found:');
        querySnapshot.forEach(doc => {
          console.log(`- ${doc.id}: ${JSON.stringify(doc.data())}`);
        });
      } else {
        console.log('No documents found in the collection.');
      }
    } catch (readError) {
      console.error('❌ Read operation failed:');
      console.error('Code:', readError.code);
      console.error('Message:', readError.message);
    }
    
    // Now try to write a document with a basic structure
    console.log('\nTesting write operation with basic document...');
    
    try {
      // Create a very simple document
      const docData = {
        test: true,
        createdAt: new Date().toISOString()
      };
      
      console.log('Writing data:', docData);
      
      const docRef = await firestore.addDoc(firestore.collection(db, 'test_collection'), docData);
      console.log(`✅ Document successfully written with ID: ${docRef.id}`);
    } catch (writeError) {
      console.error('❌ Write operation failed:');
      console.error('Code:', writeError.code);
      console.error('Message:', writeError.message);
      
      if (writeError.code === 'permission-denied') {
        console.log('\nThis is a security rules issue. Please update your Firestore rules in the Firebase Console to:');
        console.log('rules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}');
      }
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
runStableVersionTest(); 