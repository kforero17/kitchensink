/**
 * Firestore Database ID Test
 * 
 * This script tests connecting to Firestore with different database IDs,
 * which has been shown to solve the NOT_FOUND error in many cases.
 */

const { initializeApp, deleteApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  enableNetwork
} = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

// List of database IDs to try
// According to the issue, sometimes using '(default)' or other specific
// database IDs can resolve the NOT_FOUND error
const databaseIds = [
  undefined,  // Default with no ID specified
  '(default)',
  'default',
  'prod',
  'kitchensink',
  'kitchensink-c4872'
];

async function testWithDatabaseId(databaseId) {
  const appName = `app-${databaseId || 'no-db-id'}-${Date.now()}`;
  const app = initializeApp(firebaseConfig, appName);
  
  try {
    console.log(`\n===== Testing with databaseId: ${databaseId || 'Not specified'} =====`);
    
    // Get Firestore with the specific database ID
    // Note: In firebase@9.18.0 and newer, getFirestore accepts options object as second parameter
    // In older versions, databaseId was the first parameter
    
    let db;
    try {
      if (databaseId) {
        // Try newer method first (options object)
        db = getFirestore(app, { databaseId });
        console.log(`Initialized Firestore with options object { databaseId: '${databaseId}' }`);
      } else {
        db = getFirestore(app);
        console.log('Initialized Firestore with default options');
      }
    } catch (initError) {
      console.error(`Error initializing Firestore: ${initError.message}`);
      
      // Try alternative approach for older Firebase versions
      try {
        if (databaseId) {
          db = getFirestore(app, databaseId);
          console.log(`Initialized Firestore with direct databaseId parameter: '${databaseId}'`);
        } else {
          db = getFirestore(app);
          console.log('Initialized Firestore with default options (fallback)');
        }
      } catch (fallbackError) {
        console.error(`Error in fallback initialization: ${fallbackError.message}`);
        return false;
      }
    }
    
    // Enable network explicitly
    await enableNetwork(db);
    
    // Try a simple read operation first
    console.log('Testing read from test_collection...');
    try {
      const querySnapshot = await getDocs(collection(db, 'test_collection'));
      console.log(`✅ READ SUCCESS! Found ${querySnapshot.size} documents.`);
      
      // Try a simple write operation
      console.log('Testing write to test_collection...');
      try {
        const docData = {
          test: true,
          databaseId: databaseId || 'not_specified',
          timestamp: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, 'test_collection'), docData);
        console.log(`✅ WRITE SUCCESS! Document written with ID: ${docRef.id}`);
        return true;
      } catch (writeError) {
        console.error(`❌ Write failed: ${writeError.message}`);
        if (writeError.code === 'permission-denied') {
          console.log('This appears to be a security rules issue.');
        }
        return false;
      }
    } catch (readError) {
      console.error(`❌ Read failed: ${readError.message}`);
      return false;
    }
  } catch (error) {
    console.error(`Error during test: ${error.message}`);
    return false;
  } finally {
    // Clean up
    try {
      await deleteApp(app);
    } catch (cleanupError) {
      console.error(`Error during cleanup: ${cleanupError.message}`);
    }
  }
}

// Run tests for all database IDs
async function runAllTests() {
  console.log('Starting Firestore Database ID tests...');
  
  for (const databaseId of databaseIds) {
    const success = await testWithDatabaseId(databaseId);
    
    if (success) {
      console.log(`\n🎉 SUCCESS WITH DATABASE ID: ${databaseId || 'Not specified'}`);
      console.log('\nIMPORTANT: Remember this database ID for your actual application!');
      console.log(`When initializing Firestore, use: getFirestore(app, { databaseId: '${databaseId || ''}' })`);
      
      // Exit early on success
      process.exit(0);
    }
  }
  
  console.log('\n❌ All database ID tests failed.');
  console.log('\nPossible solutions:');
  console.log('1. Check the Firebase Console to verify your database ID/name');
  console.log('2. Make sure security rules allow read/write');
  console.log('3. Consider deleting and recreating your Firestore database with name "(default)"');
  console.log('4. Try using the Firebase Admin SDK with a service account');
}

// Run all tests
runAllTests(); 