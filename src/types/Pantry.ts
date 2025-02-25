export interface PantryItem {
  id: string;
  name: string;
  category: string;
  purchaseDate: Date;
  expiryDate?: Date;
  quantity: number;
  unit: string;
  priority: 'use-soon' | 'normal' | 'long-term';
} 