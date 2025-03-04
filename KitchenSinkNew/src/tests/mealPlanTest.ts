import { createInterface } from 'readline';
import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { BudgetPreferences, BudgetFrequency } from '../types/BudgetPreferences';
import { generateMealPlan } from '../utils/mealPlanSelector';
import { getRecipesWithCache, clearRecipeCache } from '../utils/recipeApiService';
// Keep mock data imports for fallback
import { mockRecipes } from '../data/mockRecipes';
import { additionalMockRecipes, dessertMockRecipes } from '../data/mockRecipes';
import { allSeasonalRecipes } from '../data/seasonalRecipes';

// Create readline interface for CLI interaction
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Support for command line arguments
const ARGS = process.argv.slice(2);
const USE_API = !ARGS.includes('--use-mock');
const CLEAR_CACHE = ARGS.includes('--clear-cache');

// Function to get recipes (either from API or mock data)
async function getRecipes(preferences: {
  dietary: DietaryPreferences;
  food: FoodPreferences;
  cooking: CookingPreferences;
  budget: BudgetPreferences;
}): Promise<Recipe[]> {
  if (USE_API) {
    try {
      console.log('\nAttempting to fetch recipes from Spoonacular API...');
      
      if (CLEAR_CACHE) {
        console.log('Clearing recipe cache as requested');
        clearRecipeCache();
      }
      
      const apiRecipes = await getRecipesWithCache(preferences);
      
      if (apiRecipes.length > 0) {
        console.log(`Successfully retrieved ${apiRecipes.length} recipes from API/cache`);
        
        // Group recipes by meal type for logging
        const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
        const recipesByType: Record<string, number> = {};
        
        mealTypes.forEach(type => {
          recipesByType[type] = apiRecipes.filter(r => r.tags.includes(type)).length;
        });
        
        console.log('Recipe distribution:');
        Object.entries(recipesByType).forEach(([type, count]) => {
          console.log(`- ${type}: ${count} recipes`);
        });
        
        return apiRecipes;
      } else {
        console.log('No recipes returned from API, falling back to mock data');
        return getAllMockRecipes();
      }
    } catch (error) {
      console.error('Error fetching recipes from API:', error);
      console.log('Falling back to mock data');
      return getAllMockRecipes();
    }
  } else {
    console.log('\nUsing mock recipe data as requested');
    return getAllMockRecipes();
  }
}

// Flatten mock recipes into a single array (for fallback)
function getAllMockRecipes(): Recipe[] {
  const recipes = [
    ...mockRecipes.breakfast,
    ...mockRecipes.lunch,
    ...mockRecipes.dinner,
    ...mockRecipes.snacks,
    ...additionalMockRecipes,
    ...dessertMockRecipes,
    ...(allSeasonalRecipes || [])
  ];
  
  console.log(`Loaded ${recipes.length} mock recipes`);
  return recipes;
}

// Promisify readline question
const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function getDietaryPreferences(): Promise<DietaryPreferences> {
  console.log('\n--- Dietary Preferences ---');
  const vegetarian = (await question('Are you vegetarian? (y/n): ')).toLowerCase() === 'y';
  const vegan = (await question('Are you vegan? (y/n): ')).toLowerCase() === 'y';
  const glutenFree = (await question('Do you require gluten-free meals? (y/n): ')).toLowerCase() === 'y';
  const dairyFree = (await question('Do you require dairy-free meals? (y/n): ')).toLowerCase() === 'y';
  const nutFree = (await question('Do you require nut-free meals? (y/n): ')).toLowerCase() === 'y';
  const lowCarb = (await question('Do you prefer low-carb meals? (y/n): ')).toLowerCase() === 'y';
  
  console.log('\nAllergies (comma separated, e.g., "nuts, shellfish" or press Enter for none):');
  const allergiesStr = await question('> ');
  const allergies = allergiesStr ? allergiesStr.split(',').map(a => a.trim()) : [];
  
  console.log('\nDietary restrictions (comma separated or press Enter for none):');
  const restrictionsStr = await question('> ');
  const restrictions = restrictionsStr ? restrictionsStr.split(',').map(r => r.trim()) : [];
  
  return {
    vegetarian,
    vegan,
    glutenFree,
    dairyFree,
    nutFree,
    lowCarb,
    allergies,
    restrictions
  };
}

