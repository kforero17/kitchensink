const fetch = require('node-fetch');
const { chromium } = require('playwright');

async function diagnoseUrl(url) {
  console.log(`\n🔍 Diagnosing: ${url}`);
  
  // Test 1: Simple HTTP fetch
  console.log('Test 1: Basic HTTP fetch...');
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Content-Type: ${response.headers.get('content-type')}`);
    
    const html = await response.text();
    console.log(`✅ HTML length: ${html.length} characters`);
    
    // Check for basic content
    if (html.includes('recipe')) {
      console.log('✅ Contains "recipe" text');
    }
    if (html.includes('ingredient')) {
      console.log('✅ Contains "ingredient" text');
    }
    
  } catch (error) {
    console.log(`❌ HTTP fetch failed: ${error.message}`);
  }
  
  // Test 2: Playwright with browser
  console.log('\nTest 2: Playwright browser fetch...');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    console.log('Navigating to page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    console.log('✅ Page loaded successfully');
    
    // Check page title
    const title = await page.title();
    console.log(`✅ Page title: "${title}"`);
    
    // Check for basic elements
    const h1Count = await page.locator('h1').count();
    console.log(`✅ H1 elements found: ${h1Count}`);
    
    const scriptCount = await page.locator('script[type="application/ld+json"]').count();
    console.log(`✅ JSON-LD scripts found: ${scriptCount}`);
    
    // Check for recipe-related attributes
    const recipeElements = await page.locator('[itemtype*="Recipe"], [data-testid*="recipe"], .recipe').count();
    console.log(`✅ Recipe-related elements: ${recipeElements}`);
    
    // Get a sample of text content
    const bodyText = await page.locator('body').textContent();
    const textSample = bodyText.substring(0, 200).replace(/\s+/g, ' ').trim();
    console.log(`✅ Body text sample: "${textSample}..."`);
    
  } catch (error) {
    console.log(`❌ Playwright failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  console.log('🩺 Tasty.co URL Diagnostic Tool');
  
  const testUrls = [
    'https://tasty.co/recipe/one-pot-garlic-parmesan-pasta',
    'https://tasty.co'  // Test the main site too
  ];
  
  for (const url of testUrls) {
    try {
      await diagnoseUrl(url);
    } catch (error) {
      console.log(`❌ Failed to diagnose ${url}: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 Diagnosis complete!');
}

if (require.main === module) {
  main();
}

module.exports = { diagnoseUrl }; 