const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  enableIndexedDbPersistence,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator
} = require('firebase/firestore');

// Initialize Firebase with app config from your plist
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

// Additional collections to try (public collections often have different security rules)
const collectionsToTry = [
  'test_collection',   // The one we tried before
  'public',            // Sometimes used for public data
  'public_data',       // Sometimes used for public data
  'recipes',           // Your app specific collection
  'users'              // User collection
];

console.log('Starting enhanced Firestore connectivity test...');
console.log('Using Firebase config:', firebaseConfig);

const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings for better offline support
const firestoreSettings = {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
};

// Initialize Firestore with settings
const db = initializeFirestore(app, firestoreSettings);

// Try to enable persistence for offline support
enableIndexedDbPersistence(db)
  .then(() => {
    console.log('Offline persistence has been enabled.');
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Offline persistence could not be enabled because multiple tabs are open');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence');
    } else {
      console.error('Error enabling offline persistence:', err);
    }
  });

// Main test function
async function testAllCollections() {
  console.log('\nAttempting to access multiple collections to find one that works...');
  
  let overallSuccess = false;
  
  // Try each collection
  for (const collectionName of collectionsToTry) {
    console.log(`\n--- Testing collection: ${collectionName} ---`);
    
    try {
      // Test read
      const snapshot = await getDocs(collection(db, collectionName));
      console.log(`✅ Success reading from ${collectionName}! Found ${snapshot.size} documents.`);
      
      // If documents exist, show them
      if (snapshot.size > 0) {
        console.log(`Documents in ${collectionName}:`);
        snapshot.forEach(doc => {
          console.log(`- ${doc.id} =>`, doc.data());
        });
      }
      
      // Try to write a document
      try {
        console.log(`Attempting to write to ${collectionName}...`);
        const docRef = await addDoc(collection(db, collectionName), {
          message: `Test document in ${collectionName}`,
          timestamp: new Date().toISOString(),
          test: true
        });
        console.log(`✅ Successfully wrote to ${collectionName}! Document ID: ${docRef.id}`);
        
        // Try to read the document we just wrote
        const docSnap = await getDoc(doc(db, collectionName, docRef.id));
        if (docSnap.exists()) {
          console.log(`Successfully read back the document: ${JSON.stringify(docSnap.data())}`);
        }
        
        overallSuccess = true;
      } catch (writeError) {
        console.error(`❌ Error writing to ${collectionName}:`, writeError.message);
      }
    } catch (readError) {
      console.error(`❌ Error reading from ${collectionName}:`, readError.message);
    }
  }
  
  if (overallSuccess) {
    console.log('\n🎉 Test completed with at least one successful operation!');
  } else {
    console.log('\n❌ All tests failed. Check Firebase configuration and security rules.');
  }
}

// Run the test
testAllCollections(); 