export interface Leftover {
  id: string;
  recipeId: string;
  recipeName: string;
  originalServings: number;
  remainingServings: number;
  cookedDate: string;          // ISO date
  estimatedExpiryDate: string; // ISO date (cookedDate + 3 days default)
  mealType: string;
  status: 'available' | 'used' | 'expired';
}
