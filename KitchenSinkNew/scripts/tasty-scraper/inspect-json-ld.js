const { chromium } = require('playwright');
const cheerio = require('cheerio');

async function inspectJsonLD(url) {
  console.log(`\n🔍 Inspecting JSON-LD for: ${url}`);
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(3000);
    
    const content = await page.content();
    const $ = cheerio.load(content);
    
    console.log(`✅ Page loaded, analyzing JSON-LD scripts...`);
    
    let recipeFound = false;
    
    $('script[type="application/ld+json"]').each((index, script) => {
      try {
        const jsonText = $(script).html();
        if (!jsonText) return;
        
        console.log(`\n📄 JSON-LD Script ${index + 1}:`);
        console.log(`Length: ${jsonText.length} characters`);
        
        const jsonData = JSON.parse(jsonText);
        const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        recipes.forEach((data, dataIndex) => {
          console.log(`\nData object ${dataIndex + 1}:`);
          console.log(`Type: ${data['@type']}`);
          
          if (data['@type'] === 'Recipe') {
            recipeFound = true;
            console.log('🎉 RECIPE FOUND!');
            console.log(`Name: ${data.name || 'N/A'}`);
            console.log(`Description: ${data.description ? data.description.substring(0, 100) + '...' : 'N/A'}`);
            console.log(`Ingredients: ${data.recipeIngredient ? data.recipeIngredient.length : 0} items`);
            console.log(`Instructions: ${data.recipeInstructions ? data.recipeInstructions.length : 0} steps`);
            console.log(`Image: ${data.image ? 'Yes' : 'No'}`);
            console.log(`Prep Time: ${data.prepTime || 'N/A'}`);
            console.log(`Cook Time: ${data.cookTime || 'N/A'}`);
            console.log(`Total Time: ${data.totalTime || 'N/A'}`);
            console.log(`Servings: ${data.recipeYield || data.yield || 'N/A'}`);
            
            if (data.recipeIngredient && data.recipeIngredient.length > 0) {
              console.log('\nSample ingredients:');
              data.recipeIngredient.slice(0, 3).forEach((ing, i) => {
                console.log(`  ${i + 1}. ${ing}`);
              });
            }
            
            if (data.recipeInstructions && data.recipeInstructions.length > 0) {
              console.log('\nSample instructions:');
              data.recipeInstructions.slice(0, 2).forEach((inst, i) => {
                const text = typeof inst === 'string' ? inst : 
                           inst.text || inst.name || JSON.stringify(inst);
                console.log(`  ${i + 1}. ${text.substring(0, 100)}...`);
              });
            }
          } else {
            console.log(`Other type: ${data['@type']}`);
            if (data.name) console.log(`Name: ${data.name}`);
          }
        });
        
      } catch (error) {
        console.log(`❌ Error parsing JSON-LD script ${index + 1}: ${error.message}`);
      }
    });
    
    if (!recipeFound) {
      console.log('\n❌ No Recipe JSON-LD found');
      
      // Try to find recipe content with CSS selectors
      console.log('\n🔍 Trying CSS selectors...');
      
      const title = $('h1').first().text().trim();
      console.log(`Title from H1: "${title}"`);
      
      const possibleIngredients = $('li').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes('cup') || text.includes('tbsp') || text.includes('tsp') || 
               text.includes('pound') || text.includes('gram') || text.includes('ml');
      });
      console.log(`Possible ingredient elements: ${possibleIngredients.length}`);
      
      const possibleInstructions = $('ol li, .instructions li, .method li').length;
      console.log(`Possible instruction elements: ${possibleInstructions}`);
    }
    
  } catch (error) {
    console.log(`❌ Failed to inspect ${url}: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function main() {
  console.log('🔍 JSON-LD Inspector for Tasty.co');
  
  const testUrls = [
    'https://tasty.co/recipe/one-pot-garlic-parmesan-pasta',
    'https://tasty.co/recipe/crispy-honey-garlic-chicken'
  ];
  
  for (const url of testUrls) {
    await inspectJsonLD(url);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 Inspection complete!');
}

if (require.main === module) {
  main();
}

module.exports = { inspectJsonLD }; 