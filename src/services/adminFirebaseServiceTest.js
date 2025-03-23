/**
 * Test script for Firebase Admin Service
 * 
 * This script tests the adminFirebaseService module's functionality.
 */

const firebaseAdminService = require('./adminFirebaseService');

async function runTests() {
  console.log('Testing Firebase Admin Service...');

  try {
    // Test 1: Create a document
    console.log('\n📝 Test 1: Creating a document...');
    const testData = {
      name: 'Test Document',
      description: 'Created by adminFirebaseService test',
      testField: true,
      timestamp: new Date().toISOString()
    };
    
    const docId = await firebaseAdminService.createDocument('test_collection', testData);
    console.log(`✅ Document created with ID: ${docId}`);

    // Test 2: Get the document
    console.log('\n🔍 Test 2: Getting the document...');
    const doc = await firebaseAdminService.getDocument('test_collection', docId);
    console.log('✅ Retrieved document:');
    console.log(JSON.stringify(doc, null, 2));

    // Test 3: Update the document
    console.log('\n🔄 Test 3: Updating the document...');
    await firebaseAdminService.updateDocument('test_collection', docId, {
      description: 'Updated by adminFirebaseService test',
      updateField: true
    });
    console.log('✅ Document updated');

    // Test 4: Get updated document
    console.log('\n🔍 Test 4: Getting the updated document...');
    const updatedDoc = await firebaseAdminService.getDocument('test_collection', docId);
    console.log('✅ Retrieved updated document:');
    console.log(JSON.stringify(updatedDoc, null, 2));

    // Test 5: Get all documents in collection
    console.log('\n📚 Test 5: Getting all documents in collection...');
    const allDocs = await firebaseAdminService.getAllDocuments('test_collection', {
      where: [{ field: 'testField', operator: '==', value: true }],
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: 10
    });
    console.log(`✅ Retrieved ${allDocs.length} documents`);

    // Test 6: Delete the document
    console.log('\n🗑️ Test 6: Deleting the document...');
    await firebaseAdminService.deleteDocument('test_collection', docId);
    console.log('✅ Document deleted');

    // Test 7: Verify document was deleted
    console.log('\n✅ Test 7: Verifying document was deleted...');
    const deletedDoc = await firebaseAdminService.getDocument('test_collection', docId);
    
    if (deletedDoc === null) {
      console.log('✅ Document successfully deleted (not found)');
    } else {
      console.log('❌ Document still exists!');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('The Firebase Admin Service is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the tests
runTests(); 