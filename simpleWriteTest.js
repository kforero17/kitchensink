const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, setDoc, doc } = require('firebase/firestore');

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

console.log('Attempting to write to Firestore...');

// First test: Using addDoc (auto-generated ID)
async function testAddDoc() {
  try {
    console.log('Test 1: Adding document with auto-generated ID');
    const docRef = await addDoc(collection(db, 'test_collection'), {
      test_field: 'This is a test',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Document written successfully with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('❌ Error adding document:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return false;
  }
}

// Second test: Using setDoc (specified ID)
async function testSetDoc() {
  try {
    console.log('\nTest 2: Setting document with specific ID');
    const docId = 'test-doc-' + Date.now();
    await setDoc(doc(db, 'test_collection', docId), {
      test_field: 'This is a test with specific ID',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Document written successfully with ID:', docId);
    return true;
  } catch (error) {
    console.error('❌ Error setting document:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return false;
  }
}

// Run both tests
async function runTests() {
  let addDocSuccess = await testAddDoc();
  let setDocSuccess = await testSetDoc();
  
  if (addDocSuccess || setDocSuccess) {
    console.log('\n✅ At least one write test succeeded!');
  } else {
    console.log('\n❌ All write tests failed. Possible issues:');
    console.log('1. Security rules may still be restricting writes');
    console.log('2. The Firestore instance might not be properly initialized');
    console.log('3. There might be network connectivity issues');
    console.log('4. The Firebase project configuration might be incorrect');
  }
}

runTests(); 