import { PantryItem, PantryItemStatus } from '../types/PantryItem';

function daysUntilExpiry(expirationDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeStatus(expirationDate: string | undefined): PantryItemStatus {
  if (!expirationDate) return 'normal';

  const days = daysUntilExpiry(expirationDate);
  if (days <= 0) return 'expired';
  if (days <= 3) return 'expiring';
  if (days <= 5) return 'normal';
  return 'fresh';
}

export type StatusUpdate = { id: string; status: PantryItemStatus };

export function computeStatusUpdates(items: PantryItem[]): StatusUpdate[] {
  const updates: StatusUpdate[] = [];

  for (const item of items) {
    const newStatus = computeStatus(item.expirationDate);
    if (item.status !== newStatus) {
      updates.push({ id: item.id, status: newStatus });
    }
  }

  return updates;
}
