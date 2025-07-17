const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if it hasn't been initialized yet
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

/**
 * Fetch up to 20 recipes that are tagged with "breakfast" and originate from Tasty.co
 * @returns {Promise<{success: boolean, recipes: any[], message: string}>}
 */
async function getBreakfastRecipesTest() {
  console.log('🧪  Starting Breakfast Recipe Retrieval Test');
  console.log('═'.repeat(60));
  console.log('This test will attempt to retrieve 20 recipes from Firestore');
  console.log('that are tagged with "breakfast" and were scraped from Tasty.co');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // 1) Query for recipes that have the "breakfast" tag
    const snapshot = await db.collection('recipes')
      .where('tags', 'array-contains', 'breakfast')
      // Over-fetch to allow post-query filtering by source
      .limit(50)
      .get();

    const breakfastRecipes = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      // Ensure we only include Tasty recipes
      const isTasty = data.source === 'tasty.co' || doc.id.startsWith('tasty-');

      if (isTasty) {
        breakfastRecipes.push({
          id: doc.id,
          name: data.name,
          tags: data.tags,
          sourceUrl: data.sourceUrl || `https://tasty.co/recipe/${doc.id.replace(/^tasty-/, '')}`
        });
      }
    });

    const resultCount = breakfastRecipes.length;

    // 2) Log summary
    console.log(`📋  Found ${resultCount} Tasty breakfast recipes (need at least 20)`);
    breakfastRecipes.slice(0, 20).forEach((recipe, index) => {
      console.log(`  ${index + 1}. ${recipe.name}  –  ${recipe.sourceUrl}`);
    });

    console.log('');

    // 3) Evaluate test outcome
    if (resultCount >= 20) {
      console.log('✅  TEST PASSED: Retrieved 20 or more breakfast recipes from Firestore');
      return { success: true, recipes: breakfastRecipes.slice(0, 20), message: 'Retrieved 20 breakfast recipes' };
    } else {
      console.log('❌  TEST FAILED: Expected 20 breakfast recipes, but only found ' + resultCount);
      return { success: false, recipes: breakfastRecipes, message: `Only found ${resultCount} breakfast recipes` };
    }

  } catch (error) {
    console.error('💥  TEST FAILED with error:', error.message);
    console.error(error.stack);
    return { success: false, recipes: [], message: error.message };
  }
}

// Execute when run directly
if (require.main === module) {
  (async () => {
    const result = await getBreakfastRecipesTest();
    process.exit(result.success ? 0 : 1);
  })();
}

module.exports = { getBreakfastRecipesTest }; 