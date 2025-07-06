const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function debugConnection() {
  console.log('🔍 Debugging Firebase connection...\n');
  
  try {
    // Get basic info about the project
    const app = admin.app();
    console.log('📋 Firebase App Info:');
    console.log(`  Project ID: ${app.options.projectId || 'Not available'}`);
    console.log(`  Database URL: ${app.options.databaseURL || 'Not available'}`);
    console.log(`  Storage Bucket: ${app.options.storageBucket || 'Not available'}`);
    
    // Check total recipe count
    console.log('\n📊 Database Statistics:');
    const totalSnapshot = await db.collection('recipes').count().get();
    const totalRecipes = totalSnapshot.data().count;
    console.log(`  Total recipes: ${totalRecipes}`);
    
    // Get a few sample recipe IDs to see what's actually in the database
    if (totalRecipes > 0) {
      console.log('\n📋 Sample Recipe IDs:');
      const sampleSnapshot = await db.collection('recipes').limit(10).get();
      
      sampleSnapshot.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.id}`);
      });
      
      // Get one full recipe to see its structure
      console.log('\n📋 Sample Recipe Structure:');
      const firstDoc = sampleSnapshot.docs[0];
      const firstData = firstDoc.data();
      console.log(`Recipe ID: ${firstDoc.id}`);
      console.log('Fields:');
      Object.keys(firstData).forEach(key => {
        const value = firstData[key];
        const type = typeof value;
        const preview = type === 'string' ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` :
                      type === 'object' && value !== null ? `[${type}]` :
                      value;
        console.log(`  ${key}: ${preview}`);
      });
    } else {
      console.log('  ❌ No recipes found in database');
    }
    
  } catch (error) {
    console.error('❌ Error during connection debug:', error);
  }
}

// Run the debug function
if (require.main === module) {
  debugConnection().then(() => {
    console.log('\n🏁 Connection debug complete');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { debugConnection }; 