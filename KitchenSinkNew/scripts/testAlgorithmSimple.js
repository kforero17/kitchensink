const inquirer = require('inquirer').default || require('inquirer');

// Mock the actual algorithm components for testing
const mockUnifiedRecipes = [
  {
    id: 'tasty-1',
    source: 'tasty',
    title: 'Chicken Parmesan',
    imageUrl: 'https://example.com/chicken-parm.jpg',
    readyInMinutes: 35,
    servings: 4,
    ingredients: [
      { name: 'chicken breast', amount: 2, unit: 'pieces' },
      { name: 'parmesan cheese', amount: 0.5, unit: 'cup' },
      { name: 'tomato sauce', amount: 1, unit: 'cup' }
    ],
    tags: ['dinner', 'italian', 'comfort-food'],
    nutrition: { calories: 450, protein: 35, fat: 15, carbs: 25 },
    popularityScore: 0.8
  },
  {
    id: 'spn-123',
    source: 'spoonacular',
    title: 'Vegetarian Pasta Primavera',
    imageUrl: 'https://example.com/pasta-primavera.jpg',
    readyInMinutes: 25,
    servings: 3,
    ingredients: [
      { name: 'pasta', amount: 8, unit: 'oz' },
      { name: 'bell peppers', amount: 2, unit: 'pieces' },
      { name: 'zucchini', amount: 1, unit: 'medium' },
      { name: 'olive oil', amount: 2, unit: 'tbsp' }
    ],
    tags: ['dinner', 'vegetarian', 'italian'],
    nutrition: { calories: 320, protein: 12, fat: 8, carbs: 55 },
    popularityScore: 0.6
  },
  {
    id: 'tasty-2',
    source: 'tasty',
    title: 'Garlic Butter Shrimp',
    imageUrl: 'https://example.com/garlic-shrimp.jpg',
    readyInMinutes: 15,
    servings: 2,
    ingredients: [
      { name: 'shrimp', amount: 1, unit: 'lb' },
      { name: 'garlic', amount: 4, unit: 'cloves' },
      { name: 'butter', amount: 3, unit: 'tbsp' }
    ],
    tags: ['dinner', 'seafood', 'quick'],
    nutrition: { calories: 280, protein: 25, fat: 18, carbs: 3 },
    popularityScore: 0.9
  }
];

// Mock candidate generation
function mockGenerateRecipeCandidates(options) {
  console.log('🔍 Candidate Generation Options:', JSON.stringify(options, null, 2));
  
  let candidates = [...mockUnifiedRecipes];
  
  // Filter by diet
  if (options.diet) {
    const diets = options.diet.split(',');
    candidates = candidates.filter(recipe => {
      if (diets.includes('vegetarian')) {
        return recipe.tags.includes('vegetarian');
      }
      return true;
    });
  }
  
  // Filter by max ready time
  if (options.maxReadyTime) {
    candidates = candidates.filter(recipe => recipe.readyInMinutes <= options.maxReadyTime);
  }
  
  // Filter by cuisine
  if (options.cuisine) {
    const cuisines = options.cuisine.split(',');
    candidates = candidates.filter(recipe => 
      cuisines.some(cuisine => recipe.tags.includes(cuisine))
    );
  }
  
  console.log(`✅ Generated ${candidates.length} candidates after filtering`);
  return Promise.resolve(candidates);
}

