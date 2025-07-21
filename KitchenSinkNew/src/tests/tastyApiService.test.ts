import { fetchTastyRecipesViaApi, clearTastyApiCache, getTastyApiCacheStats, resetRecentlyFetchedIds } from '../services/tastyApiService';

// Mock the network service
jest.mock('../utils/networkService', () => ({
  networkService: {
    get: jest.fn()
  }
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock the environment
jest.mock('../config/environment', () => ({
  ENV: {
    TASTY_FUNCTION_URL: 'https://test-url.com/getRecipes'
  }
}));

// Mock the recipe mapper
jest.mock('../mappers/recipeMappers', () => ({
  mapTastyRecipeToUnified: jest.fn((recipe: any) => ({
    id: recipe.id,
    title: recipe.name,
    source: 'tasty',
    tags: recipe.tags || []
  }))
}));

describe('TastyApiService', () => {
  const mockNetworkService = require('../utils/networkService').networkService;
  const mockMapTastyRecipeToUnified = require('../mappers/recipeMappers').mapTastyRecipeToUnified;

  beforeEach(() => {
    // Clear all mocks and cache before each test
    jest.clearAllMocks();
    clearTastyApiCache();
  });

  describe('fetchTastyRecipesViaApi', () => {
    it('should fetch recipes and apply deduplication', async () => {
      // Mock response with duplicate recipes
      const mockResponse = {
        data: {
          recipes: [
            { id: 'recipe1', name: 'Recipe 1', tags: ['breakfast'] },
            { id: 'recipe2', name: 'Recipe 2', tags: ['lunch'] },
            { id: 'recipe1', name: 'Recipe 1', tags: ['breakfast'] }, // Duplicate
            { id: 'recipe3', name: 'Recipe 3', tags: ['dinner'] }
          ]
        }
      };

      mockNetworkService.get.mockResolvedValue(mockResponse);

      const params = {
        mealType: 'breakfast',
        diet: 'vegetarian'
      };

      const result = await fetchTastyRecipesViaApi(params);

      // Should have 3 unique recipes (duplicate removed)
      expect(result).toHaveLength(3);
      expect(result.map(r => r.id)).toEqual(['recipe1', 'recipe2', 'recipe3']);

      // Verify network service was called
      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });

    it('should use cache for subsequent calls with same parameters', async () => {
      // Mock response
      const mockResponse = {
        data: {
          recipes: [
            { id: 'recipe1', name: 'Recipe 1', tags: ['breakfast'] },
            { id: 'recipe2', name: 'Recipe 2', tags: ['lunch'] }
          ]
        }
      };

      mockNetworkService.get.mockResolvedValue(mockResponse);

      const params = {
        mealType: 'breakfast'
      };

      // First call
      const result1 = await fetchTastyRecipesViaApi(params);
      expect(result1).toHaveLength(2);

      // Second call with same parameters
      const result2 = await fetchTastyRecipesViaApi(params);
      expect(result2).toHaveLength(0); // Should be filtered out as recently fetched

      // Network service should only be called once (second call uses cache)
      expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    });

    it('should filter out recently fetched recipes', async () => {
      // Mock response
      const mockResponse = {
        data: {
          recipes: [
            { id: 'recipe1', name: 'Recipe 1', tags: ['breakfast'] },
            { id: 'recipe2', name: 'Recipe 2', tags: ['lunch'] }
          ]
        }
      };

      mockNetworkService.get.mockResolvedValue(mockResponse);

      const params = {
        mealType: 'breakfast'
      };

      // First call
      const result1 = await fetchTastyRecipesViaApi(params);
      expect(result1).toHaveLength(2);

      // Reset recently fetched IDs
      resetRecentlyFetchedIds();

      // Second call should return recipes again
      const result2 = await fetchTastyRecipesViaApi(params);
      expect(result2).toHaveLength(2);

      // Network service should be called twice
      expect(mockNetworkService.get).toHaveBeenCalledTimes(2);
    });

    it('should include seed parameter for variety', async () => {
      const mockResponse = {
        data: {
          recipes: [
            { id: 'recipe1', name: 'Recipe 1', tags: ['breakfast'] }
          ]
        }
      };

      mockNetworkService.get.mockResolvedValue(mockResponse);

      const params = {
        mealType: 'breakfast'
      };

      await fetchTastyRecipesViaApi(params);

      // Verify the URL includes a seed parameter
      const callArgs = mockNetworkService.get.mock.calls[0][0];
      expect(callArgs).toContain('seed=');
    });

    it('should handle API errors gracefully', async () => {
      mockNetworkService.get.mockRejectedValue(new Error('API Error'));

      const params = {
        mealType: 'breakfast'
      };

      await expect(fetchTastyRecipesViaApi(params)).rejects.toThrow('API Error');
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = getTastyApiCacheStats();
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('recentIdsSize');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.recentIdsSize).toBe('number');
    });

    it('should clear cache when requested', () => {
      clearTastyApiCache();
      const stats = getTastyApiCacheStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.recentIdsSize).toBe(0);
    });
  });
}); 