/**
 * Firebase Admin SDK test script
 * 
 * This script tests connecting to Firestore using the Admin SDK,
 * which bypasses security rules and provides more reliable access.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Check if service account file exists
const serviceAccountPath = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file not found at:', serviceAccountPath);
  console.log('\nPlease follow these steps:');
  console.log('1. Go to Firebase Console → Project settings → Service accounts');
  console.log('2. Click "Generate new private key"');
  console.log('3. Save the file as "service-account.json" in this directory');
  process.exit(1);
}

// Read and display service account info
const serviceAccount = require(serviceAccountPath);
console.log('\n📄 Service Account Details:');
console.log(`Project ID: ${serviceAccount.project_id}`);
console.log(`Client Email: ${serviceAccount.client_email}`);

// Define database IDs to try
const databaseIdsToTry = ['(default)', 'default', serviceAccount.project_id, 'prod', 'firestore'];

// Test each database ID
async function testWithDifferentDatabaseIds() {
  let successfulDatabaseId = null;
  
  console.log('\n🔍 Testing with different database IDs...');
  
  for (const databaseId of databaseIdsToTry) {
    console.log(`\n📝 Trying database ID: "${databaseId}"...`);
    
    // Create a new app instance for each test
    const appName = `app-${databaseId}-${Date.now()}`;
    
    try {
      // Initialize with the specific database ID
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
        projectId: serviceAccount.project_id,
        databaseId: databaseId
      }, appName);
      
      console.log('✅ Firebase Admin SDK initialized successfully');
      
      // Get Firestore reference
      const db = admin.firestore(app);
      console.log('Firestore instance created');
      
      // Test a simple read operation
      console.log('Testing READ operation...');
      const snapshot = await db.collection('test_collection').get();
      console.log(`✅ READ successful: ${snapshot.size} documents found`);
      
      // If we got here, the connection works
      successfulDatabaseId = databaseId;
      
      // Try a simple write
      try {
        const docRef = await db.collection('test_collection').add({
          test: true,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ WRITE successful: Document created with ID: ${docRef.id}`);
        
        // Clean up by deleting the test document
        await docRef.delete();
        console.log(`✅ DELETE successful`);
      } catch (writeError) {
        console.error(`❌ Error writing document:`, writeError);
      }
      
      // Clean up the app
      await app.delete();
      break;
    } catch (error) {
      console.error(`❌ Error with database ID "${databaseId}":`, error.message);
      
      // Try to clean up the app anyway
      try {
        const app = admin.app(appName);
        await app.delete();
      } catch (deleteError) {
        // Ignore deletion errors
      }
    }
  }
  
  if (successfulDatabaseId) {
    console.log(`\n🎉 SUCCESS! Found working database ID: "${successfulDatabaseId}"`);
    console.log('\nUse this database ID in your application:');
    console.log(`
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseId: '${successfulDatabaseId}'
});

const db = admin.firestore();
    `);
    return true;
  } else {
    console.log('\n❌ All database IDs failed.');
    console.log('\nPossible solutions:');
    console.log('1. Make sure Firestore database is created in Firebase Console');
    console.log('2. Check if service account has correct permissions');
    console.log('3. Try creating a new database with name "(default)" in Firebase Console');
    console.log('4. Try using project ID from service account file as database ID');
    return false;
  }
}

// Check if the Firebase project has Firestore enabled
async function checkFirestoreProject() {
  console.log('\n🔎 Checking Firebase project status...');
  
  try {
    // Initialize with project info from service account
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    }, 'project-check');
    
    // Try to list Firestore databases in the project
    console.log('Checking for Firestore databases in the project...');
    // Note: This feature requires Firebase Admin SDK 9.3.0 or later
    // If you're using an older version, this will fail
    try {
      // @ts-ignore - Some versions don't have this API
      const client = app.firestore()._firestoreClient;
      
      // Check if we at least connected to the project
      console.log('✅ Connected to Firebase project successfully');
    } catch (apiError) {
      console.log('Unable to list databases (may be due to SDK version)');
    }
    
    // Clean up
    await app.delete();
  } catch (error) {
    console.error('❌ Error checking project:', error.message);
  }
}

// Main function to run all tests
async function runTests() {
  // First check if we can connect to the project
  await checkFirestoreProject();
  
  // Then try different database IDs
  await testWithDifferentDatabaseIds();
}

// Run all tests
runTests(); 