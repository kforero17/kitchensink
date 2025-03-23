/**
 * Test Firestore connectivity using a service account file
 * 
 * To use this script:
 * 1. Create a service account in Firebase Console -> Project Settings -> Service Accounts
 * 2. Generate a new private key (JSON file)
 * 3. Save the file as 'service-account.json' in the same directory as this script
 * 4. Run this script with Node.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Check if service account file exists
const serviceAccountPath = path.join(__dirname, 'service-account.json');

console.log('Checking for service account file at:', serviceAccountPath);
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file not found at:', serviceAccountPath);
  console.log('\nTo use this script:');
  console.log('1. Create a service account in Firebase Console -> Project Settings -> Service Accounts');
  console.log('2. Generate a new private key (JSON file)');
  console.log('3. Save the file as "service-account.json" in the same directory as this script');
  console.log('4. Run this script again');
  process.exit(1);
}

// Initialize Firebase Admin with service account
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: 'kitchensink-c4872'
  });
  console.log('✅ Firebase Admin SDK initialized successfully with service account');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

const db = admin.firestore();
console.log('Starting Firestore connectivity test with service account...');

async function testFirestore() {
  try {
    // Test reading
    console.log('\n📖 Testing READ operation...');
    console.log('Attempting to read from test_collection...');
    const snapshot = await db.collection('test_collection').get();
    console.log('✅ Firestore is reachable! Document count:', snapshot.size);
    
    // List documents if any exist
    if (snapshot.size > 0) {
      console.log('Documents found:');
      snapshot.forEach(doc => {
        console.log(`- ${doc.id} =>`, doc.data());
      });
    } else {
      console.log('No documents found in collection.');
    }
    
    // Test writing
    console.log('\n✏️ Testing WRITE operation...');
    console.log('Attempting to create a test document...');
    const docRef = await db.collection('test_collection').add({
      message: 'Test document created with Admin SDK service account',
      timestamp: new Date().toISOString(),
      source: 'admin-sdk-service-account-test'
    });
    console.log('✅ Document created with ID:', docRef.id);
    
    // Test updating
    console.log('\n🔄 Testing UPDATE operation...');
    console.log(`Attempting to update document ${docRef.id}...`);
    await docRef.update({
      updated: true,
      updateTimestamp: new Date().toISOString()
    });
    console.log('✅ Document updated successfully');
    
    // Test deleting
    console.log('\n🗑️ Testing DELETE operation...');
    console.log(`Attempting to delete document ${docRef.id}...`);
    await docRef.delete();
    console.log('✅ Document deleted successfully');
    
    console.log('\n🎉 Firestore service account test completed successfully!');
    console.log('All operations (READ, WRITE, UPDATE, DELETE) succeeded.');
    console.log('Your Firebase configuration is working properly.');
  } catch (error) {
    console.error('\n❌ Firestore access error with service account:', error.message);
    console.error('Full error:', error);
  }
}

testFirestore(); 