const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, doc, getDoc } = require('firebase/firestore');
const https = require('https');

// 1. First check internet connectivity
console.log('Testing internet connectivity...');
async function checkConnectivity() {
  return new Promise((resolve) => {
    https.get('https://www.google.com', (res) => {
      console.log('✅ Internet connectivity test successful');
      console.log('Status code:', res.statusCode);
      resolve(true);
    }).on('error', (err) => {
      console.error('❌ Internet connectivity test failed');
      console.error(err.message);
      resolve(false);
    });
  });
}

// 2. Define Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

// 3. Try Firebase operations with different regions
async function testFirestoreWithRegion(region = null) {
  try {
    console.log(`\nTesting Firestore with ${region ? 'region: ' + region : 'default region'}...`);
    
    // Initialize Firebase
    const app = initializeApp(region ? 
      { ...firebaseConfig, region } : 
      firebaseConfig, 
      `app-${region || 'default'}`
    );
    
    // Initialize Firestore
    const db = getFirestore(app);
    
    // Try to read all documents from test_collection
    console.log('Attempting to read from test_collection...');
    try {
      const querySnapshot = await getDocs(collection(db, 'test_collection'));
      console.log(`✅ Successfully read ${querySnapshot.size} documents!`);
      
      querySnapshot.forEach((doc) => {
        console.log(`- Document ${doc.id}: ${JSON.stringify(doc.data())}`);
      });
      
      // If read successful, try write
      console.log('\nAttempting to write to test_collection...');
      try {
        const docRef = await addDoc(collection(db, 'test_collection'), {
          message: `Test document from region ${region || 'default'}`,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Document written successfully with ID: ${docRef.id}`);
        return true;
      } catch (writeError) {
        console.error(`❌ Write error: ${writeError.message}`);
        console.error('Code:', writeError.code);
        return false;
      }
    } catch (readError) {
      console.error(`❌ Read error: ${readError.message}`);
      console.error('Code:', readError.code);
      return false;
    }
  } catch (initError) {
    console.error(`❌ Initialization error: ${initError.message}`);
    return false;
  }
}

// 4. Main function to run all tests
async function runAllTests() {
  console.log('===== FIREBASE CONNECTIVITY TEST =====\n');
  
  // Check internet
  const hasInternet = await checkConnectivity();
  if (!hasInternet) {
    console.error('⚠️ No internet connection detected. Firestore tests will likely fail.');
  }
  
  // Try different regions
  const regions = [
    null,            // Default
    'us-central1',   // United States
    'europe-west1',  // Europe
    'asia-east1'     // Asia
  ];
  
  let anySuccess = false;
  
  for (const region of regions) {
    const success = await testFirestoreWithRegion(region);
    if (success) {
      console.log(`\n🎉 Success with region: ${region || 'default'}`);
      anySuccess = true;
      break;  // Stop if any region works
    }
  }
  
  if (!anySuccess) {
    console.log('\n❌ All tests failed. Here are possible solutions:');
    console.log('1. Check your Firebase Console for the correct project ID');
    console.log('2. Make sure your Firestore database is fully initialized');
    console.log('3. Review your security rules to ensure they allow read/write');
    console.log('4. Try using the Firebase Admin SDK with a service account');
    console.log('5. There might be network issues or firewall restrictions');
  }
}

// Run all tests
runAllTests(); 