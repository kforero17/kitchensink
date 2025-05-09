import { GroceryList } from '../services/groceryListService';

/**
 * Mock grocery lists for use when real data cannot be loaded
 */
export const mockGroceryLists: GroceryList[] = [
  {
    id: 'mock-list-1',
    name: 'Weekly Shopping',
    date: new Date().toISOString(),
    items: [
      { id: 'item-1', name: 'Milk', quantity: '1 gallon', checked: false, category: 'Dairy' },
      { id: 'item-2', name: 'Eggs', quantity: '1 dozen', checked: false, category: 'Dairy' },
      { id: 'item-3', name: 'Bread', quantity: '1 loaf', checked: false, category: 'Bakery' },
      { id: 'item-4', name: 'Apples', quantity: '5', checked: false, category: 'Produce' },
    ]
  },
  {
    id: 'mock-list-2',
    name: 'Weekend BBQ',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-1', name: 'Hamburger buns', quantity: '8', checked: false, category: 'Bakery' },
      { id: 'item-2', name: 'Ground beef', quantity: '2 lbs', checked: false, category: 'Meat' },
      { id: 'item-3', name: 'Lettuce', quantity: '1 head', checked: false, category: 'Produce' },
      { id: 'item-4', name: 'Tomatoes', quantity: '3', checked: false, category: 'Produce' },
      { id: 'item-5', name: 'Chips', quantity: '2 bags', checked: false, category: 'Snacks' },
    ]
  }
]; 