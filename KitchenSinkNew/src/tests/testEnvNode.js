/**
 * Simple Node.js test for environment variables
 */

// Load environment variables from .env file
require('dotenv').config();

console.log('\nEnvironment Variables Test (Node.js):');
console.log('---------------------------');
console.log('SPOONACULAR_API_KEY:', process.env.SPOONACULAR_API_KEY);
console.log('SPOONACULAR_BASE_URL:', process.env.SPOONACULAR_BASE_URL);
console.log('SPOONACULAR_INGREDIENTS_ENDPOINT:', process.env.SPOONACULAR_INGREDIENTS_ENDPOINT);
console.log('SPOONACULAR_RECIPES_ENDPOINT:', process.env.SPOONACULAR_RECIPES_ENDPOINT);
console.log('---------------------------');

// Check if variables are defined
const isApiKeyDefined = !!process.env.SPOONACULAR_API_KEY;
const isBaseUrlDefined = !!process.env.SPOONACULAR_BASE_URL;
const isIngredientsEndpointDefined = !!process.env.SPOONACULAR_INGREDIENTS_ENDPOINT;
const isRecipesEndpointDefined = !!process.env.SPOONACULAR_RECIPES_ENDPOINT;

// Count defined variables
const definedCount = [
  isApiKeyDefined,
  isBaseUrlDefined,
  isIngredientsEndpointDefined,
  isRecipesEndpointDefined
].filter(Boolean).length;

console.log(`\nStatus: ${definedCount}/4 variables defined`);

// Output success/warning message
if (definedCount === 4) {
  console.log('✅ All environment variables are properly defined');
} else {
  console.log('⚠️ Some environment variables are missing');
  
  // Provide guidance
  console.log('\nMake sure your .env file contains:');
  console.log('SPOONACULAR_API_KEY=your_api_key_here');
  console.log('SPOONACULAR_BASE_URL=https://api.spoonacular.com');
  console.log('SPOONACULAR_INGREDIENTS_ENDPOINT=/food/ingredients');
  console.log('SPOONACULAR_RECIPES_ENDPOINT=/recipes');
}

// Return success status for scripts
process.exit(definedCount === 4 ? 0 : 1); 