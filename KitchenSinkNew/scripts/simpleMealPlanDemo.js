const inquirer = require('inquirer').default || require('inquirer');

// Mock recipe data to avoid importing from Firebase-dependent modules
const mockRecipes = [
  {
    id: '1',
    name: 'Veggie Scramble',
    description: 'Quick vegetarian breakfast',
    prepTime: '5 mins',
    cookTime: '10 mins',
    servings: 2,
    ingredients: [
      { item: 'eggs', measurement: '3 large' },
      { item: 'spinach', measurement: '1 cup' },
      { item: 'tomato', measurement: '1 medium' }
    ],
    instructions: ['Beat eggs', 'Sauté vegetables', 'Add eggs and scramble'],
    tags: ['breakfast', 'vegetarian'],
    cuisines: ['american'],
    estimatedCost: 4
  },
  {
    id: '2',
    name: 'Chicken Caesar Salad',
    description: 'Classic lunch salad',
    prepTime: '10 mins',
    cookTime: '15 mins',
    servings: 1,
    ingredients: [
      { item: 'chicken breast', measurement: '4 oz' },
      { item: 'romaine lettuce', measurement: '2 cups' },
      { item: 'parmesan cheese', measurement: '2 tbsp' }
    ],
    instructions: ['Grill chicken', 'Chop lettuce', 'Toss with dressing'],
    tags: ['lunch', 'protein'],
    cuisines: ['american'],
    estimatedCost: 8
  },
  {
    id: '3',
    name: 'Spaghetti Marinara',
    description: 'Classic Italian pasta',
    prepTime: '5 mins',
    cookTime: '20 mins',
    servings: 4,
    ingredients: [
      { item: 'spaghetti', measurement: '1 lb' },
      { item: 'marinara sauce', measurement: '2 cups' },
      { item: 'basil', measurement: '2 tbsp' }
    ],
    instructions: ['Boil pasta', 'Heat sauce', 'Combine and serve'],
    tags: ['dinner', 'vegetarian', 'italian'],
    cuisines: ['italian'],
    estimatedCost: 6
  },
  {
    id: '4',
    name: 'Apple Slices with Peanut Butter',
    description: 'Healthy snack',
    prepTime: '2 mins',
    cookTime: '0 mins',
    servings: 1,
    ingredients: [
      { item: 'apple', measurement: '1 medium' },
      { item: 'peanut butter', measurement: '2 tbsp' }
    ],
    instructions: ['Slice apple', 'Serve with peanut butter'],
    tags: ['snacks', 'healthy'],
    cuisines: ['american'],
    estimatedCost: 2
  }
];

// Simple meal plan generator (simplified version)
function generateSimpleMealPlan(recipes, preferences, mealCounts) {
  const selected = [];
  
  // Filter by dietary preferences
  let filteredRecipes = recipes.filter(recipe => {
    if (preferences.dietary.vegetarian && !recipe.tags.includes('vegetarian')) {
      return false;
    }
    if (preferences.dietary.vegan && !recipe.tags.includes('vegan')) {
      return false;
    }
    if (preferences.dietary.glutenFree && !recipe.tags.includes('gluten-free')) {
      return false;
    }
    return true;
  });
  
  // Select recipes for each meal type
  Object.entries(mealCounts).forEach(([mealType, count]) => {
    const mealRecipes = filteredRecipes.filter(r => r.tags.includes(mealType));
    for (let i = 0; i < count && i < mealRecipes.length; i++) {
      selected.push(mealRecipes[i]);
    }
  });
  
  return {
    recipes: selected,
    constraintsRelaxed: selected.length < Object.values(mealCounts).reduce((a, b) => a + b, 0)
  };
}

async function promptPreferences() {
  console.log('🍽️  Interactive Meal-Plan Generator');
  
  const dietary = await inquirer.prompt([
    { type: 'confirm', name: 'vegetarian', message: 'Vegetarian?', default: false },
    { type: 'confirm', name: 'vegan', message: 'Vegan?', default: false },
    { type: 'confirm', name: 'glutenFree', message: 'Gluten-free?', default: false },
  ]);

  const food = await inquirer.prompt([
    { type: 'input', name: 'favoriteIngredients', message: 'Favorite ingredients (comma separated):', default: '' },
    { type: 'input', name: 'dislikedIngredients', message: 'Disliked ingredients (comma separated):', default: '' },
  ]);

  const cooking = await inquirer.prompt([
    { type: 'number', name: 'mealsPerType', message: 'How many meals per type? (e.g. 2):', default: 2 },
  ]);

  return {
    dietary: {
      vegetarian: dietary.vegetarian,
      vegan: dietary.vegan,
      glutenFree: dietary.glutenFree,
    },
    food: {
      favoriteIngredients: food.favoriteIngredients.split(',').map(s => s.trim()).filter(Boolean),
      dislikedIngredients: food.dislikedIngredients.split(',').map(s => s.trim()).filter(Boolean),
    },
    mealsPerType: cooking.mealsPerType
  };
}

async function run() {
  try {
    const prefs = await promptPreferences();

    const mealCounts = {
      breakfast: prefs.mealsPerType,
      lunch: prefs.mealsPerType,
      dinner: prefs.mealsPerType,
      snacks: prefs.mealsPerType,
    };

    console.log('\n🔍 Generating meal plan...');
    console.log(`📋 Your preferences: ${JSON.stringify(prefs.dietary, null, 2)}`);
    
    const result = generateSimpleMealPlan(mockRecipes, prefs, mealCounts);

    console.log('\n✅ Meal Plan Created!');
    console.log(`📊 Generated ${result.recipes.length} recipes:\n`);
    
    result.recipes.forEach((recipe, idx) => {
      console.log(`${idx + 1}. 🍽️  ${recipe.name}`);
      console.log(`   📝 ${recipe.description}`);
      console.log(`   🏷️  [${recipe.tags.join(', ')}]`);
      console.log(`   ⏱️  ${recipe.prepTime} prep + ${recipe.cookTime} cook`);
      console.log(`   💰 $${recipe.estimatedCost}`);
      console.log(`   🥘 Ingredients: ${recipe.ingredients.map(i => i.item).join(', ')}`);
      console.log('');
    });

    if (result.constraintsRelaxed) {
      console.log('⚠️  Note: Not enough recipes found to meet all requested meal counts');
    }

    // Ask if user wants to see details of a specific recipe
    if (result.recipes.length > 0) {
      const { showDetails } = await inquirer.prompt([
        { type: 'confirm', name: 'showDetails', message: 'Would you like to see cooking instructions for any recipe?', default: false }
      ]);

      if (showDetails) {
        const { selectedRecipe } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedRecipe',
            message: 'Which recipe?',
            choices: result.recipes.map((r, idx) => ({ name: r.name, value: idx }))
          }
        ]);

        const recipe = result.recipes[selectedRecipe];
        console.log(`\n📖 Instructions for ${recipe.name}:`);
        recipe.instructions.forEach((step, idx) => {
          console.log(`${idx + 1}. ${step}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

run(); 