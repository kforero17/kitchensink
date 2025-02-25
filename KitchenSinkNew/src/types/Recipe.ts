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