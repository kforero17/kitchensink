#!/usr/bin/env node

/**
 * Simple test runner for the recipe verification test
 * Usage: node run-verification-test.js
 */

const { verifyScrapedRecipesTest } = require('./verify-scraped-recipes-test');

async function runTest() {
  console.log('🧪 Running Recipe Verification Test');
  console.log('═'.repeat(60));
  console.log('This test will:');
  console.log('1. Scrape the first 10 recipe URLs from Tasty.co');
  console.log('2. Check if each recipe exists in Firestore');
  console.log('3. Report which recipes are found/missing');
  console.log('═'.repeat(60));
  console.log('');

  const startTime = Date.now();
  
  try {
    const result = await verifyScrapedRecipesTest();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n⏱️  TEST COMPLETED');
    console.log('═'.repeat(60));
    console.log(`Duration: ${duration} seconds`);
    console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Message: ${result.message}`);
    
    if (result.totalTested) {
      console.log(`Coverage: ${result.found}/${result.totalTested} recipes found`);
    }
    
    // Exit with appropriate status code
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR');
    console.error('═'.repeat(60));
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Test terminated');
  process.exit(1);
});

// Run the test
runTest(); 