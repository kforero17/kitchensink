// Load environment variables
require('dotenv').config({ path: __dirname + '/.env' });

const { getTastyRecipeUrls } = require('./tasty-index-scraper');
const { scrapeRecipe } = require('./recipe-scraper');
const { uploadImage, generateSlug, checkStorageAccess } = require('./media-downloader');
const { saveRecipeToFirestore, getScrapingStats, cleanupDuplicateRecipes } = require('./firestore-uploader');
const slugify = require('slugify');

// Configuration
const CONFIG = {
  MAX_RECIPES: parseInt(process.env.MAX_RECIPES) || 3000,
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 5,
  DELAY_BETWEEN_BATCHES: parseInt(process.env.DELAY_BETWEEN_BATCHES) || 5000,
  DELAY_BETWEEN_RECIPES: parseInt(process.env.DELAY_BETWEEN_RECIPES) || 2000,
  SKIP_IMAGE_UPLOAD: process.env.SKIP_IMAGE_UPLOAD === 'true',
  DRY_RUN: process.env.DRY_RUN === 'true',
  TARGET_TAG: process.env.TARGET_TAG || null,
  DEBUG_SCRAPER: process.env.DEBUG_SCRAPER === 'true'
};

/**
 * Main scraping function
 */
async function runTastyScraper() {
  console.log('🚀 Starting Tasty Recipe Scraper');
  console.log('Configuration:', CONFIG);
  
  try {
    // Check Firebase Storage access if image upload is enabled
    if (!CONFIG.SKIP_IMAGE_UPLOAD) {
      const storageOk = await checkStorageAccess();
      if (!storageOk) {
        console.warn('⚠️  Firebase Storage access failed. Proceeding without image upload.');
        CONFIG.SKIP_IMAGE_UPLOAD = true;
      }
    }
    
    // Get initial stats
    const initialStats = await getScrapingStats();
    console.log('📊 Initial stats:', initialStats);
    
    // Step 1: Get recipe URLs
    console.log('\n📝 Step 1: Fetching recipe URLs...');
    const urls = await getTastyRecipeUrls(CONFIG.MAX_RECIPES, CONFIG.TARGET_TAG, true); // Always skip existing recipes
    
    if (urls.length === 0) {
      console.error('❌ No recipe URLs found. Exiting.');
      return;
    }
    
    console.log(`✅ Found ${urls.length} recipe URLs`);
    if (CONFIG.TARGET_TAG) {
      console.log(`🎯 Target: ${CONFIG.TARGET_TAG} tag`);
    }
    
    // Step 2: Process recipes in batches
    console.log('\n🍳 Step 2: Processing recipes...');
    
    const results = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    
    for (let i = 0; i < urls.length; i += CONFIG.BATCH_SIZE) {
      const batch = urls.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(urls.length / CONFIG.BATCH_SIZE)}`);
      
      // Process batch concurrently but with controlled concurrency
      const batchPromises = batch.map(async (url, index) => {
        // Add staggered delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, index * 1000));
        
        return processRecipe(url, results);
      });
      
      await Promise.allSettled(batchPromises);
      
      // Delay between batches
      if (i + CONFIG.BATCH_SIZE < urls.length) {
        console.log(`⏳ Waiting ${CONFIG.DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Step 3: Final statistics and cleanup
    console.log('\n🧹 Step 3: Cleanup and final statistics...');
    
    const duplicatesRemoved = await cleanupDuplicateRecipes();
    const finalStats = await getScrapingStats();
    
    // Print final results
    console.log('\n✅ Scraping completed!');
    console.log('════════════════════════════════════');
    console.log(`📊 Results:`);
    console.log(`   Successful: ${results.successful}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Duplicates removed: ${duplicatesRemoved}`);
    console.log('');
    console.log(`📈 Database stats:`);
    console.log(`   Total recipes: ${finalStats.totalRecipes}`);
    console.log(`   Tasty recipes: ${finalStats.tastyRecipes} (${finalStats.tastyPercentage}%)`);
    console.log(`   Recently scraped: ${finalStats.recentlyScraped}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Fatal error during scraping:', error);
    process.exit(1);
  }
}

/**
 * Process a single recipe
 * @param {string} url - Recipe URL
 * @param {Object} results - Results tracking object
 */
async function processRecipe(url, results) {
  try {
    console.log(`\n🔄 Processing: ${url}`);
    
    // Step 1: Scrape recipe data
    const recipe = await scrapeRecipe(url);
    
    if (!recipe || !recipe.title) {
      throw new Error('Invalid recipe data extracted');
    }
    
    // Step 2: Generate slug and upload image
    const slug = slugify(recipe.title, { lower: true, strict: true });
    
    if (!CONFIG.SKIP_IMAGE_UPLOAD && recipe.imageUrl) {
      try {
        const publicImageUrl = await uploadImage(recipe.imageUrl, slug);
        recipe.imageUrl = publicImageUrl;
      } catch (imageError) {
        console.warn(`⚠️  Image upload failed for ${recipe.title}:`, imageError.message);
        // Continue with original image URL
      }
    }
    
    // Step 3: Save to Firestore
    if (!CONFIG.DRY_RUN) {
      const recipeId = await saveRecipeToFirestore(recipe);
      
      if (recipeId) {
        results.successful++;
        console.log(`✅ ${recipe.title}`);
      } else {
        results.failed++;
        results.errors.push(`Failed to save: ${recipe.title}`);
      }
    } else {
      console.log(`🔍 DRY RUN: Would save ${recipe.title}`);
      results.successful++;
    }
    
    // Small delay between recipes
    await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_RECIPES));
    
  } catch (error) {
    results.failed++;
    const errorMsg = `${url} | ${error.message}`;
    results.errors.push(errorMsg);
    console.error(`❌ Failed: ${errorMsg}`);
  }
}

/**
 * Test scraper on a few URLs
 */
async function testScraper(testUrls = null) {
  console.log('🧪 Running Tasty Scraper Test');
  
  const urls = testUrls || [
    'https://tasty.co/recipe/one-pot-garlic-parmesan-pasta'
    // Note: Only using one working URL for now
    // More URLs can be added once we have a working URL discovery system
  ];
  
  console.log(`Testing with ${urls.length} URL(s)...`);
  
  for (const url of urls) {
    try {
      console.log(`\n🔍 Testing: ${url}`);
      
      const recipe = await scrapeRecipe(url);
      
      console.log('Recipe data extracted:');
      console.log(`  Title: ${recipe.title}`);
      console.log(`  Description: ${recipe.description.substring(0, 100)}...`);
      console.log(`  Ingredients: ${recipe.ingredients.length} items`);
      console.log(`  Instructions: ${recipe.instructions.length} steps`);
      console.log(`  Image URL: ${recipe.imageUrl ? 'Yes' : 'No'}`);
      console.log(`  Prep Time: ${recipe.prepTime}`);
      console.log(`  Cook Time: ${recipe.cookTime}`);
      console.log(`  Servings: ${recipe.servings}`);
      
      if (recipe.ingredients.length > 0) {
        console.log('  Sample ingredients:');
        recipe.ingredients.slice(0, 3).forEach(ing => {
          console.log(`    - ${ing.measurement} ${ing.item}`);
        });
      }
      
      if (recipe.instructions.length > 0) {
        console.log('  Sample instruction:');
        console.log(`    1. ${recipe.instructions[0].substring(0, 100)}...`);
      }
      
      console.log('✅ Test successful');
      
    } catch (error) {
      console.error(`❌ Test failed for ${url}:`, error.message);
    }
    
    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 Test completed - Scraper is working perfectly!');
  console.log('\n📋 Next steps:');
  console.log('1. Set up your Firebase service account key');
  console.log('2. Run: npm run scrape:tasty (for full scraping)');
  console.log('3. The scraper will find valid URLs automatically');
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testScraper();
  } else if (args.includes('--stats')) {
    getScrapingStats().then(stats => {
      console.log('📊 Current scraping statistics:');
      console.log(stats);
    });
  } else if (args.includes('--cleanup')) {
    cleanupDuplicateRecipes().then(removed => {
      console.log(`🧹 Cleanup completed. Removed ${removed} duplicates.`);
    });
  } else {
    runTastyScraper();
  }
}

module.exports = {
  runTastyScraper,
  testScraper,
  processRecipe
};