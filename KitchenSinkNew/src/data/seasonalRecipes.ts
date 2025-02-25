import { Recipe } from '../contexts/MealPlanContext';

export const summerRecipes: Recipe[] = [
  {
    id: 'summer1',
    name: 'Grilled Peach Salad',
    description: 'Fresh summer salad with grilled peaches and goat cheese',
    prepTime: '15 mins',
    cookTime: '10 mins',
    servings: 4,
    ingredients: [
      { item: 'peaches', measurement: '4 ripe' },
      { item: 'mixed greens', measurement: '6 cups' },
      { item: 'goat cheese', measurement: '4 oz' },
      { item: 'pecans', measurement: '1/2 cup' },
      { item: 'honey', measurement: '2 tbsp' }
    ],
    instructions: [
      'Grill peach halves',
      'Toast pecans',
      'Assemble salad',
      'Drizzle with honey vinaigrette'
    ],
    tags: ['vegetarian', 'summer', 'salad', 'lunch'],
    estimatedCost: 12.00
  },
  {
    id: 'summer2',
    name: 'Watermelon Gazpacho',
    description: 'Refreshing cold soup perfect for hot days',
    prepTime: '20 mins',
    cookTime: '0 mins',
    servings: 6,
    ingredients: [
      { item: 'watermelon', measurement: '8 cups' },
      { item: 'cucumber', measurement: '1 medium' },
      { item: 'red bell pepper', measurement: '1' },
      { item: 'lime juice', measurement: '1/4 cup' },
      { item: 'fresh mint', measurement: '2 tbsp' }
    ],
    instructions: [
      'Puree watermelon',
      'Add chopped vegetables',
      'Finish with lime juice',
      'Chill before serving'
    ],
    tags: ['vegan', 'summer', 'soup', 'no-cook'],
    estimatedCost: 9.50
  }
];

export const fallRecipes: Recipe[] = [
  {
    id: 'fall1',
    name: 'Butternut Squash Soup',
    description: 'Creamy autumn soup with seasonal squash',
    prepTime: '15 mins',
    cookTime: '40 mins',
    servings: 6,
    ingredients: [
      { item: 'butternut squash', measurement: '1 large' },
      { item: 'onion', measurement: '1 medium' },
      { item: 'vegetable broth', measurement: '4 cups' },
      { item: 'cream', measurement: '1/2 cup' },
      { item: 'cinnamon', measurement: '1/2 tsp' }
    ],
    instructions: [
      'Roast squash',
      'Sauté onions',
      'Combine and simmer',
      'Blend until smooth',
      'Add cream and seasonings'
    ],
    tags: ['vegetarian', 'fall', 'soup', 'dinner'],
    estimatedCost: 11.00
  },
  {
    id: 'fall2',
    name: 'Apple Cinnamon Oatmeal',
    description: 'Warming breakfast with fresh fall apples',
    prepTime: '5 mins',
    cookTime: '15 mins',
    servings: 2,
    ingredients: [
      { item: 'rolled oats', measurement: '1 cup' },
      { item: 'apples', measurement: '2 medium' },
      { item: 'cinnamon', measurement: '1 tsp' },
      { item: 'maple syrup', measurement: '2 tbsp' },
      { item: 'walnuts', measurement: '1/4 cup' }
    ],
    instructions: [
      'Chop apples',
      'Cook oats with water',
      'Add apples and cinnamon',
      'Top with walnuts and syrup'
    ],
    tags: ['vegetarian', 'fall', 'breakfast', 'healthy'],
    estimatedCost: 6.50
  }
];

export const winterRecipes: Recipe[] = [
  {
    id: 'winter1',
    name: 'Beef Stew',
    description: 'Hearty winter stew with root vegetables',
    prepTime: '30 mins',
    cookTime: '2 hours',
    servings: 6,
    ingredients: [
      { item: 'beef chuck', measurement: '2 lbs' },
      { item: 'carrots', measurement: '4 large' },
      { item: 'potatoes', measurement: '4 medium' },
      { item: 'onion', measurement: '1 large' },
      { item: 'beef broth', measurement: '4 cups' }
    ],
    instructions: [
      'Brown meat',
      'Add vegetables',
      'Pour in broth',
      'Simmer until tender',
      'Season to taste'
    ],
    tags: ['winter', 'dinner', 'slow-cook'],
    estimatedCost: 18.00
  },
  {
    id: 'winter2',
    name: 'Hot Chocolate',
    description: 'Rich and creamy homemade hot chocolate',
    prepTime: '5 mins',
    cookTime: '10 mins',
    servings: 4,
    ingredients: [
      { item: 'milk', measurement: '4 cups' },
      { item: 'dark chocolate', measurement: '8 oz' },
      { item: 'sugar', measurement: '2 tbsp' },
      { item: 'vanilla extract', measurement: '1 tsp' },
      { item: 'whipped cream', measurement: 'for topping' }
    ],
    instructions: [
      'Heat milk',
      'Add chopped chocolate',
      'Stir until melted',
      'Add sugar and vanilla',
      'Top with whipped cream'
    ],
    tags: ['vegetarian', 'winter', 'drinks', 'dessert'],
    estimatedCost: 7.50
  }
];

export const springRecipes: Recipe[] = [
  {
    id: 'spring1',
    name: 'Asparagus Risotto',
    description: 'Creamy risotto with fresh spring asparagus',
    prepTime: '10 mins',
    cookTime: '30 mins',
    servings: 4,
    ingredients: [
      { item: 'arborio rice', measurement: '1.5 cups' },
      { item: 'asparagus', measurement: '1 bunch' },
      { item: 'vegetable broth', measurement: '5 cups' },
      { item: 'white wine', measurement: '1/2 cup' },
      { item: 'parmesan cheese', measurement: '1/2 cup' }
    ],
    instructions: [
      'Prep asparagus',
      'Toast rice',
      'Add liquids gradually',
      'Stir until creamy',
      'Fold in asparagus'
    ],
    tags: ['vegetarian', 'spring', 'dinner', 'italian'],
    estimatedCost: 14.00
  },
  {
    id: 'spring2',
    name: 'Spring Pea Soup',
    description: 'Light and fresh soup with seasonal peas',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: 4,
    ingredients: [
      { item: 'fresh peas', measurement: '2 cups' },
      { item: 'leeks', measurement: '2 medium' },
      { item: 'vegetable broth', measurement: '4 cups' },
      { item: 'mint leaves', measurement: '1/4 cup' },
      { item: 'cream', measurement: '1/2 cup' }
    ],
    instructions: [
      'Sauté leeks',
      'Add peas and broth',
      'Simmer until tender',
      'Blend with mint',
      'Finish with cream'
    ],
    tags: ['vegetarian', 'spring', 'soup', 'lunch'],
    estimatedCost: 10.50
  }
];

export const allSeasonalRecipes: Recipe[] = [
  ...summerRecipes,
  ...fallRecipes,
  ...winterRecipes,
  ...springRecipes
]; 