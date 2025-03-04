# Kitchen Helper - Meal Planning Application

This application helps users create personalized meal plans based on their dietary preferences, cooking habits, and budget constraints.

## API Integration with Spoonacular

The meal planning system has been enhanced to use the Spoonacular API to access thousands of real recipes, while still supporting the original mock data for testing.

### Features

- User preference-based recipe search via Spoonacular API
- Smart user-based recipe caching to reduce API calls
- Seamless integration with existing meal plan selection algorithm
- Fallback to mock data when API unavailable or for testing
- Command-line options for controlling API usage and cache

### Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the project root with your Spoonacular API key:
   ```
   SPOONACULAR_API_KEY=your_api_key_here
   SPOONACULAR_BASE_URL=https://api.spoonacular.com
   SPOONACULAR_INGREDIENTS_ENDPOINT=/food/ingredients
   SPOONACULAR_RECIPES_ENDPOINT=/recipes
   ```

### Running the Meal Plan Generator

The meal plan generator can be run in different modes:

1. With API integration (default):
   ```
   npm run test:mealplan
   ```

2. With mock data only:
   ```
   npm run test:mealplan:mock
   ```

3. Clear cache and use API:
   ```
   npm run test:mealplan:clear-cache
   ```

4. Test the Spoonacular API directly:
   ```
   npm run test:api
   ```

### Command Line Options

The meal plan tester supports the following command line options:

- `--use-mock`: Use mock recipe data instead of the API
- `--clear-cache`: Clear existing recipe cache before running
- `--help`: Show help message

### How It Works

1. The system gathers user preferences for dietary needs, ingredient preferences, cooking habits, and budget.
2. These preferences are translated to Spoonacular API parameters.
3. The API is called to fetch matching recipes, which are stored in a user-specific cache.
4. The meal plan selection algorithm uses these recipes to create an optimized meal plan.
5. If the API is unavailable or returns insufficient results, the system falls back to mock data.

### Data Flow

```
User Preferences
       ↓
API Parameter Mapping
       ↓
Check User-Specific Cache → [If valid] → Use Cached Recipes
       ↓ [If invalid/missing]
Spoonacular API Call
       ↓
Convert API Recipes to App Format
       ↓
Store in Cache
       ↓
Apply Meal Plan Selection Algorithm
       ↓
Optimized Meal Plan
```

### Caching Strategy

Recipes are cached based on a hash of the user preferences, with a 24-hour expiration. This approach:
- Reduces API calls for similar preference profiles
- Maintains fresh data by refreshing expired caches
- Provides resilience by using cached data when API calls fail
- Supports testing without API dependencies

## Development

### Project Structure

- `src/utils/recipeApiService.ts`: Handles API integration and caching
- `src/utils/mealPlanSelector.ts`: Contains the meal plan selection algorithm
- `src/tests/mealPlanTest.ts`: Interactive test script for meal planning
- `src/utils/loadEnv.ts`: Utility for loading environment variables 