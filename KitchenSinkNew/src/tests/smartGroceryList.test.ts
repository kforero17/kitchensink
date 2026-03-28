import { GroceryItem } from '../types/FirestoreSchema';
import { PantryItem } from '../types/PantryItem';
import {
  buildSmartGroceryList,
  getSmartListSummary,
  SmartGroceryItem,
} from '../utils/smartGroceryList';

function makeGroceryItem(overrides: Partial<GroceryItem> & { name: string }): GroceryItem {
  return { measurement: '1 cup', category: 'Other', ...overrides };
}

function makePantryItem(overrides: Partial<PantryItem> & { name: string }): PantryItem {
  return { id: '1', quantity: 1, unit: 'unit', category: 'Other', ...overrides };
}

describe('buildSmartGroceryList — pantry subtraction', () => {

  it('marks items in pantry as inPantry', () => {
    const grocery = [makeGroceryItem({ name: 'chicken breast' })];
    const pantry = [makePantryItem({ name: 'chicken' })];

    const result = buildSmartGroceryList(grocery, pantry);

    expect(result).toHaveLength(1);
    expect(result[0].inPantry).toBe(true);
    expect(result[0].pantryNote).toContain('Have');
  });

  it('does not match unrelated items', () => {
    const grocery = [makeGroceryItem({ name: 'salmon' })];
    const pantry = [makePantryItem({ name: 'chicken' })];

    const result = buildSmartGroceryList(grocery, pantry);

    expect(result).toHaveLength(1);
    expect(result[0].inPantry).toBe(false);
  });

  it('excludes expired pantry items from matching', () => {
    const grocery = [makeGroceryItem({ name: 'milk' })];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pantry = [makePantryItem({ name: 'milk', expirationDate: yesterday.toISOString().split('T')[0] })];

    const result = buildSmartGroceryList(grocery, pantry);

    expect(result).toHaveLength(1);
    expect(result[0].inPantry).toBe(false);
  });

  it('handles empty pantry', () => {
    const grocery = [
      makeGroceryItem({ name: 'rice' }),
      makeGroceryItem({ name: 'beans' }),
    ];
    const pantry: PantryItem[] = [];

    const result = buildSmartGroceryList(grocery, pantry);

    expect(result).toHaveLength(2);
    expect(result.every(i => !i.inPantry)).toBe(true);
  });
});

describe('buildSmartGroceryList — aisle ordering', () => {

  it('sorts items by aisle number', () => {
    const grocery = [
      makeGroceryItem({ name: 'chips', category: 'Snacks & Sweets' }),
      makeGroceryItem({ name: 'apple', category: 'Produce' }),
      makeGroceryItem({ name: 'milk', category: 'Dairy & Eggs' }),
    ];

    const result = buildSmartGroceryList(grocery, []);

    expect(result[0].name).toBe('apple');
    expect(result[0].aisle).toBe(1);
    expect(result[1].name).toBe('milk');
    expect(result[1].aisle).toBe(3);
    expect(result[2].name).toBe('chips');
    expect(result[2].aisle).toBe(8);
  });

  it('sorts alphabetically within same aisle', () => {
    const grocery = [
      makeGroceryItem({ name: 'zucchini', category: 'Produce' }),
      makeGroceryItem({ name: 'apple', category: 'Produce' }),
    ];

    const result = buildSmartGroceryList(grocery, []);

    expect(result[0].name).toBe('apple');
    expect(result[1].name).toBe('zucchini');
  });

  it('assigns aisle 9 for unknown categories', () => {
    const grocery = [makeGroceryItem({ name: 'mystery item', category: 'Unknown' })];

    const result = buildSmartGroceryList(grocery, []);

    expect(result[0].aisle).toBe(9);
  });
});

describe('buildSmartGroceryList — consolidation', () => {

  it('consolidates items with same normalized name', () => {
    const grocery = [
      makeGroceryItem({ name: 'tomato', recipeId: 'r1', recipeName: 'Soup' }),
      makeGroceryItem({ name: 'tomatoes', recipeId: 'r2', recipeName: 'Salad' }),
    ];

    const result = buildSmartGroceryList(grocery, []);

    expect(result).toHaveLength(1);
    expect(result[0].recipeIds).toEqual(['r1', 'r2']);
    expect(result[0].recipeNames).toEqual(['Soup', 'Salad']);
  });
});

describe('getSmartListSummary', () => {

  it('computes correct summary', () => {
    const items: SmartGroceryItem[] = [
      { name: 'apple', measurement: '3', category: 'Produce', aisle: 1, recipeIds: [], recipeNames: [], recommendedPackage: '', inPantry: false },
      { name: 'milk', measurement: '1 gal', category: 'Dairy & Eggs', aisle: 3, recipeIds: [], recipeNames: [], recommendedPackage: '', inPantry: true },
      { name: 'chicken', measurement: '2 lbs', category: 'Meat & Seafood', aisle: 2, recipeIds: [], recipeNames: [], recommendedPackage: '', inPantry: false },
      { name: 'bread', measurement: '1 loaf', category: 'Grains & Bakery', aisle: 5, recipeIds: [], recipeNames: [], recommendedPackage: '', inPantry: true },
      { name: 'rice', measurement: '1 bag', category: 'Pantry', aisle: 6, recipeIds: [], recipeNames: [], recommendedPackage: '', inPantry: false },
    ];

    const summary = getSmartListSummary(items);

    expect(summary.totalItems).toBe(3);
    expect(summary.removedByPantry).toBe(2);
    expect(summary.aisleCount).toBe(3);
  });
});
