// @ts-nocheck

(global as any).__DEV__ = true;

import inquirer from 'inquirer';
import { generateMealPlan } from '../src/utils/mealPlanSelector';
import { recipeDatabase } from '../src/data/recipeDatabase';
import { DietaryPreferences } from '../src/types/DietaryPreferences';
import { FoodPreferences } from '../src/types/FoodPreferences';
import { CookingPreferences } from '../src/types/CookingPreferences';
import { BudgetPreferences } from '../src/types/BudgetPreferences';

async function promptPreferences() {
  const { vegetarian, vegan, glutenFree, dairyFree } = await inquirer.prompt([
    { type: 'confirm', name: 'vegetarian', message: 'Vegetarian?', default: false },
    { type: 'confirm', name: 'vegan', message: 'Vegan?', default: false },
    { type: 'confirm', name: 'glutenFree', message: 'Gluten-free?', default: false },
    { type: 'confirm', name: 'dairyFree', message: 'Dairy-free?', default: false },
  ]);

  const { allergies } = await inquirer.prompt([
    { type: 'input', name: 'allergies', message: 'Allergies (comma separated, leave blank if none):' },
  ]);

  const dietary: DietaryPreferences = {
    vegetarian,
    vegan,
    glutenFree,
    dairyFree,
    nutFree: false,
    allergies: allergies ? allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
    lowCarb: false,
    restrictions: [],
  };

  const { favoriteIngredients, dislikedIngredients, preferredCuisines } = await inquirer.prompt([
    { type: 'input', name: 'favoriteIngredients', message: 'Favorite ingredients (comma separated):', default: '' },
    { type: 'input', name: 'dislikedIngredients', message: 'Disliked ingredients (comma separated):', default: '' },
    { type: 'input', name: 'preferredCuisines', message: 'Preferred cuisines (comma separated):', default: '' },
  ]);

  const food: FoodPreferences = {
    favoriteIngredients: favoriteIngredients.split(',').map(s => s.trim()).filter(Boolean),
    dislikedIngredients: dislikedIngredients.split(',').map(s => s.trim()).filter(Boolean),
    preferredCuisines: preferredCuisines.split(',').map(s => s.trim()).filter(Boolean),
    allergies: [],
  } as any;

  const { mealsPerType, maxReadyTime } = await inquirer.prompt([
    { type: 'number', name: 'mealsPerType', message: 'Meals per meal-type (e.g. 3):', default: 3 },
    { type: 'number', name: 'maxReadyTime', message: 'Max total time per recipe (minutes, 0 = no limit):', default: 0 },
  ]);

  const cooking: CookingPreferences = {
    mealTypes: ['breakfast', 'lunch', 'dinner', 'snacks'] as any,
    weeklyMealPrepCount: mealsPerType,
    preferredCookingDuration: maxReadyTime === 0 ? 'any' as any : (maxReadyTime <= 30 ? 'under_30_min' : '30_to_60_min'),
  } as any;

  const budget: BudgetPreferences = { amount: 50, frequency: 'weekly' } as any;

  return { dietary, food, cooking, budget, mealsPerType };
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

run().catch(err => {
  console.error('Error:', err);
}); 