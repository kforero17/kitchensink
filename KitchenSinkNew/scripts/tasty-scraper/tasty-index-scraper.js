const { chromium } = require('playwright');
const cheerio = require('cheerio');

// Simple cache to avoid checking the same URLs multiple times in a single run
const existenceCache = new Map();

/**
 * Check if a recipe URL already exists in the database
 */
async function checkIfRecipeExists(url) {
  try {
    // Check cache first
    if (existenceCache.has(url)) {
      return existenceCache.get(url);
    }
    
    // Extract recipe slug from URL for checking
    const urlParts = url.split('/');
    const slug = urlParts[urlParts.length - 1];
    
    // Try to get the recipe checking function from firestore-uploader
    const { checkRecipeExists } = require('./firestore-uploader');
    const exists = await checkRecipeExists(slug);
    
    // Cache the result
    existenceCache.set(url, exists);
    
    return exists;
  } catch (error) {
    // If there's any error checking, assume it doesn't exist to be safe
    console.debug(`Error checking recipe existence for ${url}:`, error.message);
    existenceCache.set(url, false);
    return false;
  }
}

/**
 * Get Tasty recipe URLs using browser automation to avoid blocking
 * @param {number} limit - Maximum number of URLs to fetch
 * @param {string} targetTag - Specific tag to target (e.g., 'weeknight')
 * @param {boolean} skipExisting - Whether to skip URLs that already exist in database
 * @returns {Promise<string[]>} Array of recipe URLs
 */
async function getTastyRecipeUrls(limit = 1000, targetTag = null, skipExisting = true) {
  const base = "https://tasty.co";
  
  console.log(`Starting to scrape Tasty recipe URLs (limit: ${limit})`);
  if (skipExisting) {
    console.log('✅ Skip existing recipes mode enabled');
  }
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set realistic headers
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
    });
    
    let allUrls = [];
    
    // Strategy 1: Target specific tag if provided (e.g., weeknight)
    if (targetTag) {
      console.log(`Strategy 1: Targeting specific tag: ${targetTag}`);
      allUrls = await scrapeTagPages(page, base, targetTag, limit * 2); // Get more than needed
    }
    
    // If no targetTag or not enough URLs, try other strategies
    if (allUrls.length < limit && !targetTag) {
      // ... other strategies here if needed
    }
    
    // Step 2: Filter out existing recipes if requested
    if (skipExisting && allUrls.length > 0) {
      console.log(`\n🔍 Checking ${allUrls.length} URLs against database...`);
      const newUrls = await filterExistingUrls(allUrls);
      console.log(`✅ Found ${newUrls.length} new recipes (${allUrls.length - newUrls.length} already exist)`);
      
      const finalUrls = newUrls.slice(0, limit);
      
      // Show sample URLs
      if (finalUrls.length > 0) {
        console.log('Sample new URLs:');
        finalUrls.slice(0, 3).forEach((url, i) => {
          console.log(`  ${i + 1}. ${url}`);
        });
      }
      
      return finalUrls;
    }
    
    const finalUrls = allUrls.slice(0, limit);
    
    // Show sample URLs
    if (finalUrls.length > 0) {
      console.log('Sample URLs:');
      finalUrls.slice(0, 3).forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`);
      });
    }
    
    return finalUrls;
    
  } catch (error) {
    console.error('Error in getTastyRecipeUrls:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Filter out URLs that already exist in the database
 * @param {string[]} urls - Array of URLs to check
 * @returns {Promise<string[]>} Array of URLs that don't exist in database
 */
async function filterExistingUrls(urls) {
  const newUrls = [];
  let checkedCount = 0;
  
  for (const url of urls) {
    checkedCount++;
    
    // Show progress every 50 URLs
    if (checkedCount % 50 === 0) {
      console.log(`📊 Checked ${checkedCount}/${urls.length} URLs (found ${newUrls.length} new)`);
    }
    
    const exists = await checkIfRecipeExists(url);
    if (!exists) {
      newUrls.push(url);
    }
    
    // Small delay to be respectful to database
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return newUrls;
}

/**
 * Scrape recipe URLs from a specific tag - SIMPLE VERSION
 * @param {Object} page - Playwright page object
 * @param {string} base - Base URL
 * @param {string} tag - Tag to scrape (e.g., 'weeknight')
 * @param {number} maxUrls - Maximum URLs to collect
 */
async function scrapeTagPages(page, base, tag, maxUrls) {
  const urls = new Set();
  
  try {
    const tagUrl = `${base}/tag/${tag}`;
    console.log(`Scraping tag page: ${tagUrl}`);
    
    await page.goto(tagUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    let pageCount = 1;
    
    while (urls.size < maxUrls) {
      console.log(`Loading page ${pageCount} of ${tag} tag (collected ${urls.size} URLs)`);
      
      // Scroll and load content
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
      }
      
      // Extract URLs from current page
      const currentContent = await page.content();
      const $ = cheerio.load(currentContent);
      
      const previousCount = urls.size;
      $('a[href*="/recipe/"]').each((i, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('/recipe/')) {
          const fullUrl = href.startsWith('http') ? href : base + href;
          urls.add(fullUrl);
        }
      });
      
      const newCount = urls.size - previousCount;
      console.log(`  Found ${newCount} URLs on page ${pageCount} (total: ${urls.size})`);
      
      // Try to click "Load More" button
      try {
        const loadMoreButton = await page.$('button:has-text("Load More"), button:has-text("Show More")');
        if (loadMoreButton) {
          await loadMoreButton.click();
          await page.waitForTimeout(3000);
        } else {
          console.log('No more load button found, finishing URL collection');
          break;
        }
      } catch (e) {
        console.log('Load more button not found or not clickable, finishing URL collection');
        break;
      }
      
      pageCount++;
      
      // Safety limit
      if (pageCount > 100) {
        console.log('Safety limit reached: Processed 100 pages');
        break;
      }
      
      // If no new URLs found, we've reached the end
      if (newCount === 0) {
        console.log('No new URLs found, reaching end of content');
        break;
      }
      
      await page.waitForTimeout(2000);
    }
    
    console.log(`✅ Finished collecting URLs: ${urls.size} total URLs from ${tag} tag`);
    return Array.from(urls);
    
  } catch (error) {
    console.error(`Error scraping tag ${tag}:`, error.message);
    return Array.from(urls);
  }
}

module.exports = { getTastyRecipeUrls }; 