import { Recipe } from '../types/Recipe';

export const mockRecipes: Record<string, Recipe[]> = {
  breakfast: [
    {
      id: 'b1',
      name: 'Overnight Oats with Berries',
      description: 'A healthy and filling breakfast that can be prepared the night before',
      prepTime: '10 mins',
      cookTime: '0 mins',
      servings: 1,
      ingredients: [
        { item: 'Rolled oats', measurement: '1/2 cup' },
        { item: 'Almond milk', measurement: '1 cup' },
        { item: 'Honey', measurement: '1 tbsp' },
        { item: 'Mixed berries', measurement: '1/2 cup' },
        { item: 'Chia seeds', measurement: '1 tbsp' }
      ],
      instructions: [
        'Mix oats and milk in a jar',
        'Add honey and chia seeds',
        'Mix well and refrigerate overnight',
        'Top with fresh berries before serving'
      ],
      tags: ['breakfast', 'vegetarian', 'healthy', 'make-ahead'],
      estimatedCost: 3.5
    },
    {
      id: 'b2',
      name: 'Avocado Toast with Egg',
      description: 'Creamy avocado on toast topped with a perfectly cooked egg',
      prepTime: '5 mins',
      cookTime: '5 mins',
      servings: 1,
      ingredients: [
        { item: 'Bread', measurement: '2 slices' },
        { item: 'Avocado', measurement: '1' },
        { item: 'Eggs', measurement: '2' },
        { item: 'Salt', measurement: 'to taste' },
        { item: 'Pepper', measurement: 'to taste' },
        { item: 'Red pepper flakes', measurement: 'pinch' }
      ],
      instructions: [
        'Toast bread slices',
        'Mash avocado and spread on toast',
        'Cook eggs sunny side up',
        'Place eggs on top of avocado toast',
        'Season with salt, pepper, and red pepper flakes'
      ],
      tags: ['breakfast', 'vegetarian', 'protein', 'quick'],
      estimatedCost: 4.0
    },
    {
      id: 'b3',
      name: 'Spinach and Feta Omelette',
      description: 'Protein-packed omelette with spinach and tangy feta cheese',
      prepTime: '5 mins',
      cookTime: '10 mins',
      servings: 1,
      ingredients: [
        { item: 'Eggs', measurement: '3' },
        { item: 'Baby spinach', measurement: '1 cup' },
        { item: 'Feta cheese', measurement: '1/4 cup' },
        { item: 'Olive oil', measurement: '1 tsp' },
        { item: 'Salt', measurement: 'to taste' },
        { item: 'Black pepper', measurement: 'to taste' }
      ],
      instructions: [
        'Whisk eggs with salt and pepper',
        'Heat olive oil in a non-stick pan',
        'Pour eggs into pan',
        'Add spinach and feta when eggs start to set',
        'Fold omelette and cook until done'
      ],
      tags: ['breakfast', 'vegetarian', 'gluten-free', 'high-protein'],
      estimatedCost: 3.0
    },
    {
      id: 'b4',
      name: 'Whole Grain Pancakes',
      description: 'Fluffy whole grain pancakes for a nutritious morning',
      prepTime: '10 mins',
      cookTime: '15 mins',
      servings: 4,
      ingredients: [
        { item: 'Whole wheat flour', measurement: '1 cup' },
        { item: 'Milk', measurement: '1 cup' },
        { item: 'Eggs', measurement: '1' },
        { item: 'Baking powder', measurement: '2 tsp' },
        { item: 'Honey', measurement: '2 tbsp' },
        { item: 'Butter', measurement: '2 tbsp' }
      ],
      instructions: [
        'Mix dry ingredients in a bowl',
        'Whisk milk, eggs, and honey together',
        'Combine wet and dry ingredients',
        'Heat butter in a pan',
        'Pour 1/4 cup batter for each pancake',
        'Cook until bubbles form, then flip'
      ],
      tags: ['breakfast', 'vegetarian', 'family-friendly'],
      estimatedCost: 2.5
    },
    {
      id: 'b5',
      name: 'Protein Smoothie Bowl',
      description: 'A nutritious and filling smoothie bowl',
      estimatedCost: 4.50,
      prepTime: '10 mins',
      cookTime: '0 mins',
      servings: 1,
      ingredients: [
        { item: 'Protein powder', measurement: '1 scoop' },
        { item: 'Banana', measurement: '1' },
        { item: 'Almond milk', measurement: '1 cup' },
        { item: 'Mixed berries', measurement: '1/2 cup' },
        { item: 'Granola', measurement: '1/4 cup' }
      ],
      instructions: [
        'Blend protein, banana, and milk',
        'Pour into bowl',
        'Top with berries and granola'
      ],
      tags: ['breakfast', 'vegetarian', 'gluten-free'],
    },
  ],
  lunch: [
    {
      id: 'l1',
      name: 'Quinoa Salad with Roasted Vegetables',
      description: 'Nutritious and filling quinoa salad with seasonal roasted vegetables',
      prepTime: '15 mins',
      cookTime: '20 mins',
      servings: 2,
      ingredients: [
        { item: 'Quinoa', measurement: '1 cup' },
        { item: 'Bell peppers', measurement: '2' },
        { item: 'Zucchini', measurement: '1' },
        { item: 'Red onion', measurement: '1' },
        { item: 'Olive oil', measurement: '2 tbsp' },
        { item: 'Lemon juice', measurement: '2 tbsp' },
        { item: 'Parsley', measurement: '1/4 cup' }
      ],
      instructions: [
        'Cook quinoa according to package instructions',
        'Chop vegetables and toss with olive oil',
        'Roast vegetables at 400°F for 20 minutes',
        'Mix quinoa and vegetables',
        'Dress with lemon juice and fresh parsley'
      ],
      tags: ['lunch', 'vegetarian', 'vegan', 'gluten-free', 'meal-prep'],
      estimatedCost: 5.0
    },
    {
      id: 'l2',
      name: 'Chicken Wrap with Avocado',
      description: 'Protein-packed wrap with grilled chicken and creamy avocado',
      prepTime: '10 mins',
      cookTime: '15 mins',
      servings: 2,
      ingredients: [
        { item: 'Chicken breast', measurement: '2' },
        { item: 'Tortilla wraps', measurement: '2' },
        { item: 'Avocado', measurement: '1' },
        { item: 'Tomato', measurement: '1' },
        { item: 'Lettuce', measurement: '2 cups' },
        { item: 'Greek yogurt', measurement: '1/4 cup' },
        { item: 'Lime juice', measurement: '1 tbsp' }
      ],
      instructions: [
        'Season and grill chicken breasts',
        'Slice chicken, avocado, and tomato',
        'Mix yogurt with lime juice for sauce',
        'Assemble wraps with all ingredients',
        'Roll tightly and cut in half'
      ],
      tags: ['lunch', 'high-protein', 'quick'],
      estimatedCost: 6.0
    },
    {
      id: 'l3',
      name: 'Mediterranean Chickpea Bowl',
      description: 'Healthy bowl with chickpeas, vegetables, and tzatziki sauce',
      prepTime: '15 mins',
      cookTime: '0 mins',
      servings: 1,
      ingredients: [
        { item: 'Chickpeas', measurement: '1 can' },
        { item: 'Cucumber', measurement: '1' },
        { item: 'Cherry tomatoes', measurement: '1 cup' },
        { item: 'Feta cheese', measurement: '1/4 cup' },
        { item: 'Kalamata olives', measurement: '1/4 cup' },
        { item: 'Greek yogurt', measurement: '1/2 cup' },
        { item: 'Lemon juice', measurement: '1 tbsp' },
        { item: 'Dill', measurement: '1 tbsp' }
      ],
      instructions: [
        'Drain and rinse chickpeas',
        'Chop cucumber and halve tomatoes',
        'Mix yogurt with lemon and dill for tzatziki',
        'Assemble bowl with all ingredients',
        'Top with tzatziki sauce'
      ],
      tags: ['lunch', 'vegetarian', 'mediterranean', 'no-cook'],
      estimatedCost: 4.5
    },
    {
      id: 'l4',
      name: 'Spicy Tuna Salad Sandwich',
      description: 'Classic tuna salad with a spicy kick on whole grain bread',
      prepTime: '10 mins',
      cookTime: '0 mins',
      servings: 2,
      ingredients: [
        { item: 'Canned tuna', measurement: '2 cans' },
        { item: 'Mayonnaise', measurement: '3 tbsp' },
        { item: 'Celery', measurement: '1 stalk' },
        { item: 'Red onion', measurement: '1/4' },
        { item: 'Sriracha', measurement: '1 tsp' },
        { item: 'Whole grain bread', measurement: '4 slices' },
        { item: 'Lettuce', measurement: '4 leaves' }
      ],
      instructions: [
        'Drain tuna and flake with a fork',
        'Mix with mayo, diced celery, and onion',
        'Add sriracha and mix well',
        'Toast bread slices',
        'Assemble sandwiches with lettuce and tuna mixture'
      ],
      tags: ['lunch', 'high-protein', 'quick', 'seafood'],
      estimatedCost: 5.0
    },
    {
      id: 'l5',
      name: 'Tofu Stir-Fry',
      description: 'A healthy and delicious stir-fried tofu',
      estimatedCost: 6.00,
      prepTime: '20 mins',
      cookTime: '15 mins',
      servings: 2,
      ingredients: [
        { item: 'Tofu', measurement: '14 oz' },
        { item: 'Broccoli', measurement: '2 cups' },
        { item: 'Carrots', measurement: '2 medium' },
        { item: 'Brown rice', measurement: '1 cup' },
        { item: 'Soy sauce', measurement: '3 tbsp' }
      ],
      instructions: [
        'Press and cube tofu',
        'Cook rice',
        'Stir-fry vegetables',
        'Add sauce'
      ],
      tags: ['lunch', 'vegan', 'gluten-free', 'dairy-free'],
    },
  ],
  dinner: [
    {
      id: 'd1',
      name: 'Baked Salmon with Roasted Vegetables',
      description: 'Perfectly baked salmon fillets with a medley of roasted vegetables',
      prepTime: '15 mins',
      cookTime: '25 mins',
      servings: 2,
      ingredients: [
        { item: 'Salmon fillets', measurement: '2' },
        { item: 'Broccoli', measurement: '1 head' },
        { item: 'Carrots', measurement: '3' },
        { item: 'Lemon', measurement: '1' },
        { item: 'Olive oil', measurement: '2 tbsp' },
        { item: 'Dill', measurement: '2 tbsp' },
        { item: 'Garlic', measurement: '3 cloves' }
      ],
      instructions: [
        'Preheat oven to 400°F',
        'Chop vegetables and toss with olive oil and garlic',
        'Place salmon on a baking sheet, season with salt and pepper',
        'Add lemon slices and dill on top of salmon',
        'Roast vegetables for 10 minutes, then add salmon',
        'Bake everything for 15 more minutes'
      ],
      tags: ['dinner', 'seafood', 'gluten-free', 'high-protein'],
      estimatedCost: 12.0
    },
    {
      id: 'd2',
      name: 'Vegetable Stir Fry with Tofu',
      description: 'Colorful vegetable stir fry with crispy tofu and a savory sauce',
      prepTime: '20 mins',
      cookTime: '15 mins',
      servings: 3,
      ingredients: [
        { item: 'Firm tofu', measurement: '1 block' },
        { item: 'Broccoli', measurement: '1 head' },
        { item: 'Bell peppers', measurement: '2' },
        { item: 'Carrots', measurement: '2' },
        { item: 'Snow peas', measurement: '1 cup' },
        { item: 'Soy sauce', measurement: '3 tbsp' },
        { item: 'Sesame oil', measurement: '1 tbsp' },
        { item: 'Ginger', measurement: '1 tbsp' },
        { item: 'Garlic', measurement: '3 cloves' }
      ],
      instructions: [
        'Press and cube tofu',
        'Chop all vegetables',
        'Mix soy sauce, sesame oil, ginger, and garlic for sauce',
        'Pan-fry tofu until crispy',
        'Stir-fry vegetables until tender-crisp',
        'Add tofu back in with sauce',
        'Cook for 2 more minutes'
      ],
      tags: ['dinner', 'vegetarian', 'vegan', 'gluten-free'],
      estimatedCost: 8.0
    },
    {
      id: 'd3',
      name: 'Spaghetti Bolognese',
      description: 'Classic Italian pasta dish with rich meat sauce',
      prepTime: '15 mins',
      cookTime: '45 mins',
      servings: 4,
      ingredients: [
        { item: 'Ground beef', measurement: '1 lb' },
        { item: 'Spaghetti', measurement: '1 lb' },
        { item: 'Onion', measurement: '1' },
        { item: 'Garlic', measurement: '3 cloves' },
        { item: 'Canned tomatoes', measurement: '28 oz' },
        { item: 'Tomato paste', measurement: '2 tbsp' },
        { item: 'Italian herbs', measurement: '1 tbsp' },
        { item: 'Parmesan cheese', measurement: '1/4 cup' }
      ],
      instructions: [
        'Brown ground beef in a large pot',
        'Add diced onion and garlic, cook until soft',
        'Add tomatoes, tomato paste, and herbs',
        'Simmer for 30 minutes',
        'Cook spaghetti according to package directions',
        'Serve sauce over pasta with grated cheese'
      ],
      tags: ['dinner', 'italian', 'family-friendly'],
      estimatedCost: 10.0
    },
    {
      id: 'd4',
      name: 'Chicken Curry with Rice',
      description: 'Aromatic chicken curry with coconut milk served over fluffy rice',
      prepTime: '20 mins',
      cookTime: '30 mins',
      servings: 4,
      ingredients: [
        { item: 'Chicken thighs', measurement: '1.5 lbs' },
        { item: 'Basmati rice', measurement: '2 cups' },
        { item: 'Onion', measurement: '1' },
        { item: 'Garlic', measurement: '4 cloves' },
        { item: 'Ginger', measurement: '2 tbsp' },
        { item: 'Curry powder', measurement: '2 tbsp' },
        { item: 'Coconut milk', measurement: '1 can' },
        { item: 'Tomatoes', measurement: '2' },
        { item: 'Cilantro', measurement: '1/4 cup' }
      ],
      instructions: [
        'Cut chicken into bite-sized pieces',
        'Sauté onion, garlic, and ginger',
        'Add curry powder and cook for 1 minute',
        'Add chicken and brown slightly',
        'Add coconut milk and diced tomatoes',
        'Simmer for 25 minutes',
        'Cook rice separately',
        'Serve curry over rice, garnished with cilantro'
      ],
      tags: ['dinner', 'indian', 'gluten-free'],
      estimatedCost: 12.0
    },
    {
      id: 'd5',
      name: 'Mushroom Risotto',
      description: 'A creamy and delicious dinner option',
      estimatedCost: 9.00,
      prepTime: '10 mins',
      cookTime: '30 mins',
      servings: 4,
      ingredients: [
        { item: 'Arborio rice', measurement: '1.5 cups' },
        { item: 'Mushrooms', measurement: '8 oz' },
        { item: 'Onion', measurement: '1 medium' },
        { item: 'White wine', measurement: '1/2 cup' },
        { item: 'Parmesan', measurement: '1/2 cup' }
      ],
      instructions: [
        'Sauté mushrooms',
        'Toast rice',
        'Add liquid gradually',
        'Finish with cheese'
      ],
      tags: ['dinner', 'vegetarian', 'gluten-free'],
    },
  ],
  snacks: [
    {
      id: 's1',
      name: 'Trail Mix',
      description: 'A healthy and energizing snack mix',
      prepTime: '5 mins',
      cookTime: '0 mins',
      servings: 4,
      ingredients: [
        { item: 'Mixed nuts', measurement: '1 cup' },
        { item: 'Dried fruit', measurement: '1/2 cup' },
        { item: 'Dark chocolate chips', measurement: '1/4 cup' },
        { item: 'Seeds', measurement: '1/4 cup' }
      ],
      instructions: [
        'Mix all ingredients',
        'Store in airtight container'
      ],
      tags: ['snacks', 'vegetarian', 'gluten-free', 'no-cook'],
      estimatedCost: 2.50
    },
    {
      id: 's2',
      name: 'Hummus and Veggies',
      description: 'A delicious and nutritious snack option',
      estimatedCost: 4.00,
      prepTime: '10 mins',
      cookTime: '0 mins',
      servings: 4,
      ingredients: [
        { item: 'Hummus', measurement: '1 cup' },
        { item: 'Carrots', measurement: '2 cups' },
        { item: 'Cucumber', measurement: '1 medium' },
        { item: 'Bell peppers', measurement: '1' },
        { item: 'Celery', measurement: '4 stalks' }
      ],
      instructions: [
        'Cut vegetables',
        'Serve with hummus'
      ],
      tags: ['snacks', 'vegetarian', 'gluten-free', 'dairy-free', 'vegan'],
    },
    {
      id: 's3',
      name: 'Greek Yogurt Dip',
      description: 'A delicious and nutritious snack option',
      estimatedCost: 3.50,
      prepTime: '10 mins',
      cookTime: '0 mins',
      servings: 4,
      ingredients: [
        { item: 'Greek yogurt', measurement: '1 cup' },
        { item: 'Cucumber', measurement: '1 medium' },
        { item: 'Dill', measurement: '2 tbsp' },
        { item: 'Garlic', measurement: '2 cloves' },
        { item: 'Pita chips', measurement: '2 cups' }
      ],
      instructions: [
        'Mix yogurt with ingredients',
        'Chill for 30 minutes',
        'Serve with pita chips'
      ],
      tags: ['snacks', 'vegetarian'],
    },
    {
      id: 's4',
      name: 'Apple and Peanut Butter',
      description: 'A delicious and nutritious snack option',
      estimatedCost: 2.00,
      prepTime: '5 mins',
      cookTime: '0 mins',
      servings: 1,
      ingredients: [
        { item: 'Apple', measurement: '1 medium' },
        { item: 'Peanut butter', measurement: '2 tbsp' },
        { item: 'Cinnamon', measurement: 'to taste' }
      ],
      instructions: [
        'Slice apple',
        'Serve with peanut butter',
        'Sprinkle with cinnamon'
      ],
      tags: ['snacks', 'vegetarian', 'gluten-free'],
    },
    {
      id: 's5',
      name: 'Caprese Skewers',
      description: 'A delicious and nutritious snack option',
      estimatedCost: 5.00,
      prepTime: '15 mins',
      cookTime: '0 mins',
      servings: 4,
      ingredients: [
        { item: 'Cherry tomatoes', measurement: '1 pint' },
        { item: 'Mozzarella balls', measurement: '8 oz' },
        { item: 'Fresh basil', measurement: '1 bunch' },
        { item: 'Balsamic glaze', measurement: '2 tbsp' }
      ],
      instructions: [
        'Assemble ingredients on skewers',
        'Drizzle with balsamic glaze'
      ],
      tags: ['snacks', 'vegetarian', 'gluten-free'],
    },
  ],
};

