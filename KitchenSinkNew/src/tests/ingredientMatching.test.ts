import {
  normalizeIngredientName,
  ingredientsMatch,
  findMatchingIngredients,
  calculateIngredientSimilarity
} from '../utils/ingredientMatching';

describe('Ingredient Matching Tests', () => {
  describe('normalizeIngredientName', () => {
    it('should normalize basic ingredient names', () => {
      expect(normalizeIngredientName('tomato')).toBe('tomato');
      expect(normalizeIngredientName('tomatoes')).toBe('tomato');
      expect(normalizeIngredientName('TOMATO')).toBe('tomato');
      expect(normalizeIngredientName(' tomato ')).toBe('tomato');
    });

    it('should handle known variations', () => {
      expect(normalizeIngredientName('cherry tomatoes')).toBe('tomato');
      expect(normalizeIngredientName('roma tomatoes')).toBe('tomato');
      expect(normalizeIngredientName('red onion')).toBe('onion');
      expect(normalizeIngredientName('sweet potato')).toBe('potato');
    });

    it('should handle edge cases', () => {
      expect(normalizeIngredientName('')).toBe('');
      expect(normalizeIngredientName('  ')).toBe('');
      expect(normalizeIngredientName('123')).toBe('123');
    });
  });

  describe('ingredientsMatch', () => {
    it('should match identical ingredients', () => {
      expect(ingredientsMatch('tomato', 'tomato')).toBe(true);
      expect(ingredientsMatch('onion', 'onion')).toBe(true);
    });

    it('should match variations of the same ingredient', () => {
      expect(ingredientsMatch('tomato', 'tomatoes')).toBe(true);
      expect(ingredientsMatch('cherry tomatoes', 'tomato')).toBe(true);
      expect(ingredientsMatch('red onion', 'onion')).toBe(true);
    });

    it('should not match different ingredients', () => {
      expect(ingredientsMatch('tomato', 'potato')).toBe(false);
      expect(ingredientsMatch('onion', 'garlic')).toBe(false);
    });
  });

  describe('findMatchingIngredients', () => {
    it('should find exact matches', () => {
      const list1 = ['tomato', 'onion', 'garlic'];
      const list2 = ['tomato', 'potato', 'garlic'];
      const matches = findMatchingIngredients(list1, list2);
      expect(matches).toContain('tomato');
      expect(matches).toContain('garlic');
      expect(matches).not.toContain('onion');
      expect(matches).not.toContain('potato');
    });

    it('should find matches with variations', () => {
      const list1 = ['tomatoes', 'red onion', 'garlic'];
      const list2 = ['cherry tomatoes', 'onion', 'garlic'];
      const matches = findMatchingIngredients(list1, list2);
      expect(matches).toContain('tomato');
      expect(matches).toContain('onion');
      expect(matches).toContain('garlic');
    });

    it('should handle empty lists', () => {
      expect(findMatchingIngredients([], [])).toEqual([]);
      expect(findMatchingIngredients(['tomato'], [])).toEqual([]);
      expect(findMatchingIngredients([], ['tomato'])).toEqual([]);
    });
  });

  describe('calculateIngredientSimilarity', () => {
    it('should return 1 for identical ingredients', () => {
      expect(calculateIngredientSimilarity('tomato', 'tomato')).toBe(1);
      expect(calculateIngredientSimilarity('onion', 'onion')).toBe(1);
    });

    it('should return 1 for known variations', () => {
      expect(calculateIngredientSimilarity('tomato', 'tomatoes')).toBe(1);
      expect(calculateIngredientSimilarity('cherry tomatoes', 'tomato')).toBe(1);
    });

    it('should return lower scores for different ingredients', () => {
      const score = calculateIngredientSimilarity('tomato', 'potato');
      expect(score).toBeLessThan(1);
      expect(score).toBeGreaterThan(0);
    });

    it('should handle edge cases', () => {
      expect(calculateIngredientSimilarity('', '')).toBe(1);
      expect(calculateIngredientSimilarity('a', '')).toBeLessThan(1);
      expect(calculateIngredientSimilarity('', 'a')).toBeLessThan(1);
    });
  });
}); 