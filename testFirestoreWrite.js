const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Starting Firestore write test...');

(async () => {
  try {
    // First try adding a document with auto-generated ID
    console.log('Attempting to add a document to test_collection...');
    const docRef = await addDoc(collection(db, 'test_collection'), {
      message: 'Test document created from Node.js script',
      timestamp: new Date().toISOString(),
      source: 'node-test-script'
    });
    console.log('Document added with ID:', docRef.id);
    
    // Then try setting a document with a specific ID
    console.log('Attempting to set a document with a specific ID...');
    await setDoc(doc(db, 'test_collection', 'test-doc-1'), {
      message: 'Test document with specific ID',
      timestamp: new Date().toISOString(),
      source: 'node-test-script'
    });
    console.log('Document set with ID: test-doc-1');
    
    console.log('Firestore write test completed successfully!');
  } catch (err) {
    console.error('🔥 Firestore write error:', err.message);
    if (err.stack) {
      console.error('Stack trace:', err.stack);
    }
  }
})(); 