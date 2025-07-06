const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function testTastyQuery() {
  console.log('🔍 Testing Tasty recipe query...\n');
  
  try {
    // Test the exact query we're using in getSampleExistingRecipes
    console.log('📋 Testing: where("source", "==", "tasty.co")');
    const tastySnapshot = await db.collection('recipes')
      .where('source', '==', 'tasty.co')
      .limit(3)
      .get();
    
    console.log(`Results: ${tastySnapshot.size} recipes found`);
    
    if (tastySnapshot.size > 0) {
      tastySnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n  Recipe ${index + 1}:`);
        console.log(`    ID: ${doc.id}`);
        console.log(`    name: ${data.name}`);
        console.log(`    source: ${data.source}`);
        console.log(`    sourceUrl: ${data.sourceUrl}`);
      });
    } else {
      console.log('❌ No results found');
      
      // Let's try to see what values exist for the source field
      console.log('\n📋 Checking what source values exist...');
      const allSnapshot = await db.collection('recipes').limit(5).get();
      
      const sourceValues = new Set();
      allSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.source) {
          sourceValues.add(data.source);
        }
      });
      
      console.log('Source values found:', Array.from(sourceValues));
      
      // Also check if recipes with tasty IDs exist
      console.log('\n📋 Checking for recipes with tasty- IDs...');
      const tastyIdSnapshot = await db.collection('recipes')
        .orderBy('__name__')
        .startAt('tasty-')
        .endAt('tasty-\uf8ff')
        .limit(3)
        .get();
      
      console.log(`Recipes with tasty- IDs: ${tastyIdSnapshot.size} found`);
      
      if (tastyIdSnapshot.size > 0) {
        tastyIdSnapshot.forEach((doc, index) => {
          const data = doc.data();
          console.log(`\n  Recipe ${index + 1}:`);
          console.log(`    ID: ${doc.id}`);
          console.log(`    name: ${data.name}`);
          console.log(`    source: ${data.source}`);
          console.log(`    sourceUrl: ${data.sourceUrl}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error during query test:', error);
  }
}

// Run the test
if (require.main === module) {
  testTastyQuery().then(() => {
    console.log('\n🏁 Query test complete');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testTastyQuery }; 