async function getFoodPreferences(): Promise<FoodPreferences> {
  console.log('\n--- Food Preferences ---');
  
  console.log('\nFavorite ingredients (comma separated or press Enter for none):');
  const favoritesStr = await question('> ');
  const favoriteIngredients = favoritesStr ? favoritesStr.split(',').map(i => i.trim()) : [];
  
  console.log('\nDisliked ingredients (comma separated or press Enter for none):');
  const dislikedStr = await question('> ');
  const dislikedIngredients = dislikedStr ? dislikedStr.split(',').map(i => i.trim()) : [];
  
  return {
    favoriteIngredients,
    dislikedIngredients
  };
}

async function getCookingPreferences(): Promise<CookingPreferences> {
  console.log('\n--- Cooking Preferences ---');
  
  console.log('\nHow often do you cook?');
  console.log('1: Daily');
  console.log('2: Few times a week');
  console.log('3: Weekends only');
  console.log('4: Rarely');
  const freqChoice = await question('Select (1-4): ');
  const cookingFrequency = ['daily', 'few_times_week', 'weekends_only', 'rarely'][parseInt(freqChoice) - 1 || 0];
  
  console.log('\nPreferred cooking duration:');
  console.log('1: Under 30 minutes');
  console.log('2: 30-60 minutes');
  console.log('3: Over 60 minutes');
  const durationChoice = await question('Select (1-3): ');
  const preferredCookingDuration = ['under_30_min', '30_to_60_min', 'over_60_min'][parseInt(durationChoice) - 1 || 0];
  
  console.log('\nCooking skill level:');
  console.log('1: Beginner');
  console.log('2: Intermediate');
  console.log('3: Advanced');
  const skillChoice = await question('Select (1-3): ');
  const skillLevel = ['beginner', 'intermediate', 'advanced'][parseInt(skillChoice) - 1 || 0];
  
  // Default to all meal types
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks']; 
  
  return {
    cookingFrequency,
    preferredCookingDuration,
    skillLevel,
    mealTypes,
    servingSizePreference: 2,
    weeklyMealPrepCount: 0,
    householdSize: 1
  } as CookingPreferences;
}

async function getBudgetPreferences(): Promise<BudgetPreferences> {
  console.log('\n--- Budget Preferences ---');
  console.log('\nWeekly budget for groceries (number only):');
  const amountStr = await question('$ ');
  const amount = parseFloat(amountStr) || 100;
  
  console.log('\nBudget frequency:');
  console.log('1: Daily');
  console.log('2: Weekly');
  console.log('3: Monthly');
  const freqChoice = await question('Select (1-3): ');
  const frequencyOptions: BudgetFrequency[] = ['daily', 'weekly', 'monthly'];
  const frequency = frequencyOptions[parseInt(freqChoice) - 1 || 1];
  
  return {
    amount,
    frequency
  };
}

// Run automated test with predefined preferences option
async function runAutomatedTest(): Promise<void> {
  console.log('\n=== Running Automated Meal Plan Test ===\n');
  
  // Predefined preferences for testing
  const testPreferences = {
    dietary: {
      vegetarian: false,
      vegan: false,
      glutenFree: true,
      dairyFree: false,
      nutFree: true,
      lowCarb: false,
      allergies: ['shellfish'],
      restrictions: []
    },
    food: {
      favoriteIngredients: ['chicken', 'avocado', 'broccoli'],
      dislikedIngredients: ['mushrooms', 'olives']
    },
    cooking: {
      cookingFrequency: 'few_times_week',
      preferredCookingDuration: 'under_30_min',
      skillLevel: 'intermediate',
      mealTypes: ['breakfast', 'lunch', 'dinner', 'snacks'],
      servingSizePreference: 2,
      weeklyMealPrepCount: 0,
      householdSize: 2
    } as CookingPreferences,
    budget: {
      amount: 150,
      frequency: 'weekly' as BudgetFrequency
    }
  };
  
  const mealCounts = {
    breakfast: 2,
    lunch: 2,
    dinner: 2,
    snacks: 1
  };
  
  console.log('Preferences used for test:');
  console.log(JSON.stringify(testPreferences, null, 2));
  
  try {
    // Get recipes from API or mock data
    const recipes = await getRecipes(testPreferences);
    
    console.log('\nGenerating meal plan...');
    
    // Generate meal plan with retrieved recipes
    const result = await generateMealPlan(
      recipes,
      testPreferences,
      mealCounts
    );
    
    console.log('\n=== Generated Meal Plan ===');
    if (result.constraintsRelaxed) {
      console.log('\n⚠️ Note: Some constraints were relaxed to generate this meal plan.');
      if (result.message) {
        console.log(`Message: ${result.message}`);
      }
    }
    
    console.log('\nTotal Recipes: ', result.recipes.length);
    console.log('-------------------\n');
    
    result.recipes.forEach((recipe, index) => {
      console.log(`${index + 1}. ${recipe.name}`);
      console.log(`   Description: ${recipe.description.substring(0, 100)}...`);
      console.log(`   Prep Time: ${recipe.prepTime}, Cook Time: ${recipe.cookTime}`);
      console.log(`   Estimated Cost: $${recipe.estimatedCost.toFixed(2)}`);
      console.log(`   Tags: ${recipe.tags.join(', ')}`);
      console.log('');
    });
    
    // Calculate total cost
    const totalCost = result.recipes.reduce((sum, recipe) => sum + recipe.estimatedCost, 0);
    console.log(`Total meal plan cost: $${totalCost.toFixed(2)}`);
    
    // Summarize meal types
    const typeCounts = result.recipes.reduce((counts, recipe) => {
      recipe.tags.forEach(tag => {
        if (['breakfast', 'lunch', 'dinner', 'snacks'].includes(tag)) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      });
      return counts;
    }, {} as Record<string, number>);
    
    console.log('\nMeal distribution:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`${type}: ${count} recipe(s)`);
    });
    
  } catch (error) {
    console.error('Error generating meal plan:', error);
  }
}

