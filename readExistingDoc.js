const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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
const db = getFirestore(app);

console.log('Firebase initialized. Attempting to read the existing document...');

// Try to read the document we can see in the UI
async function readExistingDoc() {
  try {
    console.log('Reading testDoc from test_collection...');
    
    // Get reference to the document we can see in the screenshot
    const docRef = doc(db, 'test_collection', 'testDoc');
    
    // Get the document
    const docSnap = await getDoc(docRef);
    
    // Check if it exists
    if (docSnap.exists()) {
      console.log('✅ Document data:', docSnap.data());
      
      // If we can read but not write, it suggests the security rules allow reads but not writes
      console.log('\nSECURITY RULES DIAGNOSIS:');
      console.log('If you can read but not write, your security rules likely allow reads but not writes.');
      console.log('Check if your rules have something like: allow read: if true; allow write: if false;');
      console.log('Or: allow read: if true; allow write: if request.auth != null;');
    } else {
      console.log('❌ Document does not exist!');
      console.log('The document "testDoc" in collection "test_collection" was not found.');
      console.log('Make sure the collection and document name match exactly what you see in the Firebase console.');
      console.log('Collection and document names are case-sensitive.');
    }
    
    return docSnap.exists();
  } catch (error) {
    console.error('❌ Error reading document:');
    console.error('- Code:', error.code);
    console.error('- Message:', error.message);
    
    console.log('\nPossible issues:');
    if (error.code === 'permission-denied') {
      console.log('Security rules are preventing read access.');
    } else if (error.code === 'not-found') {
      console.log('Collection path or database might be incorrect.');
    }
    
    return false;
  }
}

// Run the test
readExistingDoc(); 