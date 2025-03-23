/**
 * Fresh Firestore Test - No Emulators
 * 
 * This test checks for and warns about any emulator environment variables
 * and ensures a direct connection to the production Firestore.
 */

// Check for any emulator environment variables first
console.log('Checking for emulator environment variables...');
const emulatorEnvVars = [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_FIRESTORE_EMULATOR_ADDRESS',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_DATABASE_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
  'FIREBASE_FUNCTIONS_EMULATOR_HOST',
  'FIREBASE_EMULATOR_HUB',
  'FIREBASE_EMULATOR_REST_HOST'
];

let emulatorEnvFound = false;
emulatorEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.error(`⚠️ EMULATOR DETECTED: ${envVar}=${process.env[envVar]}`);
    emulatorEnvFound = true;
  }
});

if (emulatorEnvFound) {
  console.error('⚠️ Firebase emulator environment variables found!');
  console.error('⚠️ This may cause connection issues with the production Firestore.');
  console.error('⚠️ Run this test in a fresh terminal window or unset these variables.');
} else {
  console.log('✅ No emulator environment variables detected.');
}

// Import Firebase modules
const { initializeApp, deleteApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
  enableIndexedDbPersistence,
  clearIndexedDbPersistence
} = require('firebase/firestore');

// Firebase configuration directly from the Firebase console
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

async function runFreshTest() {
  let app;
  
  try {
    console.log('\nInitializing fresh Firebase connection...');
    // Create a new Firebase app with a unique name to avoid cached connections
    const uniqueAppName = `firestore-test-${Date.now()}`;
    app = initializeApp(firebaseConfig, uniqueAppName);
    
    // Get Firestore instance
    const db = getFirestore(app);
    
    // Force enable network to ensure we're not in offline mode
    console.log('Ensuring network is enabled...');
    await enableNetwork(db);
    
    // Test if we can read from Firestore
    console.log('\nTesting read operation...');
    try {
      const querySnapshot = await getDocs(collection(db, 'test_collection'));
      console.log(`✅ Successfully read ${querySnapshot.size} documents`);
      
      querySnapshot.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(`Document data: ${JSON.stringify(doc.data())}`);
      });
    } catch (readError) {
      console.error('❌ Read operation failed:');
      console.error(`- Error code: ${readError.code}`);
      console.error(`- Error message: ${readError.message}`);
    }
    
    // Now try to write a document
    console.log('\nTesting write operation...');
    try {
      const docData = {
        message: 'Test document with fresh connection',
        timestamp: new Date().toISOString(),
        test_id: `test-${Date.now()}`
      };
      
      console.log(`Writing data: ${JSON.stringify(docData)}`);
      
      const docRef = await addDoc(collection(db, 'test_collection'), docData);
      console.log(`✅ Document successfully written with ID: ${docRef.id}`);
    } catch (writeError) {
      console.error('❌ Write operation failed:');
      console.error(`- Error code: ${writeError.code}`);
      console.error(`- Error message: ${writeError.message}`);
      console.error(`- Error stack: ${writeError.stack}`);
      
      if (writeError.code === 'permission-denied') {
        console.log('\n⚠️ Security rules are preventing write access.');
        console.log('⚠️ Update your Firestore security rules to:');
        console.log('rules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}');
      } else if (writeError.code === 'not-found') {
        console.log('\n⚠️ Collection or project not found. Check your project ID and database setup.');
        console.log('⚠️ Make sure you have created a Firestore database in the Firebase console.');
      } else if (writeError.message.includes('network')) {
        console.log('\n⚠️ Network error. Check your internet connection.');
      }
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    // Clean up: delete the app instance
    if (app) {
      console.log('\nCleaning up Firebase app instance...');
      await deleteApp(app);
    }
  }
}

// Run the test
runFreshTest(); 