// @ts-nocheck

require('ts-node').register({ transpileOnly: true });

(global).__DEV__ = true;

const inquirer = require('inquirer');
const { generateMealPlan } = require('../src/utils/mealPlanSelector');
const { recipeDatabase } = require('../src/data/recipeDatabase');
const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (request.startsWith('@react-native-firebase')) {
    return {};
  }
  return originalLoad(request, parent, isMain);
};

async function promptPreferences() {
  const basic = await inquirer.prompt([
    { type: 'confirm', name: 'vegetarian', message: 'Vegetarian?', default: false },
    { type: 'confirm', name: 'vegan', message: 'Vegan?', default: false },
    { type: 'confirm', name: 'glutenFree', message: 'Gluten-free?', default: false },
    { type: 'confirm', name: 'dairyFree', message: 'Dairy-free?', default: false },
    { type: 'input', name: 'allergies', message: 'Allergies (comma separated, leave blank if none):' },
  ]);

  const foodQ = await inquirer.prompt([
    { type: 'input', name: 'favoriteIngredients', message: 'Favorite ingredients (comma separated):', default: '' },
    { type: 'input', name: 'dislikedIngredients', message: 'Disliked ingredients (comma separated):', default: '' },
    { type: 'input', name: 'preferredCuisines', message: 'Preferred cuisines (comma separated):', default: '' },
  ]);

  const numbers = await inquirer.prompt([
    { type: 'number', name: 'mealsPerType', message: 'Meals per meal-type (e.g. 3):', default: 3 },
    { type: 'number', name: 'maxReadyTime', message: 'Max total time per recipe (minutes, 0 = no limit):', default: 0 },
  ]);

  const dietary = {
    vegetarian: basic.vegetarian,
    vegan: basic.vegan,
    glutenFree: basic.glutenFree,
    dairyFree: basic.dairyFree,
    nutFree: false,
    allergies: basic.allergies ? basic.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
    lowCarb: false,
    restrictions: [],
  };

  const food = {
    favoriteIngredients: foodQ.favoriteIngredients.split(',').map(s => s.trim()).filter(Boolean),
    dislikedIngredients: foodQ.dislikedIngredients.split(',').map(s => s.trim()).filter(Boolean),
    preferredCuisines: foodQ.preferredCuisines.split(',').map(s => s.trim()).filter(Boolean),
    allergies: [],
  };

  const cooking = {
    mealTypes: ['breakfast', 'lunch', 'dinner', 'snacks'],
    weeklyMealPrepCount: numbers.mealsPerType,
    preferredCookingDuration: numbers.maxReadyTime === 0 ? 'any' : (numbers.maxReadyTime <= 30 ? 'under_30_min' : '30_to_60_min'),
  };

  const budget = { amount: 50, frequency: 'weekly' };

  return { dietary, food, cooking, budget, mealsPerType: numbers.mealsPerType };
}

async function run() {
  console.log('🍽️  Interactive Meal-Plan Generator');
  const prefs = await promptPreferences();

  const mealCounts = {
    breakfast: prefs.mealsPerType,
    lunch: prefs.mealsPerType,
    dinner: prefs.mealsPerType,
    snacks: prefs.mealsPerType,
  };

  console.log('\nGenerating plan, please wait...');
  const result = await generateMealPlan(recipeDatabase, {
    dietary: prefs.dietary,
    food: prefs.food,
    cooking: prefs.cooking,
    budget: prefs.budget,
  }, mealCounts);

  console.log('\n✅ Meal Plan Created!');
  result.recipes.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.name}  [${r.tags.join(', ')}]  (${r.prepTime} prep, ${r.cookTime} cook)`);
  });

  if (result.constraintsRelaxed && result.message) {
    console.log(`\n⚠️  Constraints relaxed: ${result.message}`);
  }
}

run().catch(err => console.error(err)); 