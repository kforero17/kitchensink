export type PantryItemStatus = 'fresh' | 'normal' | 'expiring' | 'expired';

export type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expirationDate?: string; // ISO 8601 date string, e.g. "2025-04-15"
  status?: PantryItemStatus;
}; 