export const additionalMockRecipes: Recipe[] = [
  {
    id: 'add1',
    name: 'Mushroom Risotto',
    description: 'Creamy Italian rice dish with mushrooms',
    prepTime: '15 mins',
    cookTime: '30 mins',
    servings: 4,
    ingredients: [
      { item: 'Arborio rice', measurement: '1.5 cups' },
      { item: 'Mushrooms', measurement: '8 oz' },
      { item: 'Vegetable broth', measurement: '4 cups' },
      { item: 'White wine', measurement: '1/2 cup' },
      { item: 'Onion', measurement: '1 medium' },
      { item: 'Garlic', measurement: '2 cloves' },
      { item: 'Parmesan cheese', measurement: '1/2 cup' }
    ],
    instructions: [
      'Sauté onions and garlic',
      'Add mushrooms and cook until soft',
      'Add rice and toast for 2 minutes',
      'Add wine and reduce',
      'Gradually add broth, stirring frequently',
      'Finish with parmesan'
    ],
    tags: ['dinner', 'vegetarian', 'italian'],
    estimatedCost: 12.50
  },
  {
    id: 'add2',
    name: 'Greek Salad',
    description: 'Fresh Mediterranean salad with feta cheese',
    prepTime: '15 mins',
    cookTime: '0 mins',
    servings: 4,
    ingredients: [
      { item: 'Cucumber', measurement: '1 large' },
      { item: 'Tomatoes', measurement: '3 medium' },
      { item: 'Red onion', measurement: '1/2' },
      { item: 'Feta cheese', measurement: '6 oz' },
      { item: 'Kalamata olives', measurement: '1/2 cup' },
      { item: 'Olive oil', measurement: '1/4 cup' },
      { item: 'Lemon juice', measurement: '2 tbsp' }
    ],
    instructions: [
      'Chop vegetables into chunks',
      'Combine in a large bowl',
      'Whisk olive oil and lemon juice',
      'Toss with dressing',
      'Top with feta cheese'
    ],
    tags: ['lunch', 'vegetarian', 'quick', 'no-cook'],
    estimatedCost: 9.75
  }
];