// Mock ranking
function mockRankRecipes(recipes, options) {
  console.log('🏆 Ranking Options:', JSON.stringify(options, null, 2));
  
  const scored = recipes.map(recipe => {
    let score = 0;
    
    // Similarity score based on user tokens
    const userTokens = options.userTokens || [];
    const recipeTokens = [...recipe.tags, ...recipe.ingredients.map(i => i.name)];
    const matches = userTokens.filter(token => 
      recipeTokens.some(recipeToken => recipeToken.toLowerCase().includes(token.toLowerCase()))
    );
    const simScore = matches.length / Math.max(userTokens.length, 1);
    
    // Pantry match score
    const pantryIngredients = options.pantryIngredients || [];
    const pantryMatches = recipe.ingredients.filter(ing => 
      pantryIngredients.some(pantryItem => 
        ing.name.toLowerCase().includes(pantryItem.toLowerCase())
      )
    );
    const pantryScore = pantryMatches.length / recipe.ingredients.length;
    
    // Popularity score
    const popularityScore = recipe.popularityScore || 0;
    
    // Novelty (inverse of popularity for variety)
    const noveltyScore = 1 - popularityScore;
    
    // Source bias (prefer Tasty slightly)
    const sourceBias = recipe.source === 'tasty' ? 0.1 : (options.spoonacularBias || 0);
    
    // Combine scores
    score = simScore * 0.4 + pantryScore * 0.3 + popularityScore * 0.2 + noveltyScore * 0.05 + sourceBias * 0.05;
    
    return {
      recipe,
      features: {
        sim: simScore,
        pantry: pantryScore,
        popularity: popularityScore,
        novelty: noveltyScore,
        sourceBias: sourceBias
      },
      score
    };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  console.log(`✅ Ranked ${scored.length} recipes`);
  return scored;
}

// Mock conversion to app format
function mockUnifiedToAppRecipe(unifiedRecipe) {
  return {
    id: unifiedRecipe.id,
    name: unifiedRecipe.title,
    description: `Delicious ${unifiedRecipe.tags.join(' ')} recipe`,
    prepTime: '10 mins',
    cookTime: `${unifiedRecipe.readyInMinutes - 10} mins`,
    servings: unifiedRecipe.servings,
    ingredients: unifiedRecipe.ingredients.map(ing => ({
      item: ing.name,
      measurement: `${ing.amount} ${ing.unit}`
    })),
    instructions: ['Prep ingredients', 'Cook according to recipe', 'Serve hot'],
    imageUrl: unifiedRecipe.imageUrl,
    tags: unifiedRecipe.tags,
    cuisines: unifiedRecipe.tags.filter(tag => ['italian', 'american', 'mexican'].includes(tag)),
    estimatedCost: Math.round(unifiedRecipe.servings * 3 + Math.random() * 5)
  };
}

async function testNewAlgorithm() {
  try {
    console.log('🧪 Testing New Recipe Generation Algorithm\n');
    
    // Get user preferences
    const preferences = await promptUserPreferences();
    
    console.log('\n🔍 Step 1: Generating Recipe Candidates...');
    console.log('📋 Using preferences:', JSON.stringify(preferences, null, 2));
    
    // Step 1: Generate candidates
    const candidates = await mockGenerateRecipeCandidates({
      userEmbedding: [],
      diet: buildDietParam(preferences.dietary),
      intolerances: buildIntoleranceParam(preferences.dietary),
      cuisine: preferences.food.preferredCuisines?.join(',') || undefined,
      pantryTopK: preferences.pantryItems || [],
      maxReadyTime: preferences.maxReadyTime || undefined,
    });
    
    candidates.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.title} (${recipe.source}) - ${recipe.readyInMinutes}min`);
    });
    
    console.log('\n🏆 Step 2: Ranking Recipes...');
    
    // Step 2: Rank the candidates
    const ranked = mockRankRecipes(candidates, {
      userTokens: buildUserTokens(preferences),
      pantryIngredients: preferences.pantryItems || [],
      spoonacularBias: -0.05,
    });
    
    console.log('\n🥇 Top Ranked Recipes:');
    ranked.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.recipe.title} (Score: ${item.score.toFixed(3)})`);
      console.log(`      📊 Features: sim=${item.features.sim.toFixed(2)}, pantry=${item.features.pantry.toFixed(2)}, pop=${item.features.popularity.toFixed(2)}`);
    });
    
    console.log('\n🍽️ Step 3: Converting to App Format...');
    
    // Step 3: Convert to app recipe format
    const appRecipes = ranked.map(item => mockUnifiedToAppRecipe(item.recipe));
    
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
        await exploreRecipeDetails(appRecipes, ranked);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing algorithm:', error);
  }
}

async function promptUserPreferences() {
  const dietary = await inquirer.prompt([
    { type: 'confirm', name: 'vegetarian', message: 'Vegetarian?', default: false },
    { type: 'confirm', name: 'vegan', message: 'Vegan?', default: false },
    { type: 'confirm', name: 'glutenFree', message: 'Gluten-free?', default: false },
    { type: 'confirm', name: 'dairyFree', message: 'Dairy-free?', default: false },
  ]);

  const food = await inquirer.prompt([
    { type: 'input', name: 'favoriteIngredients', message: 'Favorite ingredients (comma separated):', default: 'chicken,pasta,garlic' },
    { type: 'input', name: 'dislikedIngredients', message: 'Disliked ingredients (comma separated):', default: '' },
    { type: 'input', name: 'preferredCuisines', message: 'Preferred cuisines (comma separated):', default: 'italian' },
  ]);

  const cooking = await inquirer.prompt([
    { type: 'number', name: 'maxReadyTime', message: 'Max cooking time (minutes, 0 = no limit):', default: 45 },
    { type: 'input', name: 'pantryItems', message: 'Items in your pantry (comma separated):', default: 'garlic,olive oil,butter' },
  ]);

  return {
    dietary: {
      vegetarian: dietary.vegetarian,
      vegan: dietary.vegan,
      glutenFree: dietary.glutenFree,
      dairyFree: dietary.dairyFree,
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
      choices: appRecipes.map((r, idx) => ({ 
        name: `${r.name} (Score: ${rankedRecipes[idx].score.toFixed(3)})`, 
        value: idx 
      }))
    }
  ]);

  const recipe = appRecipes[selectedRecipe];
  const ranked = rankedRecipes[selectedRecipe];
  
  console.log(`\n📖 Details for: ${recipe.name}`);
  console.log(`🏆 Overall Score: ${ranked.score.toFixed(3)}`);
  console.log(`📊 Feature Breakdown:`);
  console.log(`   • Similarity: ${ranked.features.sim.toFixed(3)} (matches your preferences)`);
  console.log(`   • Pantry Match: ${ranked.features.pantry.toFixed(3)} (uses your pantry items)`);
  console.log(`   • Popularity: ${ranked.features.popularity.toFixed(3)} (how well-liked it is)`);
  console.log(`   • Novelty: ${ranked.features.novelty.toFixed(3)} (try something new)`);
  console.log(`   • Source Bias: ${ranked.features.sourceBias.toFixed(3)} (source preference)`);
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