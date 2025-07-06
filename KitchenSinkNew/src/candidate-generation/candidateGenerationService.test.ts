// @ts-nocheck

import { UnifiedRecipe } from '../shared/interfaces';

// --- Mock external dependencies --- //

// Mock Firestore to return a single Tasty recipe document
jest.mock('@react-native-firebase/firestore', () => {
  const tastyDoc = {
    id: 'abc123',
    name: 'Spaghetti Bolognese',
    imageUrl: '',
    readyInMinutes: 30,
    servings: 4,
    ingredients: [
      { name: 'Spaghetti', amount: 200, unit: 'g', originalString: '200 g spaghetti' },
      { name: 'Ground beef', amount: 300, unit: 'g', originalString: '300 g beef' },
    ],
    tags: ['italian'],
    updatedAt: Date.now(),
  };

  const getMock = jest.fn().mockResolvedValue({
    docs: [{ data: () => tastyDoc }],
  });

  const limitMock = jest.fn(() => ({ get: getMock }));
  const orderByMock = jest.fn(() => ({ limit: limitMock }));
  const collectionMock = jest.fn(() => ({ orderBy: orderByMock }));

  return () => ({
    collection: collectionMock,
  });
});

// Mock caching helpers – no caching behaviour for unit test
jest.mock('../services/cachingService', () => ({
  computeCacheKey: jest.fn().mockResolvedValue('dummy-key'),
  getCachedValue: jest.fn().mockResolvedValue(null),
  setCachedValue: jest.fn().mockResolvedValue(undefined),
}));

// Mock Spoonacular fetch to return two recipes (one duplicate, one unique)
jest.mock('../services/unifiedRecipeService', () => {
  const duplicateRecipe: UnifiedRecipe = {
    id: 'spn-1',
    source: 'spoonacular',
    title: 'Spaghetti Bolognese',
    imageUrl: '',
    readyInMinutes: 35,
    servings: 4,
    ingredients: [
      { name: 'Spaghetti', amount: 200, unit: 'g' },
      { name: 'Ground beef', amount: 300, unit: 'g' },
    ],
    tags: ['italian'],
  } as any;

  const uniqueRecipe: UnifiedRecipe = {
    id: 'spn-2',
    source: 'spoonacular',
    title: 'Chicken Curry',
    imageUrl: '',
    readyInMinutes: 40,
    servings: 4,
    ingredients: [
      { name: 'Chicken', amount: 400, unit: 'g' },
      { name: 'Curry powder', amount: 2, unit: 'tbsp' },
    ],
    tags: ['indian'],
  } as any;

  return {
    fetchUnifiedRecipesFromSpoonacular: jest.fn().mockResolvedValue([duplicateRecipe, uniqueRecipe]),
  };
});

// After mocks are in place, import the module under test
import { generateRecipeCandidates } from './candidateGenerationService';

describe('generateRecipeCandidates', () => {
  it('deduplicates near-duplicate recipes across sources', async () => {
    const results = await generateRecipeCandidates({ userEmbedding: [] });

    // Expect only the Tasty recipe and the unique Spoonacular one to remain
    const ids = results.map(r => r.id).sort();
    expect(ids).toEqual(['spn-2', 'tasty-abc123'].sort());
  });
}); 