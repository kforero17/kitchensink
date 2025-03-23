const admin = require('firebase-admin');

// Initialize Firebase Admin with just the project ID
// Note: This relies on Application Default Credentials
try {
  admin.initializeApp({
    projectId: 'kitchensink-c4872'
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

const db = admin.firestore();
console.log('Starting Firestore connectivity test with Admin SDK...');

async function testFirestore() {
  try {
    // Try reading from test_collection
    console.log('Attempting to read from test_collection...');
    const snapshot = await db.collection('test_collection').get();
    console.log('Firestore is reachable! Document count:', snapshot.size);
    
    // List documents if any exist
    if (snapshot.size > 0) {
      console.log('Documents found:');
      snapshot.forEach(doc => {
        console.log(`- ${doc.id} =>`, doc.data());
      });
    } else {
      console.log('No documents found in collection.');
      
      // If no documents exist, try to create one
      console.log('Attempting to create a test document...');
      const docRef = await db.collection('test_collection').add({
        message: 'Test document created with Admin SDK',
        timestamp: new Date().toISOString(),
        source: 'admin-sdk-test'
      });
      console.log('Document created with ID:', docRef.id);
    }
    
    console.log('Firestore Admin SDK test completed successfully!');
  } catch (error) {
    console.error('🔥 Firestore access error with Admin SDK:', error.message);
    console.error('Full error:', error);
  }
}

testFirestore(); 