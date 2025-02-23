import { Recipe } from '../types/Recipe';

export const mockRecipes: Record<string, Recipe[]> = {
  breakfast: [
    {
      id: 'b1',
      name: 'Overnight Oats with Berries',
      cost: 3.50,
      prepTime: 10,
      cookTime: 0,
      servings: 1,
      ingredients: ['Rolled oats', 'Almond milk', 'Honey', 'Mixed berries', 'Chia seeds'],
      instructions: [
        'Mix oats and milk in a jar',
        'Add honey and chia seeds',
        'Top with berries',
        'Refrigerate overnight'
      ],
      dietaryTags: ['Vegetarian'],
    },
    {
      id: 'b2',
      name: 'Avocado Toast with Poached Egg',
      cost: 5.00,
      prepTime: 15,
      cookTime: 5,
      servings: 1,
      ingredients: ['Sourdough bread', 'Avocado', 'Eggs', 'Cherry tomatoes', 'Red pepper flakes'],
      instructions: [
        'Toast bread',
        'Mash avocado and spread on toast',
        'Poach egg',
        'Add toppings'
      ],
      dietaryTags: ['Vegetarian'],
    },
    {
      id: 'b3',
      name: 'Greek Yogurt Parfait',
      cost: 4.00,
      prepTime: 10,
      cookTime: 0,
      servings: 1,
      ingredients: ['Greek yogurt', 'Granola', 'Honey', 'Mixed berries', 'Almonds'],
      instructions: [
        'Layer yogurt in a glass',
        'Add granola',
        'Top with berries and nuts',
        'Drizzle with honey'
      ],
      dietaryTags: ['Vegetarian', 'Gluten-Free'],
    },
    {
      id: 'b4',
      name: 'Breakfast Burrito',
      cost: 6.00,
      prepTime: 20,
      cookTime: 10,
      servings: 2,
      ingredients: ['Tortillas', 'Eggs', 'Black beans', 'Cheese', 'Salsa', 'Avocado'],
      instructions: [
        'Scramble eggs',
        'Heat beans',
        'Assemble burritos',
        'Add toppings'
      ],
      dietaryTags: ['Vegetarian'],
    },
    {
      id: 'b5',
      name: 'Protein Smoothie Bowl',
      cost: 4.50,
      prepTime: 10,
      cookTime: 0,
      servings: 1,
      ingredients: ['Protein powder', 'Banana', 'Almond milk', 'Mixed berries', 'Granola'],
      instructions: [
        'Blend protein, banana, and milk',
        'Pour into bowl',
        'Top with berries and granola'
      ],
      dietaryTags: ['Vegetarian', 'Gluten-Free'],
    },
  ],
  lunch: [
    {
      id: 'l1',
      name: 'Quinoa Buddha Bowl',
      cost: 6.50,
      prepTime: 20,
      cookTime: 15,
      servings: 2,
      ingredients: ['Quinoa', 'Chickpeas', 'Sweet potato', 'Kale', 'Tahini dressing'],
      instructions: [
        'Cook quinoa',
        'Roast chickpeas and sweet potato',
        'Massage kale',
        'Assemble bowl'
      ],
      dietaryTags: ['Vegan', 'Gluten-Free'],
    },
    {
      id: 'l2',
      name: 'Turkey Pesto Wrap',
      cost: 5.50,
      prepTime: 10,
      cookTime: 0,
      servings: 1,
      ingredients: ['Tortilla', 'Turkey breast', 'Pesto', 'Mozzarella', 'Spinach'],
      instructions: [
        'Spread pesto on tortilla',
        'Layer ingredients',
        'Roll and wrap'
      ],
      dietaryTags: [],
    },
    {
      id: 'l3',
      name: 'Asian Chicken Salad',
      cost: 7.00,
      prepTime: 15,
      cookTime: 10,
      servings: 2,
      ingredients: ['Chicken breast', 'Mixed greens', 'Mandarin oranges', 'Almonds', 'Sesame dressing'],
      instructions: [
        'Cook chicken',
        'Chop vegetables',
        'Assemble salad',
        'Add dressing'
      ],
      dietaryTags: ['Gluten-Free'],
    },
    {
      id: 'l4',
      name: 'Mediterranean Pasta Salad',
      cost: 5.00,
      prepTime: 15,
      cookTime: 10,
      servings: 4,
      ingredients: ['Pasta', 'Cherry tomatoes', 'Cucumber', 'Olives', 'Feta cheese'],
      instructions: [
        'Cook pasta',
        'Chop vegetables',
        'Mix ingredients',
        'Add dressing'
      ],
      dietaryTags: ['Vegetarian'],
    },
    {
      id: 'l5',
      name: 'Tofu Stir-Fry',
      cost: 6.00,
      prepTime: 20,
      cookTime: 15,
      servings: 2,
      ingredients: ['Tofu', 'Broccoli', 'Carrots', 'Brown rice', 'Soy sauce'],
      instructions: [
        'Press and cube tofu',
        'Cook rice',
        'Stir-fry vegetables',
        'Add sauce'
      ],
      dietaryTags: ['Vegan', 'Gluten-Free'],
    },
  ],
  dinner: [
    {
      id: 'd1',
      name: 'Salmon with Roasted Vegetables',
      cost: 12.00,
      prepTime: 15,
      cookTime: 25,
      servings: 2,
      ingredients: ['Salmon fillet', 'Asparagus', 'Sweet potato', 'Lemon', 'Olive oil'],
      instructions: [
        'Season salmon',
        'Prep vegetables',
        'Roast in oven',
        'Serve with lemon'
      ],
      dietaryTags: ['Gluten-Free'],
    },
    {
      id: 'd2',
      name: 'Vegetarian Chili',
      cost: 8.00,
      prepTime: 20,
      cookTime: 40,
      servings: 4,
      ingredients: ['Black beans', 'Kidney beans', 'Tomatoes', 'Corn', 'Spices'],
      instructions: [
        'Sauté vegetables',
        'Add beans and tomatoes',
        'Simmer with spices',
        'Serve with toppings'
      ],
      dietaryTags: ['Vegan', 'Gluten-Free'],
    },
    {
      id: 'd3',
      name: 'Chicken Fajitas',
      cost: 10.00,
      prepTime: 20,
      cookTime: 20,
      servings: 4,
      ingredients: ['Chicken breast', 'Bell peppers', 'Onions', 'Tortillas', 'Spices'],
      instructions: [
        'Slice chicken and vegetables',
        'Cook chicken',
        'Sauté vegetables',
        'Serve with tortillas'
      ],
      dietaryTags: [],
    },
    {
      id: 'd4',
      name: 'Shrimp Scampi',
      cost: 14.00,
      prepTime: 15,
      cookTime: 15,
      servings: 2,
      ingredients: ['Shrimp', 'Pasta', 'Garlic', 'White wine', 'Lemon'],
      instructions: [
        'Cook pasta',
        'Sauté shrimp and garlic',
        'Make sauce',
        'Combine and serve'
      ],
      dietaryTags: [],
    },
    {
      id: 'd5',
      name: 'Mushroom Risotto',
      cost: 9.00,
      prepTime: 10,
      cookTime: 30,
      servings: 4,
      ingredients: ['Arborio rice', 'Mushrooms', 'Onion', 'White wine', 'Parmesan'],
      instructions: [
        'Sauté mushrooms',
        'Toast rice',
        'Add liquid gradually',
        'Finish with cheese'
      ],
      dietaryTags: ['Vegetarian', 'Gluten-Free'],
    },
  ],
  snacks: [
    {
      id: 's1',
      name: 'Trail Mix',
      cost: 2.50,
      prepTime: 5,
      cookTime: 0,
      servings: 4,
      ingredients: ['Mixed nuts', 'Dried fruit', 'Dark chocolate chips', 'Seeds'],
      instructions: [
        'Mix all ingredients',
        'Store in airtight container'
      ],
      dietaryTags: ['Vegan', 'Gluten-Free'],
    },
    {
      id: 's2',
      name: 'Hummus and Veggies',
      cost: 4.00,
      prepTime: 10,
      cookTime: 0,
      servings: 4,
      ingredients: ['Hummus', 'Carrots', 'Cucumber', 'Bell peppers', 'Celery'],
      instructions: [
        'Cut vegetables',
        'Serve with hummus'
      ],
      dietaryTags: ['Vegan', 'Gluten-Free'],
    },
    {
      id: 's3',
      name: 'Greek Yogurt Dip',
      cost: 3.50,
      prepTime: 10,
      cookTime: 0,
      servings: 4,
      ingredients: ['Greek yogurt', 'Cucumber', 'Dill', 'Garlic', 'Pita chips'],
      instructions: [
        'Mix yogurt with ingredients',
        'Chill for 30 minutes',
        'Serve with pita chips'
      ],
      dietaryTags: ['Vegetarian'],
    },
    {
      id: 's4',
      name: 'Apple and Peanut Butter',
      cost: 2.00,
      prepTime: 5,
      cookTime: 0,
      servings: 1,
      ingredients: ['Apple', 'Peanut butter', 'Cinnamon'],
      instructions: [
        'Slice apple',
        'Serve with peanut butter',
        'Sprinkle with cinnamon'
      ],
      dietaryTags: ['Vegan', 'Gluten-Free'],
    },
    {
      id: 's5',
      name: 'Caprese Skewers',
      cost: 5.00,
      prepTime: 15,
      cookTime: 0,
      servings: 4,
      ingredients: ['Cherry tomatoes', 'Mozzarella balls', 'Fresh basil', 'Balsamic glaze'],
      instructions: [
        'Assemble ingredients on skewers',
        'Drizzle with balsamic glaze'
      ],
      dietaryTags: ['Vegetarian', 'Gluten-Free'],
    },
  ],
}; 