import { 
  fetchUnifiedRecipesFromSpoonacular, 
  clearSpoonacularApiCache, 
  getSpoonacularApiCacheStats, 
  resetSpoonacularRecentlyFetchedIds 
} from '../services/unifiedRecipeService';

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

// Mock the Spoonacular config
jest.mock('../config/spoonacular', () => ({
  SPOONACULAR_CONFIG: {
    API_KEY: 'test-api-key',
    BASE_URL: 'https://api.spoonacular.com',
    ENDPOINTS: {
      RECIPES: '/recipes'
    }
  },
  createSpoonacularUrl: jest.fn((endpoint, params) => {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `https://api.spoonacular.com${endpoint}?${queryString}`;
  })
}));

// Mock the recipe mapper
jest.mock('../mappers/recipeMappers', () => ({
  mapSpoonacularRecipeToUnified: jest.fn((recipe: any) => ({
    id: `spn-${recipe.id}`,
    title: recipe.title,
    source: 'spoonacular',
    tags: recipe.tags || []
  }))
}));

describe('SpoonacularApiService', () => {
  const mockNetworkService = require('../utils/networkService').networkService;
  const mockMapSpoonacularRecipeToUnified = require('../mappers/recipeMappers').mapSpoonacularRecipeToUnified;

  beforeEach(() => {
    // Clear all mocks and cache before each test
    jest.clearAllMocks();
    clearSpoonacularApiCache();
  });

  describe('fetchUnifiedRecipesFromSpoonacular', () => {
    it('should fetch recipes and apply deduplication', async () => {
      // Mock search response
      const mockSearchResponse = {
        data: {
          results: [
            { id: 1 },
            { id: 2 },
            { id: 3 }
          ]
        }
      };

      // Mock individual recipe responses
      const mockRecipeResponses = [
        { id: 1, title: 'Recipe 1', tags: ['breakfast'] },
        { id: 2, title: 'Recipe 2', tags: ['lunch'] },
        { id: 3, title: 'Recipe 3', tags: ['dinner'] }
      ];

      mockNetworkService.get
        .mockResolvedValueOnce(mockSearchResponse) // Search call
        .mockResolvedValueOnce({ data: mockRecipeResponses[0] }) // Recipe 1
        .mockResolvedValueOnce({ data: mockRecipeResponses[1] }) // Recipe 2
        .mockResolvedValueOnce({ data: mockRecipeResponses[2] }); // Recipe 3

      const params = {
        diet: 'vegetarian',
        number: 10
      };

      const result = await fetchUnifiedRecipesFromSpoonacular(params);

      // Should have 3 unique recipes
      expect(result).toHaveLength(3);
      expect(result.map(r => r.id)).toEqual(['spn-1', 'spn-2', 'spn-3']);

      // Verify network service was called for search + 3 individual recipes
      expect(mockNetworkService.get).toHaveBeenCalledTimes(4);
    });

    it('should use cache for subsequent calls with same parameters', async () => {
      // Mock search response
      const mockSearchResponse = {
        data: {
          results: [
            { id: 1 },
            { id: 2 }
          ]
        }
      };

      // Mock individual recipe responses
      const mockRecipeResponses = [
        { id: 1, title: 'Recipe 1', tags: ['breakfast'] },
        { id: 2, title: 'Recipe 2', tags: ['lunch'] }
      ];

      mockNetworkService.get
        .mockResolvedValueOnce(mockSearchResponse) // Search call
        .mockResolvedValueOnce({ data: mockRecipeResponses[0] }) // Recipe 1
        .mockResolvedValueOnce({ data: mockRecipeResponses[1] }); // Recipe 2

      const params = {
        diet: 'vegetarian',
        number: 10
      };

      // First call
      const result1 = await fetchUnifiedRecipesFromSpoonacular(params);
      expect(result1).toHaveLength(2);

      // Second call with same parameters
      const result2 = await fetchUnifiedRecipesFromSpoonacular(params);
      expect(result2).toHaveLength(0); // Should be filtered out as recently fetched

      // Network service should only be called once (second call uses cache)
      expect(mockNetworkService.get).toHaveBeenCalledTimes(3); // Search + 2 recipes
    });

    it('should filter out recently fetched recipes', async () => {
      // Mock search response
      const mockSearchResponse = {
        data: {
          results: [
            { id: 1 },
            { id: 2 }
          ]
        }
      };

      // Mock individual recipe responses
      const mockRecipeResponses = [
        { id: 1, title: 'Recipe 1', tags: ['breakfast'] },
        { id: 2, title: 'Recipe 2', tags: ['lunch'] }
      ];

      mockNetworkService.get
        .mockResolvedValueOnce(mockSearchResponse) // Search call
        .mockResolvedValueOnce({ data: mockRecipeResponses[0] }) // Recipe 1
        .mockResolvedValueOnce({ data: mockRecipeResponses[1] }); // Recipe 2

      const params = {
        diet: 'vegetarian',
        number: 10
      };

      // First call
      const result1 = await fetchUnifiedRecipesFromSpoonacular(params);
      expect(result1).toHaveLength(2);

      // Reset recently fetched IDs
      resetSpoonacularRecentlyFetchedIds();

      // Second call should return recipes again
      const result2 = await fetchUnifiedRecipesFromSpoonacular(params);
      expect(result2).toHaveLength(2);

      // Network service should be called twice
      expect(mockNetworkService.get).toHaveBeenCalledTimes(6); // 2 * (search + 2 recipes)
    });

    it('should include variety parameters (offset, sort, sortDirection)', async () => {
      // Mock search response
      const mockSearchResponse = {
        data: {
          results: [
            { id: 1 }
          ]
        }
      };

      // Mock individual recipe response
      const mockRecipeResponse = {
        id: 1,
        title: 'Recipe 1',
        tags: ['breakfast']
      };

      mockNetworkService.get
        .mockResolvedValueOnce(mockSearchResponse) // Search call
        .mockResolvedValueOnce({ data: mockRecipeResponse }); // Recipe 1

      const params = {
        diet: 'vegetarian',
        number: 10
      };

      await fetchUnifiedRecipesFromSpoonacular(params);

      // Verify the search URL includes variety parameters
      const searchCallArgs = mockNetworkService.get.mock.calls[0][0];
      expect(searchCallArgs).toContain('offset=');
      expect(searchCallArgs).toContain('sort=');
      expect(searchCallArgs).toContain('sortDirection=');
      expect(searchCallArgs).toContain('addRecipeInformation=true');
      expect(searchCallArgs).toContain('fillIngredients=true');
    });

    it('should use different offsets for variety', async () => {
      // Mock search responses
      const mockSearchResponse1 = {
        data: {
          results: [
            { id: 1 }
          ]
        }
      };

      const mockSearchResponse2 = {
        data: {
          results: [
            { id: 2 }
          ]
        }
      };

      // Mock individual recipe responses
      const mockRecipeResponse1 = { id: 1, title: 'Recipe 1', tags: ['breakfast'] };
      const mockRecipeResponse2 = { id: 2, title: 'Recipe 2', tags: ['lunch'] };

      mockNetworkService.get
        .mockResolvedValueOnce(mockSearchResponse1) // First search call
        .mockResolvedValueOnce({ data: mockRecipeResponse1 }) // Recipe 1
        .mockResolvedValueOnce(mockSearchResponse2) // Second search call
        .mockResolvedValueOnce({ data: mockRecipeResponse2 }); // Recipe 2

      const params = {
        diet: 'vegetarian',
        number: 10
      };

      // Reset recently fetched IDs to allow both calls to return results
      resetSpoonacularRecentlyFetchedIds();

      // First call
      await fetchUnifiedRecipesFromSpoonacular(params);

      // Second call
      await fetchUnifiedRecipesFromSpoonacular(params);

      // Verify different offsets were used
      const searchCallArgs1 = mockNetworkService.get.mock.calls[0][0];
      const searchCallArgs2 = mockNetworkService.get.mock.calls[2][0]; // Second search call

      const offset1 = searchCallArgs1.match(/offset=(\d+)/)?.[1];
      const offset2 = searchCallArgs2.match(/offset=(\d+)/)?.[1];

      expect(offset1).toBeDefined();
      expect(offset2).toBeDefined();
      expect(offset1).not.toBe(offset2);
    });

    it('should handle API errors gracefully', async () => {
      mockNetworkService.get.mockRejectedValue(new Error('API Error'));

      const params = {
        diet: 'vegetarian',
        number: 10
      };

      await expect(fetchUnifiedRecipesFromSpoonacular(params)).rejects.toThrow('API Error');
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = getSpoonacularApiCacheStats();
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('recentIdsSize');
      expect(stats).toHaveProperty('offsetTrackerSize');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.recentIdsSize).toBe('number');
      expect(typeof stats.offsetTrackerSize).toBe('number');
    });

    it('should clear cache when requested', () => {
      clearSpoonacularApiCache();
      const stats = getSpoonacularApiCacheStats();
      expect(stats.cacheSize).toBe(0);
      expect(stats.recentIdsSize).toBe(0);
      expect(stats.offsetTrackerSize).toBe(0);
    });
  });
}); 