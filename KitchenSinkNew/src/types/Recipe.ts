export interface Recipe {
  id: string;
  name: string;
  cost: number;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: string[];
  instructions: string[];
  dietaryTags: string[];
} 