export const dessertMockRecipes: Recipe[] = [
  {
    id: 'dessert1',
    name: 'Chocolate Chip Cookies',
    description: 'Classic homemade chocolate chip cookies',
    prepTime: '15 mins',
    cookTime: '12 mins',
    servings: 24,
    ingredients: [
      { item: 'Butter', measurement: '1 cup' },
      { item: 'Brown sugar', measurement: '1 cup' },
      { item: 'White sugar', measurement: '1/2 cup' },
      { item: 'Eggs', measurement: '2 large' },
      { item: 'Vanilla extract', measurement: '2 tsp' },
      { item: 'All-purpose flour', measurement: '2.5 cups' },
      { item: 'Chocolate chips', measurement: '2 cups' }
    ],
    instructions: [
      'Cream butter and sugars',
      'Beat in eggs and vanilla',
      'Gradually add flour',
      'Fold in chocolate chips',
      'Drop spoonfuls onto baking sheet',
      'Bake at 350°F for 10-12 minutes'
    ],
    tags: ['dessert', 'baking', 'snacks'],
    estimatedCost: 7.50
  },
  {
    id: 'dessert2',
    name: 'Fresh Fruit Parfait',
    description: 'Layered yogurt dessert with fresh fruits',
    prepTime: '10 mins',
    cookTime: '0 mins',
    servings: 4,
    ingredients: [
      { item: 'Greek yogurt', measurement: '2 cups' },
      { item: 'Honey', measurement: '1/4 cup' },
      { item: 'Mixed berries', measurement: '2 cups' },
      { item: 'Granola', measurement: '1 cup' },
      { item: 'Mint leaves', measurement: 'for garnish' }
    ],
    instructions: [
      'Mix yogurt with honey',
      'Layer yogurt and berries in glasses',
      'Top with granola',
      'Garnish with mint',
      'Serve immediately or chill'
    ],
    tags: ['dessert', 'healthy', 'no-cook', 'quick'],
    estimatedCost: 8.25
  }
];

export const allMockRecipes: Recipe[] = [
  ...additionalMockRecipes,
  ...dessertMockRecipes
]; 