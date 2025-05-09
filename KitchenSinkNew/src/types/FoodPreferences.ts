export interface FoodPreferences {
  favoriteIngredients: string[];
  dislikedIngredients: string[];
  preferredCuisines: string[];
  allergies: string[];
}

export interface IngredientSuggestion {
  id: string;
  name: string;
  category: IngredientCategory;
}

export type IngredientCategory = 
  | 'vegetables'
  | 'fruits'
  | 'meats'
  | 'seafood'
  | 'dairy'
  | 'grains'
  | 'herbs'
  | 'spices'
  | 'other';

// Common ingredients suggestions grouped by category
export const INGREDIENT_SUGGESTIONS: Record<IngredientCategory, IngredientSuggestion[]> = {
  vegetables: [
    { id: 'tomato', name: 'Tomatoes', category: 'vegetables' },
    { id: 'spinach', name: 'Spinach', category: 'vegetables' },
    { id: 'broccoli', name: 'Broccoli', category: 'vegetables' },
    { id: 'carrot', name: 'Carrots', category: 'vegetables' },
    { id: 'potato', name: 'Potatoes', category: 'vegetables' },
    { id: 'cucumber', name: 'Cucumber', category: 'vegetables' },
    { id: 'bell_pepper', name: 'Bell Peppers', category: 'vegetables' },
    { id: 'onion', name: 'Onions', category: 'vegetables' },
    { id: 'mushroom', name: 'Mushrooms', category: 'vegetables' },
    { id: 'zucchini', name: 'Zucchini', category: 'vegetables' },
    { id: 'eggplant', name: 'Eggplant', category: 'vegetables' },
    { id: 'lettuce', name: 'Lettuce', category: 'vegetables' },
    { id: 'cauliflower', name: 'Cauliflower', category: 'vegetables' },
    { id: 'green_beans', name: 'Green Beans', category: 'vegetables' },
    { id: 'sweet_potato', name: 'Sweet Potatoes', category: 'vegetables' },
  ],
  fruits: [
    { id: 'apple', name: 'Apples', category: 'fruits' },
    { id: 'banana', name: 'Bananas', category: 'fruits' },
    { id: 'orange', name: 'Oranges', category: 'fruits' },
    { id: 'strawberry', name: 'Strawberries', category: 'fruits' },
    { id: 'lemon', name: 'Lemons', category: 'fruits' },
    { id: 'mango', name: 'Mangos', category: 'fruits' },
    { id: 'pineapple', name: 'Pineapple', category: 'fruits' },
    { id: 'grape', name: 'Grapes', category: 'fruits' },
    { id: 'blueberry', name: 'Blueberries', category: 'fruits' },
    { id: 'peach', name: 'Peaches', category: 'fruits' },
    { id: 'pear', name: 'Pears', category: 'fruits' },
    { id: 'raspberry', name: 'Raspberries', category: 'fruits' },
    { id: 'kiwi', name: 'Kiwi', category: 'fruits' },
    { id: 'watermelon', name: 'Watermelon', category: 'fruits' },
    { id: 'avocado', name: 'Avocado', category: 'fruits' },
  ],
  meats: [
    { id: 'chicken', name: 'Chicken', category: 'meats' },
    { id: 'beef', name: 'Beef', category: 'meats' },
    { id: 'pork', name: 'Pork', category: 'meats' },
    { id: 'turkey', name: 'Turkey', category: 'meats' },
    { id: 'lamb', name: 'Lamb', category: 'meats' },
    { id: 'duck', name: 'Duck', category: 'meats' },
    { id: 'veal', name: 'Veal', category: 'meats' },
    { id: 'bacon', name: 'Bacon', category: 'meats' },
    { id: 'ham', name: 'Ham', category: 'meats' },
    { id: 'sausage', name: 'Sausage', category: 'meats' },
  ],
  seafood: [
    { id: 'salmon', name: 'Salmon', category: 'seafood' },
    { id: 'tuna', name: 'Tuna', category: 'seafood' },
    { id: 'shrimp', name: 'Shrimp', category: 'seafood' },
    { id: 'cod', name: 'Cod', category: 'seafood' },
    { id: 'tilapia', name: 'Tilapia', category: 'seafood' },
    { id: 'crab', name: 'Crab', category: 'seafood' },
    { id: 'lobster', name: 'Lobster', category: 'seafood' },
    { id: 'mussels', name: 'Mussels', category: 'seafood' },
    { id: 'scallops', name: 'Scallops', category: 'seafood' },
    { id: 'halibut', name: 'Halibut', category: 'seafood' },
  ],
  dairy: [
    { id: 'cheese', name: 'Cheese', category: 'dairy' },
    { id: 'milk', name: 'Milk', category: 'dairy' },
    { id: 'yogurt', name: 'Yogurt', category: 'dairy' },
    { id: 'butter', name: 'Butter', category: 'dairy' },
    { id: 'cream', name: 'Cream', category: 'dairy' },
    { id: 'sour_cream', name: 'Sour Cream', category: 'dairy' },
    { id: 'cream_cheese', name: 'Cream Cheese', category: 'dairy' },
    { id: 'cottage_cheese', name: 'Cottage Cheese', category: 'dairy' },
    { id: 'mozzarella', name: 'Mozzarella', category: 'dairy' },
    { id: 'parmesan', name: 'Parmesan', category: 'dairy' },
  ],
  grains: [
    { id: 'rice', name: 'Rice', category: 'grains' },
    { id: 'pasta', name: 'Pasta', category: 'grains' },
    { id: 'bread', name: 'Bread', category: 'grains' },
    { id: 'quinoa', name: 'Quinoa', category: 'grains' },
    { id: 'oats', name: 'Oats', category: 'grains' },
    { id: 'couscous', name: 'Couscous', category: 'grains' },
    { id: 'barley', name: 'Barley', category: 'grains' },
    { id: 'tortilla', name: 'Tortilla', category: 'grains' },
    { id: 'bulgur', name: 'Bulgur', category: 'grains' },
    { id: 'cornmeal', name: 'Cornmeal', category: 'grains' },
  ],
  herbs: [
    { id: 'basil', name: 'Basil', category: 'herbs' },
    { id: 'parsley', name: 'Parsley', category: 'herbs' },
    { id: 'cilantro', name: 'Cilantro', category: 'herbs' },
    { id: 'mint', name: 'Mint', category: 'herbs' },
    { id: 'thyme', name: 'Thyme', category: 'herbs' },
    { id: 'rosemary', name: 'Rosemary', category: 'herbs' },
    { id: 'oregano', name: 'Oregano', category: 'herbs' },
    { id: 'sage', name: 'Sage', category: 'herbs' },
    { id: 'dill', name: 'Dill', category: 'herbs' },
    { id: 'chives', name: 'Chives', category: 'herbs' },
  ],
  spices: [
    { id: 'pepper', name: 'Black Pepper', category: 'spices' },
    { id: 'cumin', name: 'Cumin', category: 'spices' },
    { id: 'paprika', name: 'Paprika', category: 'spices' },
    { id: 'cinnamon', name: 'Cinnamon', category: 'spices' },
    { id: 'garlic', name: 'Garlic', category: 'spices' },
    { id: 'turmeric', name: 'Turmeric', category: 'spices' },
    { id: 'ginger', name: 'Ginger', category: 'spices' },
    { id: 'nutmeg', name: 'Nutmeg', category: 'spices' },
    { id: 'cardamom', name: 'Cardamom', category: 'spices' },
    { id: 'cayenne', name: 'Cayenne Pepper', category: 'spices' },
  ],
  other: [
    { id: 'honey', name: 'Honey', category: 'other' },
    { id: 'soy_sauce', name: 'Soy Sauce', category: 'other' },
    { id: 'olive_oil', name: 'Olive Oil', category: 'other' },
    { id: 'vinegar', name: 'Vinegar', category: 'other' },
    { id: 'nuts', name: 'Nuts', category: 'other' },
    { id: 'maple_syrup', name: 'Maple Syrup', category: 'other' },
    { id: 'coconut_milk', name: 'Coconut Milk', category: 'other' },
    { id: 'sesame_oil', name: 'Sesame Oil', category: 'other' },
    { id: 'hot_sauce', name: 'Hot Sauce', category: 'other' },
    { id: 'mustard', name: 'Mustard', category: 'other' },
  ],
};

export const CUISINE_OPTIONS = [
  { id: 'italian', name: 'Italian' },
  { id: 'mexican', name: 'Mexican' },
  { id: 'chinese', name: 'Chinese' },
  { id: 'japanese', name: 'Japanese' },
  { id: 'indian', name: 'Indian' },
  { id: 'thai', name: 'Thai' },
  { id: 'vietnamese', name: 'Vietnamese' },
  { id: 'korean', name: 'Korean' },
  { id: 'mediterranean', name: 'Mediterranean' },
  { id: 'american', name: 'American' },
  { id: 'french', name: 'French' },
  { id: 'greek', name: 'Greek' },
  { id: 'spanish', name: 'Spanish' },
  { id: 'middle_eastern', name: 'Middle Eastern' },
  { id: 'caribbean', name: 'Caribbean' },
]; 