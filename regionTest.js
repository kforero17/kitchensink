const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, connectFirestoreEmulator } = require('firebase/firestore');

// Define Firebase configuration
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

// Try with explicit region (try different regions if this doesn't work)
const db = getFirestore(app);

// Try connecting to the emulator (if you're running one locally)
// Comment this out if you're not using an emulator
// connectFirestoreEmulator(db, 'localhost', 8080);

console.log('Firebase initialized. Attempting to write to Firestore...');

// Add a document with additional error information
async function testWrite() {
  try {
    console.log('Adding document...');
    
    // Add a document with an auto-generated ID
    const docData = {
      message: 'Test document with timestamp',
      createdAt: new Date().toISOString(),
      testNumber: Math.floor(Math.random() * 1000)
    };
    
    console.log('Document data:', docData);
    
    const docRef = await addDoc(collection(db, 'test_collection'), docData);
    
    console.log('Document written successfully with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('Error adding document:');
    console.error('- Code:', error.code);
    console.error('- Message:', error.message);
    
    if (error.stack) {
      console.error('- Stack trace:', error.stack);
    }
    
    console.log('\nRecommendations:');
    if (error.code === 'permission-denied') {
      console.log('⚠️ Security rules are preventing write access. Update your Firestore rules.');
    } else if (error.code === 'not-found') {
      console.log('⚠️ Collection or project not found. Check your project ID and database setup.');
      console.log('⚠️ If you just created the database, it might still be initializing.');
      console.log('⚠️ This can also happen if your database is in a different region.');
    } else if (error.message.includes('network')) {
      console.log('⚠️ Network error. Check your internet connection.');
    }
    
    return false;
  }
}

// Run the test
testWrite(); 