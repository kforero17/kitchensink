import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: {
    item: string;
    measurement: string;
  }[];
  instructions: string[];
  imageUrl?: string;
  tags: string[];
  estimatedCost: number;
}

interface MealPlanContextType {
  mealPlan: Recipe[];
  setMealPlan: (plan: Recipe[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const MealPlanContext = createContext<MealPlanContextType | undefined>(undefined);

// Mock data for initial meal plan
const mockRecipes: Recipe[] = [
  // Breakfast Recipes
  {
    id: '3',
    name: 'Overnight Oats',
    description: 'Healthy and filling breakfast prepared the night before',
    prepTime: '5 mins',
    cookTime: '0 mins',
    servings: 1,
    ingredients: [
      { item: 'Rolled oats', measurement: '1/2 cup' },
      { item: 'Milk of choice', measurement: '1/2 cup' },
      { item: 'Yogurt', measurement: '1/4 cup' },
      { item: 'Honey', measurement: '1 tbsp' },
      { item: 'Fresh fruits', measurement: 'to taste' },
      { item: 'Nuts and seeds', measurement: 'to taste' }
    ],
    instructions: [
      'Combine oats and milk in a jar',
      'Add yogurt and honey',
      'Stir well',
      'Refrigerate overnight',
      'Top with fresh fruits and nuts before serving'
    ],
    tags: ['vegetarian', 'healthy', 'breakfast', 'meal-prep'],
    estimatedCost: 3.50
  },
  {
    id: 'b1',
    name: 'Avocado Toast with Poached Eggs',
    description: 'Classic breakfast with a healthy twist',
    prepTime: '10 mins',
    cookTime: '5 mins',
    servings: 2,
    ingredients: [
      { item: 'Whole grain bread', measurement: '4 slices' },
      { item: 'Ripe avocados', measurement: '2' },
      { item: 'Fresh eggs', measurement: '4' },
      { item: 'Salt and pepper', measurement: 'to taste' },
      { item: 'Red pepper flakes', measurement: 'to taste' },
      { item: 'Fresh herbs', measurement: 'to taste' }
    ],
    instructions: [
      'Toast the bread',
      'Mash avocados and season',
      'Poach eggs',
      'Spread avocado on toast',
      'Top with poached eggs',
      'Season and garnish'
    ],
    tags: ['vegetarian', 'healthy', 'breakfast', 'quick'],
    estimatedCost: 8.00
  },
  {
    id: 'b2',
    name: 'Greek Yogurt Parfait',
    description: 'Layered breakfast parfait with granola and berries',
    prepTime: '5 mins',
    cookTime: '0 mins',
    servings: 1,
    ingredients: [
      { item: 'Greek yogurt', measurement: '1 cup' },
      { item: 'Mixed berries', measurement: '1/2 cup' },
      { item: 'Granola', measurement: '1/4 cup' },
      { item: 'Honey', measurement: '1 tbsp' },
      { item: 'Mint leaves', measurement: 'for garnish' }
    ],
    instructions: [
      'Layer yogurt in a glass',
      'Add berries',
      'Top with granola',
      'Drizzle with honey',
      'Garnish with mint'
    ],
    tags: ['vegetarian', 'healthy', 'breakfast', 'no-cook'],
    estimatedCost: 5.00
  },
  
  // Lunch Recipes
  {
    id: '2',
    name: 'Pasta Primavera',
    description: 'Fresh pasta with spring vegetables',
    prepTime: '10 mins',
    cookTime: '15 mins',
    servings: 4,
    ingredients: [
      { item: 'Pasta', measurement: '1 lb' },
      { item: 'Mixed vegetables', measurement: '2 cups' },
      { item: 'Olive oil', measurement: '3 tbsp' },
      { item: 'Garlic', measurement: '2 cloves' },
      { item: 'Salt and pepper', measurement: 'to taste' },
      { item: 'Parmesan cheese', measurement: 'to taste' }
    ],
    instructions: [
      'Boil pasta according to package',
      'Sauté vegetables in olive oil',
      'Add garlic and seasonings',
      'Combine pasta and vegetables',
      'Top with parmesan'
    ],
    tags: ['vegetarian', 'pasta', 'quick', 'lunch'],
    estimatedCost: 10.00
  },
  {
    id: 'l1',
    name: 'Quinoa Buddha Bowl',
    description: 'Nutritious bowl with quinoa and roasted vegetables',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: 2,
    ingredients: [
      { item: 'Quinoa', measurement: '1 cup' },
      { item: 'Mixed vegetables', measurement: '2 cups' },
      { item: 'Chickpeas', measurement: '1 can' },
      { item: 'Tahini dressing', measurement: 'to taste' },
      { item: 'Mixed seeds', measurement: 'to taste' },
      { item: 'Fresh herbs', measurement: 'to taste' }
    ],
    instructions: [
      'Cook quinoa',
      'Roast vegetables',
      'Prepare tahini dressing',
      'Assemble bowls',
      'Top with seeds and herbs'
    ],
    tags: ['vegan', 'healthy', 'lunch', 'meal-prep'],
    estimatedCost: 12.00
  },
  {
    id: 'l2',
    name: 'Mediterranean Wrap',
    description: 'Fresh wrap with hummus and vegetables',
    prepTime: '10 mins',
    cookTime: '0 mins',
    servings: 1,
    ingredients: [
      { item: 'Large tortilla wrap', measurement: '1' },
      { item: 'Hummus', measurement: 'to taste' },
      { item: 'Mixed salad greens', measurement: 'to taste' },
      { item: 'Cucumber and tomatoes', measurement: 'to taste' },
      { item: 'Feta cheese', measurement: 'to taste' },
      { item: 'Olives', measurement: 'to taste' }
    ],
    instructions: [
      'Spread hummus on wrap',
      'Layer vegetables',
      'Add feta and olives',
      'Roll tightly',
      'Cut diagonally'
    ],
    tags: ['vegetarian', 'quick', 'lunch', 'no-cook'],
    estimatedCost: 7.00
  },

  // Dinner Recipes
  {
    id: '1',
    name: 'Vegetarian Stir-Fry',
    description: 'A quick and healthy vegetable stir-fry with tofu',
    prepTime: '15 mins',
    cookTime: '20 mins',
    servings: 4,
    ingredients: [
      { item: 'Firm tofu', measurement: '14 oz' },
      { item: 'Mixed vegetables', measurement: '2 cups' },
      { item: 'Soy sauce', measurement: '3 tbsp' },
      { item: 'Garlic', measurement: '2 cloves' },
      { item: 'Ginger', measurement: '1 tbsp' },
      { item: 'Oil', measurement: '2 tbsp' }
    ],
    instructions: [
      'Press and cube tofu',
      'Chop vegetables',
      'Heat oil in wok',
      'Stir-fry tofu until golden',
      'Add vegetables and sauce',
      'Cook until vegetables are tender'
    ],
    tags: ['vegetarian', 'healthy', 'quick', 'dinner'],
    estimatedCost: 12.50
  },
  {
    id: 'd1',
    name: 'Baked Salmon with Roasted Vegetables',
    description: 'Herb-crusted salmon with seasonal vegetables',
    prepTime: '15 mins',
    cookTime: '25 mins',
    servings: 4,
    ingredients: [
      { item: 'Salmon fillets', measurement: '4' },
      { item: 'Mixed herbs', measurement: 'to taste' },
      { item: 'Lemon', measurement: '1' },
      { item: 'Olive oil', measurement: 'to taste' },
      { item: 'Root vegetables', measurement: 'to taste' },
      { item: 'Garlic and butter', measurement: 'to taste' }
    ],
    instructions: [
      'Preheat oven',
      'Season salmon',
      'Prepare vegetables',
      'Bake salmon',
      'Roast vegetables',
      'Serve with lemon'
    ],
    tags: ['healthy', 'dinner', 'gluten-free'],
    estimatedCost: 25.00
  },
  {
    id: 'd2',
    name: 'Black Bean Enchiladas',
    description: 'Vegetarian enchiladas with homemade sauce',
    prepTime: '20 mins',
    cookTime: '30 mins',
    servings: 6,
    ingredients: [
      { item: 'Corn tortillas', measurement: 'to taste' },
      { item: 'Black beans', measurement: 'to taste' },
      { item: 'Enchilada sauce', measurement: 'to taste' },
      { item: 'Mexican cheese blend', measurement: 'to taste' },
      { item: 'Onions and peppers', measurement: 'to taste' },
      { item: 'Spices', measurement: 'to taste' }
    ],
    instructions: [
      'Prepare filling',
      'Make sauce',
      'Fill tortillas',
      'Roll enchiladas',
      'Bake until bubbly'
    ],
    tags: ['vegetarian', 'dinner', 'mexican'],
    estimatedCost: 15.00
  },

  // Snacks
  {
    id: '4',
    name: 'Energy Bites',
    description: 'No-bake protein-packed snack balls',
    prepTime: '15 mins',
    cookTime: '0 mins',
    servings: 12,
    ingredients: [
      { item: 'Oats', measurement: '1 cup' },
      { item: 'Peanut butter', measurement: '1/2 cup' },
      { item: 'Honey', measurement: '1/3 cup' },
      { item: 'Chocolate chips', measurement: '1/2 cup' },
      { item: 'Flax seeds', measurement: '1/4 cup' },
      { item: 'Vanilla', measurement: '1 tsp' }
    ],
    instructions: [
      'Mix all ingredients in a bowl',
      'Chill mixture for 30 minutes',
      'Roll into 1-inch balls',
      'Store in airtight container',
      'Keep refrigerated'
    ],
    tags: ['vegetarian', 'no-bake', 'snacks', 'meal-prep'],
    estimatedCost: 8.00
  },
  {
    id: 's1',
    name: 'Hummus and Veggie Platter',
    description: 'Fresh vegetables with homemade hummus',
    prepTime: '15 mins',
    cookTime: '0 mins',
    servings: 4,
    ingredients: [
      { item: 'Chickpeas', measurement: 'to taste' },
      { item: 'Tahini', measurement: 'to taste' },
      { item: 'Lemon juice', measurement: 'to taste' },
      { item: 'Olive oil', measurement: 'to taste' },
      { item: 'Assorted vegetables', measurement: 'to taste' },
      { item: 'Pita bread', measurement: 'to taste' }
    ],
    instructions: [
      'Blend hummus ingredients',
      'Cut vegetables',
      'Arrange on platter',
      'Serve with pita'
    ],
    tags: ['vegan', 'healthy', 'snacks', 'no-cook'],
    estimatedCost: 10.00
  },
  {
    id: 's2',
    name: 'Trail Mix',
    description: 'Custom blend of nuts, seeds, and dried fruits',
    prepTime: '5 mins',
    cookTime: '0 mins',
    servings: 8,
    ingredients: [
      { item: 'Mixed nuts', measurement: 'to taste' },
      { item: 'Dried cranberries', measurement: 'to taste' },
      { item: 'Pumpkin seeds', measurement: 'to taste' },
      { item: 'Dark chocolate chips', measurement: 'to taste' },
      { item: 'Coconut flakes', measurement: 'to taste' }
    ],
    instructions: [
      'Combine all ingredients',
      'Mix well',
      'Store in airtight container'
    ],
    tags: ['vegan', 'healthy', 'snacks', 'no-cook'],
    estimatedCost: 12.00
  }
];

export const MealPlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mealPlan, setMealPlan] = useState<Recipe[]>(mockRecipes);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <MealPlanContext.Provider value={{ mealPlan, setMealPlan, isLoading, setIsLoading }}>
      {children}
    </MealPlanContext.Provider>
  );
};

export const useMealPlan = () => {
  const context = useContext(MealPlanContext);
  if (context === undefined) {
    throw new Error('useMealPlan must be used within a MealPlanProvider');
  }
  return context;
};

export default MealPlanContext; 