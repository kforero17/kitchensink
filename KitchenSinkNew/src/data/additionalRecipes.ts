import { Recipe } from '../contexts/MealPlanContext';

export const internationalRecipes: Recipe[] = [
  // Indian Cuisine
  {
    id: 'indian1',
    name: 'Vegetable Curry',
    description: 'Aromatic curry with mixed vegetables',
    prepTime: '20 mins',
    cookTime: '30 mins',
    servings: 4,
    ingredients: [
      { item: 'mixed vegetables', measurement: '4 cups' },
      { item: 'coconut milk', measurement: '1 can' },
      { item: 'curry powder', measurement: '2 tbsp' },
      { item: 'onion', measurement: '1 large' },
      { item: 'garlic', measurement: '4 cloves' }
    ],
    instructions: [
      'Sauté onions and garlic',
      'Add curry powder',
      'Add vegetables',
      'Pour in coconut milk',
      'Simmer until vegetables are tender'
    ],
    tags: ['vegetarian', 'indian', 'dinner', 'gluten-free'],
    estimatedCost: 12.00
  },
  // Mexican Cuisine
  {
    id: 'mexican1',
    name: 'Vegetarian Enchiladas',
    description: 'Bean and cheese enchiladas with homemade sauce',
    prepTime: '25 mins',
    cookTime: '35 mins',
    servings: 6,
    ingredients: [
      { item: 'corn tortillas', measurement: '12' },
      { item: 'black beans', measurement: '2 cans' },
      { item: 'cheese', measurement: '2 cups' },
      { item: 'enchilada sauce', measurement: '3 cups' },
      { item: 'onion', measurement: '1 medium' }
    ],
    instructions: [
      'Prepare filling',
      'Dip tortillas in sauce',
      'Fill and roll tortillas',
      'Arrange in baking dish',
      'Top with sauce and cheese',
      'Bake until bubbly'
    ],
    tags: ['vegetarian', 'mexican', 'dinner'],
    estimatedCost: 14.00
  }
];

export const quickMeals: Recipe[] = [
  {
    id: 'quick1',
    name: 'Caprese Sandwich',
    description: 'Fast Italian-inspired sandwich with fresh ingredients',
    prepTime: '10 mins',
    cookTime: '0 mins',
    servings: 1,
    ingredients: [
      { item: 'ciabatta roll', measurement: '1' },
      { item: 'fresh mozzarella', measurement: '2 oz' },
      { item: 'tomato', measurement: '1 medium' },
      { item: 'basil leaves', measurement: '5-6 leaves' },
      { item: 'balsamic glaze', measurement: '1 tbsp' }
    ],
    instructions: [
      'Slice roll in half',
      'Layer cheese, tomato, and basil',
      'Drizzle with balsamic glaze',
      'Season with salt and pepper'
    ],
    tags: ['vegetarian', 'quick', 'lunch', 'no-cook'],
    estimatedCost: 6.00
  },
  {
    id: 'quick2',
    name: '15-Minute Fried Rice',
    description: 'Quick fried rice with vegetables',
    prepTime: '5 mins',
    cookTime: '10 mins',
    servings: 2,
    ingredients: [
      { item: 'cooked rice', measurement: '2 cups' },
      { item: 'frozen mixed vegetables', measurement: '1 cup' },
      { item: 'eggs', measurement: '2' },
      { item: 'soy sauce', measurement: '2 tbsp' },
      { item: 'green onions', measurement: '3' }
    ],
    instructions: [
      'Scramble eggs',
      'Add vegetables and rice',
      'Season with soy sauce',
      'Garnish with green onions'
    ],
    tags: ['quick', 'dinner', 'asian', 'leftovers'],
    estimatedCost: 5.00
  }
];

export const vegetarianMeals: Recipe[] = [
  {
    id: 'veg1',
    name: 'Lentil Soup',
    description: 'Hearty and nutritious vegetarian lentil soup',
    prepTime: '15 mins',
    cookTime: '40 mins',
    servings: 6,
    ingredients: [
      { item: 'lentils', measurement: '2 cups' },
      { item: 'carrots', measurement: '3 medium' },
      { item: 'celery', measurement: '3 stalks' },
      { item: 'onion', measurement: '1 large' },
      { item: 'vegetable broth', measurement: '8 cups' }
    ],
    instructions: [
      'Sauté vegetables',
      'Add lentils and broth',
      'Simmer until lentils are tender',
      'Season to taste'
    ],
    tags: ['vegetarian', 'vegan', 'soup', 'dinner', 'gluten-free'],
    estimatedCost: 8.00
  },
  {
    id: 'veg2',
    name: 'Stuffed Bell Peppers',
    description: 'Bell peppers stuffed with rice, beans, and cheese',
    prepTime: '20 mins',
    cookTime: '35 mins',
    servings: 4,
    ingredients: [
      { item: 'bell peppers', measurement: '4 large' },
      { item: 'cooked rice', measurement: '2 cups' },
      { item: 'black beans', measurement: '1 can' },
      { item: 'cheese', measurement: '1 cup' },
      { item: 'tomato sauce', measurement: '1 cup' }
    ],
    instructions: [
      'Cut peppers and remove seeds',
      'Mix rice, beans, and sauce',
      'Stuff peppers with mixture',
      'Top with cheese',
      'Bake until peppers are tender'
    ],
    tags: ['vegetarian', 'dinner', 'gluten-free'],
    estimatedCost: 10.00
  }
];

// Combine all additional recipes
export const allAdditionalRecipes: Recipe[] = [
  ...internationalRecipes,
  ...quickMeals,
  ...vegetarianMeals
]; 