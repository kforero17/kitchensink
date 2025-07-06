const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

/**
 * Convert scraped recipe data to the app's Recipe format
 * @param {Object} scrapedRecipe - Raw scraped recipe data
 * @returns {Object} Recipe object matching the app's Recipe interface
 */
function convertToAppRecipe(scrapedRecipe) {
  // Generate a unique ID based on the source URL
  const recipeId = generateRecipeId(scrapedRecipe.sourceUrl);
  
  // Determine meal type tags based on title and ingredients
  const tags = generateRecipeTags(scrapedRecipe);
  
  // Estimate cost (simple heuristic based on ingredient count)
  const estimatedCost = estimateRecipeCost(scrapedRecipe.ingredients);
  
  return {
    id: recipeId,
    name: scrapedRecipe.title,
    description: scrapedRecipe.description,
    prepTime: scrapedRecipe.prepTime || '15 mins',
    cookTime: scrapedRecipe.cookTime || '20 mins',
    servings: scrapedRecipe.servings || 4,
    ingredients: scrapedRecipe.ingredients,
    instructions: scrapedRecipe.instructions,
    imageUrl: scrapedRecipe.imageUrl || '',
    tags: tags,
    estimatedCost: estimatedCost,
    // Additional metadata for tracking
    source: 'tasty.co',
    sourceUrl: scrapedRecipe.sourceUrl,
    scrapedAt: new Date().toISOString()
  };
}

/**
 * Generate a unique recipe ID from the source URL
 * @param {string} sourceUrl - Original recipe URL
 * @returns {string} Unique recipe ID
 */
function generateRecipeId(sourceUrl) {
  // Extract the recipe slug from the URL
  const match = sourceUrl.match(/\/recipe\/([^\/]+)/);
  if (match) {
    return `tasty-${match[1]}`;
  }
  
  // Fallback: use a hash of the URL
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(sourceUrl).digest('hex');
  return `tasty-${hash.substring(0, 8)}`;
}

/**
 * Generate recipe tags based on title, ingredients, and heuristics
 * @param {Object} recipe - Scraped recipe data
 * @returns {string[]} Array of tags
 */
function generateRecipeTags(recipe) {
  const tags = [];
  const title = recipe.title.toLowerCase();
  const ingredients = recipe.ingredients.map(ing => 
    typeof ing === 'string' ? ing.toLowerCase() : ing.item.toLowerCase()
  ).join(' ');
  
  // Determine primary meal type based on title and ingredients
  if (title.includes('breakfast') || title.includes('pancake') || title.includes('waffle') || 
      title.includes('oatmeal') || title.includes('cereal') || title.includes('toast')) {
    tags.push('breakfast');
  } else if (title.includes('lunch') || title.includes('sandwich') || title.includes('wrap') || 
             title.includes('salad') || title.includes('soup')) {
    tags.push('lunch');
  } else if (title.includes('dinner') || title.includes('main') || title.includes('entree')) {
    tags.push('dinner');
  } else if (title.includes('snack') || title.includes('appetizer') || title.includes('dip') || 
             title.includes('bite') || title.includes('finger food')) {
    tags.push('snacks');
  } else {
    // Default based on cooking time
    const cookTimeMatch = recipe.cookTime ? recipe.cookTime.match(/(\d+)/) : null;
    const minutes = cookTimeMatch ? parseInt(cookTimeMatch[1]) : 30;
    
    if (minutes <= 15) {
      tags.push('snacks');
    } else if (minutes <= 30) {
      tags.push('lunch');
    } else {
      tags.push('dinner');
    }
  }
  
  // Add dietary tags based on ingredients
  if (ingredients.includes('chicken') || ingredients.includes('beef') || 
      ingredients.includes('pork') || ingredients.includes('bacon') || 
      ingredients.includes('turkey') || ingredients.includes('ham')) {
    // Contains meat, so not vegetarian/vegan
  } else if (ingredients.includes('cheese') || ingredients.includes('milk') || 
             ingredients.includes('butter') || ingredients.includes('cream') || 
             ingredients.includes('yogurt')) {
    tags.push('vegetarian');
  } else if (!ingredients.includes('egg') && !ingredients.includes('eggs')) {
    tags.push('vegetarian');
    tags.push('vegan');
  }
  
  // Add cuisine tags based on title
  if (title.includes('italian') || title.includes('pasta') || title.includes('pizza')) {
    tags.push('italian');
  } else if (title.includes('mexican') || title.includes('taco') || title.includes('burrito')) {
    tags.push('mexican');
  } else if (title.includes('asian') || title.includes('chinese') || title.includes('thai')) {
    tags.push('asian');
  } else if (title.includes('indian') || title.includes('curry')) {
    tags.push('indian');
  }
  
  // Add cooking method tags
  if (title.includes('baked') || title.includes('roasted')) {
    tags.push('baked');
  } else if (title.includes('grilled')) {
    tags.push('grilled');
  } else if (title.includes('fried')) {
    tags.push('fried');
  }
  
  // Add Tasty source tag
  tags.push('tasty');
  
  return tags;
}

