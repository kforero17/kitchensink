// Firebase Authentication & Firestore Permissions Test

/**
 * This script tests Firebase authentication and Firestore permissions
 * It should be run from the command line using Node.js
 */

// Import required modules (you need to install these first)
const firebase = require('@react-native-firebase/app');
const auth = require('@react-native-firebase/auth');
const firestore = require('@react-native-firebase/firestore');

// Email & password for testing (replace with actual test credentials)
const TEST_EMAIL = 'YOUR_TEST_EMAIL@example.com';
const TEST_PASSWORD = 'YOUR_TEST_PASSWORD';

async function testFirebaseAuth() {
  console.log('Starting Firebase authentication test...');
  
  try {
    // Sign in with email and password
    console.log(`Attempting to sign in with ${TEST_EMAIL}...`);
    const credential = await auth().signInWithEmailAndPassword(TEST_EMAIL, TEST_PASSWORD);
    
    console.log('Successfully signed in!');
    console.log('User ID:', credential.user.uid);
    console.log('Email:', credential.user.email);
    console.log('Email verified:', credential.user.emailVerified);
    
    // Get user token
    const token = await credential.user.getIdToken();
    console.log('Successfully retrieved user token');
    
    // Test Firestore access
    console.log('\nTesting Firestore access...');
    
    // Try to read the user's own document
    const userDocRef = firestore().collection('users').doc(credential.user.uid);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
      console.log('Successfully read user document!');
    } else {
      console.log('User document does not exist yet');
      
      // Create a test user document
      await userDocRef.set({
        email: credential.user.email,
        createdAt: firestore.FieldValue.serverTimestamp()
      });
      console.log('Created user document in Firestore');
    }
    
    // Test writing to a user-specific collection
    const testColRef = userDocRef.collection('test_collection');
    const testDocRef = testColRef.doc('test_document');
    
    await testDocRef.set({
      timestamp: firestore.FieldValue.serverTimestamp(),
      testValue: 'This is a test'
    });
    
    console.log('Successfully wrote to test document in user collection');
    
    // Sign out
    await auth().signOut();
    console.log('\nSuccessfully signed out');
    
    console.log('\n✅ All tests passed! Firebase auth and Firestore are working correctly.');
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error('Code:', error.code);
    console.error('Full error:', error);
  }
}

// Run the test
testFirebaseAuth().then(() => {
  console.log('Test complete');
  process.exit(0);
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 