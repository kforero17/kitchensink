const { chromium } = require('playwright');
const cheerio = require('cheerio');

/**
 * Parse ISO 8601 duration format (PT10M, PT22M) to readable format
 */
function parseIsoDuration(isoDuration) {
  if (!isoDuration) return '';
  
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes} mins`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);
  
  return parts.length > 0 ? parts.join(' ') : '0 mins';
}

/**
 * Extract complete recipe data from JSON-LD
 */
function extractRecipeFromJsonLD($) {
  let recipeData = null;
  
  try {
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        for (const data of recipes) {
          if (data['@type'] === 'Recipe') {
            // Extract ingredients
            const ingredients = [];
            if (data.recipeIngredient) {
              data.recipeIngredient.forEach(ingredient => {
                const parsed = parseIngredient(ingredient);
                ingredients.push(parsed);
              });
            }
            
            // Extract instructions
            const instructions = [];
            if (data.recipeInstructions) {
              data.recipeInstructions.forEach(instruction => {
                if (typeof instruction === 'string') {
                  instructions.push(instruction);
                } else if (instruction.text) {
                  instructions.push(instruction.text);
                } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
                  instructions.push(instruction.text);
                }
              });
            }
            
            // Extract image URL
            let imageUrl = '';
            if (data.image) {
              if (typeof data.image === 'string') {
                imageUrl = data.image;
              } else if (Array.isArray(data.image) && data.image.length > 0) {
                imageUrl = typeof data.image[0] === 'string' ? data.image[0] : data.image[0].url;
              } else if (data.image.url) {
                imageUrl = data.image.url;
              }
            }
            
            // Extract servings
            let servings = 4; // default
            if (data.recipeYield) {
              if (typeof data.recipeYield === 'string') {
                const match = data.recipeYield.match(/\d+/);
                if (match) servings = parseInt(match[0]);
              } else if (typeof data.recipeYield === 'number') {
                servings = data.recipeYield;
              } else if (Array.isArray(data.recipeYield) && data.recipeYield.length > 0) {
                const match = data.recipeYield[0].toString().match(/\d+/);
                if (match) servings = parseInt(match[0]);
              }
            } else if (data.yield) {
              const match = data.yield.toString().match(/\d+/);
              if (match) servings = parseInt(match[0]);
            }
            
            recipeData = {
              title: data.name || 'Unknown Recipe',
              description: data.description || 'A delicious recipe from Tasty.co',
              ingredients: ingredients,
              instructions: instructions,
              imageUrl: imageUrl,
              prepTime: parseIsoDuration(data.prepTime) || '15 mins',
              cookTime: parseIsoDuration(data.cookTime) || '20 mins',
              servings: servings
            };
            
            return false; // Break out of the loop
          }
        }
      } catch (e) {
        // Continue to next script tag
      }
    });
  } catch (e) {
    // Continue with null result
  }
  
  return recipeData;
}

/**
 * Scrape a single recipe from Tasty.co
 * @param {string} url - The recipe URL
 * @returns {Promise<Object>} Recipe data object
 */
async function scrapeRecipe(url) {
  let browser;
  
  try {
    console.log(`Scraping recipe: ${url}`);
    
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    // Navigate to the recipe page with more robust loading
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for content to load and try to wait for recipe content
    await page.waitForTimeout(2000);
    
    // Try to wait for recipe content to appear
    try {
      await page.waitForSelector('h1, .recipe-name, [data-testid="recipe-name"]', { timeout: 10000 });
    } catch (error) {
      console.log('Recipe title not found with expected selectors, proceeding anyway...');
    }
    
    // Get the page content
    const content = await page.content();
    const $ = cheerio.load(content);
    
    // Debug: Save page content if extraction fails
    const debugMode = process.env.DEBUG_SCRAPER === 'true';
    
    // First try to extract from JSON-LD
    let recipe = extractRecipeFromJsonLD($);
    
    // If JSON-LD extraction failed, try CSS selectors
    if (!recipe) {
      recipe = {
        title: extractTitle($),
        description: extractDescription($),
        ingredients: extractIngredients($),
        instructions: extractInstructions($),
        imageUrl: extractImageUrl($),
        prepTime: extractPrepTime($),
        cookTime: extractCookTime($),
        servings: extractServings($)
      };
    }
    
    // Add source URL
    recipe.sourceUrl = url;
    
    // Enhanced validation with debugging
    if (!recipe.title || recipe.ingredients.length === 0) {
      if (debugMode) {
        const fs = require('fs');
        const path = require('path');
        const debugDir = path.join(__dirname, 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
        
        const filename = `debug-${Date.now()}.html`;
        fs.writeFileSync(path.join(debugDir, filename), content);
        console.log(`Debug: Saved page content to ${filename}`);
        
        // Log what we found
        console.log(`Debug info for ${url}:`);
        console.log(`- Title: "${recipe.title}"`);
        console.log(`- Ingredients: ${recipe.ingredients.length} found`);
        console.log(`- Instructions: ${recipe.instructions.length} found`);
        console.log(`- Page title: "${$('title').text()}"`);
        console.log(`- H1 elements: ${$('h1').length} found`);
      }
      throw new Error(`Failed to extract essential recipe data - Title: "${recipe.title}", Ingredients: ${recipe.ingredients.length}`);
    }
    
    console.log(`✅ Successfully scraped: ${recipe.title}`);
    return recipe;
    
  } catch (error) {
    console.error(`❌ Failed to scrape ${url}:`, error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract recipe title from the page
 */
function extractTitle($) {
  const selectors = [
    'h1[data-testid="recipe-name"]',
    'h1.recipe-name',
    'h1.recipe-title',
    '.recipe-title h1',
    '.recipe-header h1',
    '.recipe h1',
    '[itemProp="name"]',
    '.entry-title',
    '.post-title',
    'h1',
    'title'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length && element.text().trim()) {
      let title = element.text().trim();
      // Clean up common title suffixes
      title = title.replace(/\s*\|\s*Tasty$/i, '');
      title = title.replace(/\s*-\s*Tasty$/i, '');
      if (title.length > 5) { // Make sure we have a meaningful title
        return title;
      }
    }
  }
  
  return 'Unknown Recipe';
}

/**
 * Extract recipe description
 */
function extractDescription($) {
  const selectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    '.recipe-description',
    '.recipe-summary'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const content = element.attr('content') || element.text();
      if (content && content.trim()) {
        return content.trim();
      }
    }
  }
  
  return 'A delicious recipe from Tasty.co';
}

/**
 * Extract ingredients list
 */
function extractIngredients($) {
  const ingredients = [];
  
  // First try to find JSON-LD structured data
  try {
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        for (const data of recipes) {
          if (data['@type'] === 'Recipe' && data.recipeIngredient) {
            data.recipeIngredient.forEach(ingredient => {
              const parsed = parseIngredient(ingredient);
              ingredients.push(parsed);
            });
            return false; // Break out of each loop
          }
        }
      } catch (e) {
        // Continue to next script tag
      }
    });
  } catch (e) {
    // Continue to selector-based extraction
  }
  
  // If JSON-LD didn't work, try CSS selectors
  if (ingredients.length === 0) {
    const selectors = [
      '[data-testid="ingredient"]',
      '.recipe-ingredients li',
      '.ingredients-section li', 
      '.ingredient-list li',
      '.recipe-ingredient',
      '[itemProp="recipeIngredient"]',
      '.ingredients li',
      '.ingredient'
    ];
    
    for (const selector of selectors) {
      $(selector).each((i, element) => {
        const text = $(element).text().trim();
        if (text && text.length > 0) {
          // Parse ingredient text to separate measurement and item
          const parsed = parseIngredient(text);
          ingredients.push(parsed);
        }
      });
      
      if (ingredients.length > 0) break;
    }
  }
  
  return ingredients;
}

/**
 * Parse ingredient text to separate measurement and item
 */
function parseIngredient(text) {
  // Simple regex to match common measurement patterns
  const measurementRegex = /^(\d+(?:\/\d+)?(?:\.\d+)?\s*(?:cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l|cloves?|pieces?|slices?|pinch|dash)?)\s*(.+)$/i;
  
  const match = text.match(measurementRegex);
  
  if (match) {
    return {
      measurement: match[1].trim(),
      item: match[2].trim()
    };
  }
  
  // If no measurement found, treat as item only
  return {
    measurement: '',
    item: text
  };
}

/**
 * Extract cooking instructions
 */
function extractInstructions($) {
  const instructions = [];
  
  // First try to find JSON-LD structured data
  try {
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        for (const data of recipes) {
          if (data['@type'] === 'Recipe' && data.recipeInstructions) {
            data.recipeInstructions.forEach(instruction => {
              if (typeof instruction === 'string') {
                instructions.push(instruction);
              } else if (instruction.text) {
                instructions.push(instruction.text);
              } else if (instruction['@type'] === 'HowToStep' && instruction.text) {
                instructions.push(instruction.text);
              }
            });
            return false; // Break out of each loop
          }
        }
      } catch (e) {
        // Continue to next script tag
      }
    });
  } catch (e) {
    // Continue to selector-based extraction
  }
  
  // If JSON-LD didn't work, try CSS selectors
  if (instructions.length === 0) {
    const selectors = [
      '[data-testid="instruction"]',
      '.recipe-instructions ol li',
      '.instructions-section ol li',
      '.recipe-method ol li',
      '.recipe-directions ol li',
      '.prep-steps li',
      '[itemProp="recipeInstructions"]',
      '.instructions li',
      '.method li'
    ];
    
    for (const selector of selectors) {
      $(selector).each((i, element) => {
        const text = $(element).text().trim();
        if (text && text.length > 0) {
          instructions.push(text);
        }
      });
      
      if (instructions.length > 0) break;
    }
    
    // If no ordered list found, try paragraph format
    if (instructions.length === 0) {
      const paragraphSelectors = [
        '.recipe-instructions p',
        '.instructions-section p',
        '.recipe-method p',
        '.instructions p'
      ];
      
      for (const selector of paragraphSelectors) {
        $(selector).each((i, element) => {
          const text = $(element).text().trim();
          if (text && text.length > 10) { // Minimum length to avoid headers
            instructions.push(text);
          }
        });
        
        if (instructions.length > 0) break;
      }
    }
  }
  
  return instructions.length > 0 ? instructions : ['No detailed instructions available'];
}

/**
 * Extract recipe image URL
 */
function extractImageUrl($) {
  const selectors = [
    'meta[property="og:image"]',
    '.recipe-image img',
    '.recipe-photo img',
    '.hero-image img',
    'img[alt*="recipe"]'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const src = element.attr('content') || element.attr('src');
      if (src && src.startsWith('http')) {
        return src;
      }
    }
  }
  
  return '';
}

/**
 * Extract prep time
 */
function extractPrepTime($) {
  const selectors = [
    '[data-testid="prep-time"]',
    '.prep-time',
    '.recipe-prep-time'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      if (text) {
        return text;
      }
    }
  }
  
  return '15 mins'; // Default
}

/**
 * Extract cook time
 */
function extractCookTime($) {
  const selectors = [
    '[data-testid="cook-time"]',
    '.cook-time',
    '.recipe-cook-time'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      if (text) {
        return text;
      }
    }
  }
  
  return '20 mins'; // Default
}

/**
 * Extract servings
 */
function extractServings($) {
  const selectors = [
    '[data-testid="servings"]',
    '.servings',
    '.recipe-servings'
  ];
  
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      const match = text.match(/(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
  }
  
  return 4; // Default
}

module.exports = { scrapeRecipe }; 