async function runTest() {
  console.log('\n=== Kitchen Helper Meal Plan Generator Test ===\n');
  console.log('This test will generate a personalized meal plan based on your preferences.');
  console.log(`Recipe source: ${USE_API ? 'Spoonacular API' : 'Mock Data'}`);
  
  console.log('\nWould you like to:');
  console.log('1: Enter preferences manually');
  console.log('2: Run automated test with preset preferences');
  const choice = await question('Select (1 or 2): ');
  
  if (choice === '2') {
    await runAutomatedTest();
    rl.close();
    return;
  }
  
  try {
    // Get user preferences
    const dietaryPreferences = await getDietaryPreferences();
    const foodPreferences = await getFoodPreferences();
    const cookingPreferences = await getCookingPreferences();
    const budgetPreferences = await getBudgetPreferences();
    
    // Set meal counts
    console.log('\n--- Meal Counts ---');
    console.log('How many of each meal type would you like in your plan?');
    const breakfastCount = parseInt(await question('Breakfasts: ')) || 2;
    const lunchCount = parseInt(await question('Lunches: ')) || 2;
    const dinnerCount = parseInt(await question('Dinners: ')) || 2;
    const snacksCount = parseInt(await question('Snacks: ')) || 1;
    
    const mealCounts = {
      breakfast: breakfastCount,
      lunch: lunchCount,
      dinner: dinnerCount,
      snacks: snacksCount
    };

    // Combine all preferences
    const userPreferences = {
      dietary: dietaryPreferences,
      food: foodPreferences,
      cooking: cookingPreferences,
      budget: budgetPreferences
    };
    
    // Get recipes from API or mock data
    const recipes = await getRecipes(userPreferences);
    
    console.log('\nGenerating meal plan...');
    
    // Generate meal plan with retrieved recipes
    const result = await generateMealPlan(
      recipes,
      userPreferences,
      mealCounts
    );
    
    console.log('\n=== Generated Meal Plan ===');
    if (result.constraintsRelaxed) {
      console.log('\n⚠️ Note: Some constraints were relaxed to generate this meal plan.');
      if (result.message) {
        console.log(`Message: ${result.message}`);
      }
    }
    
    console.log('\nTotal Recipes: ', result.recipes.length);
    console.log('-------------------\n');
    
    result.recipes.forEach((recipe, index) => {
      console.log(`${index + 1}. ${recipe.name}`);
      console.log(`   Description: ${recipe.description.substring(0, 100)}...`);
      console.log(`   Prep Time: ${recipe.prepTime}, Cook Time: ${recipe.cookTime}`);
      console.log(`   Estimated Cost: $${recipe.estimatedCost.toFixed(2)}`);
      console.log(`   Tags: ${recipe.tags.join(', ')}`);
      console.log('');
    });
    
    // Calculate total cost
    const totalCost = result.recipes.reduce((sum, recipe) => sum + recipe.estimatedCost, 0);
    console.log(`Total meal plan cost: $${totalCost.toFixed(2)}`);
    
  } catch (error) {
    console.error('Error generating meal plan:', error);
  }
  
  rl.close();
}

// Print usage information if requested
if (ARGS.includes('--help')) {
  console.log('\nKitchen Helper Meal Plan Test');
  console.log('Usage: node mealPlanTest.js [options]');
  console.log('\nOptions:');
  console.log('  --use-mock      Use mock data instead of Spoonacular API');
  console.log('  --clear-cache   Clear existing recipe cache');
  console.log('  --help          Show this help message');
  process.exit(0);
}

// Run the test
runTest(); 