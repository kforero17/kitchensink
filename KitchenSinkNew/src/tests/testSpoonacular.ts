import fetch from 'node-fetch';
import https from 'https';
import {
  SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL,
  SPOONACULAR_RECIPES_ENDPOINT,
} from './testConfig';

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  imageType: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  pricePerServing: number;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  sustainable: boolean;
  analyzedInstructions: {
    steps: {
      number: number;
      step: string;
      ingredients: { id: number; name: string; }[];
    }[];
  }[];
}

interface SearchRecipesResponse {
  results: SpoonacularRecipe[];
  offset: number;
  number: number;
  totalResults: number;
}

const agent = new https.Agent({
  rejectUnauthorized: false
});

const createSpoonacularUrl = (endpoint: string, queryParams: Record<string, string> = {}) => {
  const url = new URL(`${SPOONACULAR_BASE_URL}${endpoint}`);
  url.searchParams.append('apiKey', SPOONACULAR_API_KEY);
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return url.toString();
};

const searchRecipes = async (
  preferences: {
    diet?: string[];
    intolerances?: string[];
    excludeIngredients?: string[];
    maxReadyTime?: number;
    number?: number;
  }
): Promise<SearchRecipesResponse> => {
  const queryParams: Record<string, string> = {
    addRecipeInformation: 'true',
    fillIngredients: 'true',
    number: (preferences.number || 10).toString(),
  };

  if (preferences.diet?.length) {
    queryParams.diet = preferences.diet.join(',');
  }

  if (preferences.intolerances?.length) {
    queryParams.intolerances = preferences.intolerances.join(',');
  }

  if (preferences.excludeIngredients?.length) {
    queryParams.excludeIngredients = preferences.excludeIngredients.join(',');
  }

  if (preferences.maxReadyTime) {
    queryParams.maxReadyTime = preferences.maxReadyTime.toString();
  }

  const url = createSpoonacularUrl(`${SPOONACULAR_RECIPES_ENDPOINT}/complexSearch`, queryParams);

  try {
    const response = await fetch(url, { agent });
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching recipes:', error);
    throw error;
  }
};

const testRecipeSearch = async () => {
  console.log('Testing Spoonacular API with mock user preferences...\n');

  // Mock user preferences
  const mockPreferences = {
    diet: ['vegetarian'],
    intolerances: ['dairy'],
    excludeIngredients: ['olives'],
    maxReadyTime: 60, // Maximum cooking time of 60 minutes
    number: 5 // Get 5 recipes for testing
  };

  try {
    console.log('Searching for recipes with the following preferences:');
    console.log('- Vegetarian');
    console.log('- Dairy-free');
    console.log('- No olives');
    console.log('- Ready in under 60 minutes\n');

    const response = await searchRecipes(mockPreferences);

    console.log(`Found ${response.totalResults} total matching recipes`);
    console.log(`Displaying ${response.results.length} recipes:\n`);

    response.results.forEach((recipe: SpoonacularRecipe, index: number) => {
      console.log(`Recipe ${index + 1}: ${recipe.title}`);
      console.log(`Ready in: ${recipe.readyInMinutes} minutes`);
      console.log(`Servings: ${recipe.servings}`);
      console.log(`Price per serving: $${(recipe.pricePerServing / 100).toFixed(2)}`);
      console.log(`Source URL: ${recipe.sourceUrl}`);
      console.log('Dietary Info:');
      console.log(`- Vegetarian: ${recipe.vegetarian ? 'Yes' : 'No'}`);
      console.log(`- Vegan: ${recipe.vegan ? 'Yes' : 'No'}`);
      console.log(`- Dairy-free: ${recipe.dairyFree ? 'Yes' : 'No'}`);
      console.log(`- Gluten-free: ${recipe.glutenFree ? 'Yes' : 'No'}\n`);

      if (recipe.analyzedInstructions?.[0]?.steps?.length > 0) {
        console.log('First 3 steps:');
        recipe.analyzedInstructions[0].steps
          .slice(0, 3)
          .forEach(step => {
            console.log(`${step.number}. ${step.step}`);
          });
        console.log('...\n');
      } else {
        console.log('No detailed instructions available.\n');
      }

      console.log('-'.repeat(50) + '\n');
    });

  } catch (error) {
    console.error('Error during recipe search:', error);
  }
};

// Run the test
testRecipeSearch(); 