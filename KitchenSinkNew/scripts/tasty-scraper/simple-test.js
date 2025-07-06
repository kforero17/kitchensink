// Load environment variables
require('dotenv').config({ path: __dirname + '/.env' });

const { scrapeRecipe } = require('./recipe-scraper');
const slugify = require('slugify');

// Known working URLs for testing
const WORKING_URLS = [
  'https://tasty.co/recipe/one-pot-garlic-parmesan-pasta',
  // Add more URLs as we discover them
];

/**
 * Simple test without Firebase complexity
 */
async function simpleTest() {
  console.log('🧪 Simple Tasty Recipe Scraper Test');
  console.log('Testing core scraping functionality without Firebase...\n');
  
  const results = {
    successful: 0,
    failed: 0,
    recipes: []
  };
  
  for (const url of WORKING_URLS) {
    try {
      console.log(`🔄 Testing: ${url}`);
      
      const recipe = await scrapeRecipe(url);
      
      if (recipe && recipe.title && recipe.ingredients.length > 0) {
        results.successful++;
        results.recipes.push(recipe);
        
        console.log('✅ SUCCESS!');
        console.log(`   Title: ${recipe.title}`);
        console.log(`   Ingredients: ${recipe.ingredients.length} items`);
        console.log(`   Instructions: ${recipe.instructions.length} steps`);
        console.log(`   Prep Time: ${recipe.prepTime}`);
        console.log(`   Cook Time: ${recipe.cookTime}`);
        console.log(`   Servings: ${recipe.servings}`);
        console.log(`   Image: ${recipe.imageUrl ? 'Yes' : 'No'}\n`);
        
        // Show sample ingredients
        if (recipe.ingredients.length > 0) {
          console.log('   Sample ingredients:');
          recipe.ingredients.slice(0, 3).forEach((ing, i) => {
            console.log(`     ${i + 1}. ${ing.measurement} ${ing.item}`);
          });
          console.log('');
        }
        
      } else {
        throw new Error('Invalid recipe data');
      }
      
    } catch (error) {
      results.failed++;
      console.log(`❌ FAILED: ${error.message}\n`);
    }
  }
  
  console.log('🎉 Test Summary:');
  console.log(`   ✅ Successful: ${results.successful}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  
  if (results.successful > 0) {
    console.log('\n🚀 Core scraping is working! Ready for Firebase setup.');
    
    // Save recipes to JSON for inspection
    const fs = require('fs');
    const outputFile = 'test-recipes.json';
    fs.writeFileSync(outputFile, JSON.stringify(results.recipes, null, 2));
    console.log(`📁 Recipes saved to ${outputFile} for inspection.`);
    
    console.log('\n📋 Next steps:');
    console.log('1. Set up your Firebase service account key');
    console.log('2. Create the required Firestore index (link provided in error)');
    console.log('3. Run the full scraper');
  } else {
    console.log('\n❌ Core scraping failed. Check the errors above.');
  }
}

if (require.main === module) {
  simpleTest();
}

module.exports = { simpleTest }; 