/**
 * Estimate recipe cost based on ingredients
 * @param {Array} ingredients - Array of ingredient objects
 * @returns {number} Estimated cost in dollars
 */
function estimateRecipeCost(ingredients) {
  // Simple heuristic: $1.50 per ingredient on average
  const baseIngredientCost = 1.50;
  const ingredientCount = ingredients.length;
  
  // Add some variance based on ingredient types
  let totalCost = ingredientCount * baseIngredientCost;
  
  // Check for expensive ingredients
  const expensiveIngredients = ['beef', 'salmon', 'shrimp', 'lobster', 'cheese', 'nuts'];
  const ingredientText = ingredients.map(ing => 
    typeof ing === 'string' ? ing.toLowerCase() : ing.item.toLowerCase()
  ).join(' ');
  
  expensiveIngredients.forEach(expensive => {
    if (ingredientText.includes(expensive)) {
      totalCost += 2; // Add $2 for expensive ingredients
    }
  });
  
  // Cap at reasonable range
  return Math.min(Math.max(totalCost, 3), 25);
}

/**
 * Save recipe to Firestore in the global recipes collection
 * @param {Object} recipeData - Recipe data to save
 * @returns {Promise<string|null>} Document ID if successful, null if failed
 */
async function saveRecipeToFirestore(recipeData) {
  try {
    console.log(`Saving recipe to Firestore: ${recipeData.name}`);
    
    // Convert to app recipe format
    const appRecipe = convertToAppRecipe(recipeData);
    
    // Check if recipe already exists
    const existingRecipe = await db.collection('recipes').doc(appRecipe.id).get();
    
    if (existingRecipe.exists) {
      console.log(`Recipe already exists, skipping: ${appRecipe.name}`);
      return appRecipe.id;
    }
    
    // Add timestamps
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const recipeWithTimestamps = {
      ...appRecipe,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // Save to Firestore
    await db.collection('recipes').doc(appRecipe.id).set(recipeWithTimestamps);
    
    console.log(`✅ Recipe saved successfully: ${appRecipe.name} (ID: ${appRecipe.id})`);
    return appRecipe.id;
    
  } catch (error) {
    console.error(`❌ Failed to save recipe ${recipeData.title}:`, error.message);
    return null;
  }
}

/**
 * Get statistics about scraped recipes
 * @returns {Promise<Object>} Statistics object
 */
async function getScrapingStats() {
  try {
    const recipesRef = db.collection('recipes');
    
    // Get total count
    const totalSnapshot = await recipesRef.count().get();
    const totalRecipes = totalSnapshot.data().count;
    
    // Get Tasty recipes count by ID prefix (more reliable than source field)
    const tastySnapshot = await recipesRef
      .orderBy('__name__')
      .startAt('tasty-')
      .endAt('tasty-\uf8ff')
      .count()
      .get();
    const tastyRecipes = tastySnapshot.data().count;
    
    // Get recent scraping activity (last 7 days)
    // Note: This might not work perfectly if createdAt field is inconsistent
    // but we'll keep it for now
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    let recentlyScraped = 0;
    try {
      const recentSnapshot = await recipesRef
        .where('createdAt', '>=', weekAgo)
        .orderBy('createdAt')
        .get();
      
      // Filter for Tasty recipes (since we can't combine where with orderBy on __name__)
      recentlyScraped = recentSnapshot.docs.filter(doc => doc.id.startsWith('tasty-')).length;
    } catch (error) {
      // If the query fails (e.g., missing index), just use 0
      console.debug('Could not get recent scraping stats:', error.message);
      recentlyScraped = 0;
    }
    
    return {
      totalRecipes,
      tastyRecipes,
      recentlyScraped,
      tastyPercentage: totalRecipes > 0 ? (tastyRecipes / totalRecipes * 100).toFixed(1) : 0
    };
    
  } catch (error) {
    console.error('Error getting scraping stats:', error.message);
    return {
      totalRecipes: 0,
      tastyRecipes: 0,
      recentlyScraped: 0,
      tastyPercentage: 0
    };
  }
}

/**
 * Clean up duplicate recipes (based on name similarity)
 * @returns {Promise<number>} Number of duplicates removed
 */
async function cleanupDuplicateRecipes() {
  try {
    console.log('Checking for duplicate recipes...');
    
    const recipesSnapshot = await db.collection('recipes')
      .where('source', '==', 'tasty.co')
      .get();
    
    const recipes = [];
    recipesSnapshot.forEach(doc => {
      recipes.push({ id: doc.id, ...doc.data() });
    });
    
    const duplicates = [];
    const seen = new Set();
    
    for (const recipe of recipes) {
      const normalizedName = recipe.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (seen.has(normalizedName)) {
        duplicates.push(recipe.id);
      } else {
        seen.add(normalizedName);
      }
    }
    
    // Delete duplicates
    const batch = db.batch();
    duplicates.forEach(id => {
      batch.delete(db.collection('recipes').doc(id));
    });
    
    if (duplicates.length > 0) {
      await batch.commit();
      console.log(`Removed ${duplicates.length} duplicate recipes`);
    }
    
    return duplicates.length;
    
  } catch (error) {
    console.error('Error cleaning up duplicates:', error.message);
    return 0;
  }
}

/**
 * Check if a recipe already exists in the database
 * @param {string} slug - Recipe slug to check
 * @returns {Promise<boolean>} True if recipe exists, false otherwise
 */
async function checkRecipeExists(slug) {
  try {
    // Create the document ID in the same format as saveRecipeToFirestore
    const docId = `tasty-${slug}`;
    
    // Use a simple document get - this shouldn't require any special indexes
    const docRef = db.collection('recipes').doc(docId);
    const docSnap = await docRef.get();
    
    return docSnap.exists;
  } catch (error) {
    // If there's any database error, assume the recipe doesn't exist
    // This way we err on the side of re-scraping rather than missing new recipes
    console.debug(`Database check failed for ${slug}, assuming new recipe:`, error.message);
    return false;
  }
}

/**
 * Get a sample of existing Tasty recipes from the database
 * @param {number} limit - Maximum number of recipes to fetch
 * @returns {Promise<string[]>} Array of recipe source URLs
 */
async function getSampleExistingRecipes(limit = 5) {
  try {
    // First try via the canonical source field
    let snapshot = await db.collection('recipes')
      .where('source', '==', 'tasty.co')
      .limit(limit)
      .get();

    // If the project contains older recipes without a source field, fall back to ID prefix search
    if (snapshot.empty) {
      snapshot = await db.collection('recipes')
        .orderBy('__name__')
        .startAt('tasty-')
        .endAt('tasty-\uf8ff')
        .limit(limit)
        .get();
    }

    const urls = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.sourceUrl) {
        urls.push(data.sourceUrl);
      } else {
        // Derive URL from ID if needed
        const match = doc.id.match(/^tasty-(.+)$/);
        if (match) {
          urls.push(`https://tasty.co/recipe/${match[1]}`);
        }
      }
    });

    return urls;
  } catch (error) {
    console.debug('Error getting sample existing recipes:', error.message);
    return [];
  }
}

module.exports = {
  saveRecipeToFirestore,
  getScrapingStats,
  cleanupDuplicateRecipes,
  checkRecipeExists,
  getSampleExistingRecipes,
  convertToAppRecipe
}; 