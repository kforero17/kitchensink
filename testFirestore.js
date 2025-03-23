const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Starting Firestore connectivity test...');

(async () => {
  try {
    console.log('Attempting to fetch documents from test_collection...');
    const snapshot = await getDocs(collection(db, 'test_collection'));
    console.log('Firestore is reachable! Document count:', snapshot.size);
    
    // List documents if any exist
    if (snapshot.size > 0) {
      console.log('Documents found:');
      snapshot.forEach(doc => {
        console.log(`- ${doc.id} =>`, doc.data());
      });
    } else {
      console.log('No documents found in collection.');
    }
  } catch (err) {
    console.error('🔥 Firestore access error:', err.message);
  }
})(); 