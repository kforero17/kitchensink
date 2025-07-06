const inquirer = require('inquirer').default || require('inquirer');

// Set up global environment
(global).__DEV__ = true;

// Mock React Native Firebase modules
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id.startsWith('@react-native-firebase')) {
    return {
      default: () => ({}),
      auth: () => ({ currentUser: null }),
      firestore: () => ({
        collection: () => ({
          orderBy: () => ({
            limit: () => ({
              get: () => Promise.resolve({ docs: [] })
            })
          })
        })
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

// Register ts-node for TypeScript imports
require('ts-node').register({ 
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

async function testNewAlgorithm() {
  try {
    console.log('🧪 Testing New Recipe Generation Algorithm\n');
    
    // Import the actual services
    const { generateRecipeCandidates } = require('../src/candidate-generation/candidateGenerationService');
    const { rankRecipes } = require('../src/ranking/rankRecipes');
    const { unifiedToAppRecipe } = require('../src/utils/unifiedToAppRecipe');
    
    // Get user preferences
    const preferences = await promptUserPreferences();
    
    console.log('\n🔍 Step 1: Generating Recipe Candidates...');
    console.log('📋 Using preferences:', JSON.stringify(preferences, null, 2));
    
    // Step 1: Generate candidates using the new algorithm
    const candidates = await generateRecipeCandidates({
      userEmbedding: [], // Mock embedding
      diet: buildDietParam(preferences.dietary),
      intolerances: buildIntoleranceParam(preferences.dietary),
      cuisine: preferences.food.preferredCuisines?.join(',') || undefined,
      pantryTopK: preferences.pantryItems || [],
      maxReadyTime: preferences.maxReadyTime || undefined,
    });
    
    console.log(`✅ Generated ${candidates.length} candidate recipes`);
    candidates.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.title} (${recipe.source}) - ${recipe.readyInMinutes}min`);
    });
    
    console.log('\n🏆 Step 2: Ranking Recipes...');
    
    // Step 2: Rank the candidates
    const ranked = rankRecipes(candidates, {
      userTokens: buildUserTokens(preferences),
      pantryIngredients: preferences.pantryItems || [],
      spoonacularBias: -0.05, // Slight preference for Tasty recipes
    });
    
    console.log(`✅ Ranked ${ranked.length} recipes by relevance`);
    console.log('\n🥇 Top 5 Ranked Recipes:');
    ranked.slice(0, 5).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.recipe.title} (Score: ${item.score.toFixed(3)})`);
      console.log(`      📊 Features: sim=${item.features.sim.toFixed(2)}, pantry=${item.features.pantry.toFixed(2)}, pop=${item.features.popularity.toFixed(2)}`);
    });
    
    console.log('\n🍽️ Step 3: Converting to App Format...');
    
    // Step 3: Convert to app recipe format
    const appRecipes = ranked.slice(0, 8).map(item => unifiedToAppRecipe(item.recipe));
    
    console.log(`✅ Converted ${appRecipes.length} recipes to app format`);
    console.log('\n📋 Final Recipe List:');
    appRecipes.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. 🍽️  ${recipe.name}`);
      console.log(`      🏷️  [${recipe.tags.join(', ')}]`);
      console.log(`      ⏱️  ${recipe.prepTime} prep + ${recipe.cookTime} cook`);
      console.log(`      💰 $${recipe.estimatedCost}`);
      console.log('');
    });
    
    // Interactive exploration
    if (appRecipes.length > 0) {
      const { exploreMore } = await inquirer.prompt([
        { type: 'confirm', name: 'exploreMore', message: 'Would you like to explore recipe details?', default: false }
      ]);
      
      if (exploreMore) {
        await exploreRecipeDetails(appRecipes, ranked.slice(0, 8));
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing algorithm:', error);
    console.error('Stack:', error.stack);
  }
}

async function promptUserPreferences() {
  const dietary = await inquirer.prompt([
    { type: 'confirm', name: 'vegetarian', message: 'Vegetarian?', default: false },
    { type: 'confirm', name: 'vegan', message: 'Vegan?', default: false },
    { type: 'confirm', name: 'glutenFree', message: 'Gluten-free?', default: false },
    { type: 'confirm', name: 'dairyFree', message: 'Dairy-free?', default: false },
    { type: 'input', name: 'allergies', message: 'Allergies (comma separated):', default: '' },
  ]);

  const food = await inquirer.prompt([
    { type: 'input', name: 'favoriteIngredients', message: 'Favorite ingredients (comma separated):', default: 'tomato,chicken,pasta' },
    { type: 'input', name: 'dislikedIngredients', message: 'Disliked ingredients (comma separated):', default: '' },
    { type: 'input', name: 'preferredCuisines', message: 'Preferred cuisines (comma separated):', default: 'italian,american' },
  ]);

  const cooking = await inquirer.prompt([
    { type: 'number', name: 'maxReadyTime', message: 'Max cooking time (minutes, 0 = no limit):', default: 45 },
    { type: 'input', name: 'pantryItems', message: 'Items in your pantry (comma separated):', default: 'onion,garlic,olive oil' },
  ]);

  return {
    dietary: {
      vegetarian: dietary.vegetarian,
      vegan: dietary.vegan,
      glutenFree: dietary.glutenFree,
      dairyFree: dietary.dairyFree,
      allergies: dietary.allergies ? dietary.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
    },
    food: {
      favoriteIngredients: food.favoriteIngredients.split(',').map(s => s.trim()).filter(Boolean),
      dislikedIngredients: food.dislikedIngredients.split(',').map(s => s.trim()).filter(Boolean),
      preferredCuisines: food.preferredCuisines.split(',').map(s => s.trim()).filter(Boolean),
    },
    maxReadyTime: cooking.maxReadyTime || undefined,
    pantryItems: cooking.pantryItems.split(',').map(s => s.trim()).filter(Boolean),
  };
}

async function exploreRecipeDetails(appRecipes, rankedRecipes) {
  const { selectedRecipe } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedRecipe',
      message: 'Which recipe would you like to explore?',
      choices: appRecipes.map((r, idx) => ({ name: `${r.name} (${rankedRecipes[idx].score.toFixed(3)} score)`, value: idx }))
    }
  ]);

  const recipe = appRecipes[selectedRecipe];
  const ranked = rankedRecipes[selectedRecipe];
  
  console.log(`\n📖 Details for: ${recipe.name}`);
  console.log(`🏆 Overall Score: ${ranked.score.toFixed(3)}`);
  console.log(`📊 Feature Breakdown:`);
  console.log(`   • Similarity: ${ranked.features.sim.toFixed(3)}`);
  console.log(`   • Pantry Match: ${ranked.features.pantry.toFixed(3)}`);
  console.log(`   • Popularity: ${ranked.features.popularity.toFixed(3)}`);
  console.log(`   • Novelty: ${ranked.features.novelty.toFixed(3)}`);
  console.log(`   • Source Bias: ${ranked.features.sourceBias.toFixed(3)}`);
  console.log(`🔗 Source: ${ranked.recipe.source}`);
  console.log(`⏱️ Ready in: ${ranked.recipe.readyInMinutes} minutes`);
  console.log(`👥 Servings: ${ranked.recipe.servings}`);
  console.log(`🥘 Ingredients: ${ranked.recipe.ingredients.map(i => i.name).join(', ')}`);
  console.log(`🏷️ Tags: ${ranked.recipe.tags.join(', ')}`);
}

// Helper functions
function buildDietParam(dietary) {
  const diets = [];
  if (dietary.vegan) diets.push('vegan');
  else if (dietary.vegetarian) diets.push('vegetarian');
  return diets.length ? diets.join(',') : undefined;
}

function buildIntoleranceParam(dietary) {
  const intolerances = [];
  if (dietary.glutenFree) intolerances.push('gluten');
  if (dietary.dairyFree) intolerances.push('dairy');
  if (dietary.allergies) intolerances.push(...dietary.allergies);
  return intolerances.length ? intolerances.join(',') : undefined;
}

function buildUserTokens(preferences) {
  return [
    ...preferences.food.favoriteIngredients || [],
    ...preferences.food.dislikedIngredients || [],
    ...preferences.food.preferredCuisines || [],
  ].flatMap(t => t.split(' '));
}

testNewAlgorithm(); 