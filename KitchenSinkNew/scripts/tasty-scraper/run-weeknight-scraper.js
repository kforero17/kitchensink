#!/usr/bin/env node

/**
 * Convenience script to run the Tasty scraper targeting the weeknight tag
 * This script sets up the environment for scraping 3000+ weeknight recipes
 */

// Handle command line arguments first
const args = process.argv.slice(2);

// Set environment variables for weeknight tag scraping
process.env.MAX_RECIPES = '5000';
process.env.TARGET_TAG = 'weeknight';
process.env.BATCH_SIZE = '5';
process.env.DELAY_BETWEEN_BATCHES = '5000';
process.env.DELAY_BETWEEN_RECIPES = '2000';
process.env.SKIP_IMAGE_UPLOAD = 'false';
process.env.DRY_RUN = 'false';
process.env.DEBUG_SCRAPER = 'false';

if (args.includes('--dry-run')) {
  process.env.DRY_RUN = 'true';
  console.log('🔍 Running in DRY RUN mode - no recipes will be saved\n');
}

if (args.includes('--skip-images')) {
  process.env.SKIP_IMAGE_UPLOAD = 'true';
  console.log('🖼️  Skipping image uploads for faster processing\n');
}

if (args.includes('--debug')) {
  process.env.DEBUG_SCRAPER = 'true';
  console.log('🐛 Debug mode enabled\n');
}

if (args.includes('--limit')) {
  const limitIndex = args.indexOf('--limit') + 1;
  if (limitIndex < args.length && !isNaN(args[limitIndex])) {
    process.env.MAX_RECIPES = args[limitIndex];
    console.log(`🔢 Custom limit set: ${args[limitIndex]} recipes\n`);
  }
}

// Removed fast mode - smart URL filtering is now the default

if (args.includes('--help')) {
  console.log('Weeknight Recipe Scraper Usage:');
  console.log('');
  console.log('node run-weeknight-scraper.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run        Run without saving recipes (for testing)');
  console.log('  --skip-images    Skip image uploads (faster processing)');
  console.log('  --debug          Enable debug mode');
  console.log('  --limit <number> Set custom recipe limit');
  console.log('  --help           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node run-weeknight-scraper.js');
  console.log('  node run-weeknight-scraper.js --dry-run');
  console.log('  node run-weeknight-scraper.js --limit 100 --skip-images');
  console.log('');
  process.exit(0);
}

// Import and run the main scraper (after setting environment variables)
const { runTastyScraper } = require('./main');

console.log('🌙 Starting Weeknight Recipe Scraper');
console.log('====================================');
console.log('Configuration:');
console.log(`- Target Tag: ${process.env.TARGET_TAG}`);
console.log(`- Max Recipes: ${process.env.MAX_RECIPES}`);
console.log(`- Batch Size: ${process.env.BATCH_SIZE} recipes per batch`);
console.log(`- Delay Between Batches: ${process.env.DELAY_BETWEEN_BATCHES}ms`);
console.log(`- Delay Between Recipes: ${process.env.DELAY_BETWEEN_RECIPES}ms`);
console.log(`- Skip Image Upload: ${process.env.SKIP_IMAGE_UPLOAD}`);
console.log(`- Dry Run: ${process.env.DRY_RUN}`);
console.log('====================================\n');

// Start the scraper
runTastyScraper().catch(error => {
  console.error('💥 Scraper failed:', error);
  process.exit(1);
}); 