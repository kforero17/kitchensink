const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function debugRecipeStructure() {
  console.log('🔍 Debugging recipe structure in Firestore...\n');
  
  try {
    // First, let's see what collections exist
    console.log('📋 Step 1: Checking available collections...');
    const collections = await db.listCollections();
    console.log('Available collections:', collections.map(col => col.id));
    
    // Get a few recipes to see their structure
    console.log('\n📋 Step 2: Getting sample recipes...');
    const recipesSnapshot = await db.collection('recipes').limit(3).get();
    
    if (recipesSnapshot.empty) {
      console.log('❌ No recipes found in the recipes collection');
      return;
    }
    
    console.log(`✅ Found ${recipesSnapshot.size} recipes in the collection`);
    
    // Examine the structure of each recipe
    recipesSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📝 Recipe ${index + 1} (ID: ${doc.id}):`);
      console.log('  Fields:');
      Object.keys(data).forEach(key => {
        const value = data[key];
        const type = typeof value;
        const preview = type === 'string' ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` :
                      type === 'object' && value !== null ? `[${type}]` :
                      value;
        console.log(`    ${key}: ${preview}`);
      });
    });
    
    // Now specifically look for Tasty recipes
    console.log('\n📋 Step 3: Looking for Tasty recipes...');
    
    // Try different possible field names for source
    const sourceFields = ['source', 'Source', 'recipe_source', 'origin'];
    
    for (const sourceField of sourceFields) {
      try {
        console.log(`\n   Trying field: ${sourceField}`);
        const tastySnapshot = await db.collection('recipes')
          .where(sourceField, '==', 'tasty.co')
          .limit(2)
          .get();
        
        if (!tastySnapshot.empty) {
          console.log(`   ✅ Found ${tastySnapshot.size} recipes with ${sourceField} = 'tasty.co'`);
          
          tastySnapshot.forEach((doc, index) => {
            const data = doc.data();
            console.log(`   Recipe ${index + 1}:`);
            console.log(`     ID: ${doc.id}`);
            console.log(`     name: ${data.name || data.title || 'N/A'}`);
            console.log(`     ${sourceField}: ${data[sourceField]}`);
            console.log(`     sourceUrl: ${data.sourceUrl || data.source_url || data.url || 'N/A'}`);
          });
          
          return; // Found the right field
        } else {
          console.log(`   ❌ No recipes found with ${sourceField} = 'tasty.co'`);
        }
      } catch (error) {
        console.log(`   ❌ Error querying ${sourceField}: ${error.message}`);
      }
    }
    
    // If no specific source field worked, let's check all recipes for any containing 'tasty'
    console.log('\n📋 Step 4: Looking for any recipes containing "tasty"...');
    const allRecipesSnapshot = await db.collection('recipes').limit(10).get();
    
    let tastyFound = 0;
    allRecipesSnapshot.forEach(doc => {
      const data = doc.data();
      const docString = JSON.stringify(data).toLowerCase();
      if (docString.includes('tasty')) {
        tastyFound++;
        console.log(`   Found tasty reference in recipe: ${doc.id}`);
        console.log(`     name: ${data.name || data.title || 'N/A'}`);
        
        // Show all fields that contain 'tasty'
        Object.keys(data).forEach(key => {
          const value = data[key];
          if (typeof value === 'string' && value.toLowerCase().includes('tasty')) {
            console.log(`     ${key}: ${value}`);
          }
        });
      }
    });
    
    if (tastyFound === 0) {
      console.log('   ❌ No recipes containing "tasty" found in sample');
    } else {
      console.log(`   ✅ Found ${tastyFound} recipes containing "tasty" references`);
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

// Run the debug function
if (require.main === module) {
  debugRecipeStructure().then(() => {
    console.log('\n🏁 Debug complete');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { debugRecipeStructure }; 