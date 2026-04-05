// @ts-nocheck

import { UnifiedRecipe } from '../shared/interfaces';

// --- Mock external dependencies --- //

const tastyDoc1 = {
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

const tastyDoc2 = {
  id: 'def456',
  name: 'Chicken Curry',
  imageUrl: '',
  readyInMinutes: 40,
  servings: 4,
  ingredients: [
    { name: 'Chicken', amount: 400, unit: 'g', originalString: '400 g chicken' },
    { name: 'Curry powder', amount: 2, unit: 'tbsp', originalString: '2 tbsp curry powder' },
  ],
  tags: ['indian'],
  updatedAt: Date.now(),
};

// Mock Firestore to return two Tasty recipe documents
jest.mock('@react-native-firebase/firestore', () => {
  const getMock = jest.fn().mockResolvedValue({
    docs: [{ data: () => tastyDoc1 }, { data: () => tastyDoc2 }],
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

// After mocks are in place, import the module under test
import { generateRecipeCandidates } from './candidateGenerationService';

describe('generateRecipeCandidates', () => {
  it('returns Tasty recipes from Firestore', async () => {
    const results = await generateRecipeCandidates({ userEmbedding: [] });

    const ids = results.map(r => r.id).sort();
    expect(ids).toEqual(['tasty-abc123', 'tasty-def456'].sort());
    expect(results.every(r => r.source === 'tasty')).toBe(true);
  });
});
