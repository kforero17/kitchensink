import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PantryItem } from '../types/PantryItem';
import { theme } from '../styles/theme';
import logger from '../utils/logger';

type ExpiryInfo = {
  label: string;
  color: string;
};

function getExpiryInfo(expirationDate: string | undefined): ExpiryInfo | null {
  if (!expirationDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'Expired', color: theme.colors.error };
  if (diffDays === 0) return { label: 'Expires today', color: theme.colors.error };
  if (diffDays <= 3) return { label: `${diffDays}d left`, color: theme.colors.warning };
  return { label: `${diffDays}d left`, color: theme.colors.success };
}

type Props = {
  item: PantryItem;
  onDelete: (id: string) => void;
};

export const PantryItemCard: React.FC<Props> = ({ item, onDelete }) => {
  logger.debug('[PantryItemCard] Props received:', { item, onDelete: typeof onDelete });

  if (!item) {
    logger.error('[PantryItemCard] Received null or undefined item prop');
    return (
      <View style={styles.container}>
        <Text style={styles.name}>Error: Item data is missing.</Text>
      </View>
    );
  }

  const expiry = getExpiryInfo(item.expirationDate);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>
          {expiry && (
            <View style={[styles.expiryBadge, { backgroundColor: expiry.color + '1A' }]}>
              <Text style={[styles.expiryText, { color: expiry.color }]}>{expiry.label}</Text>
            </View>
          )}
        </View>
        <Text style={styles.quantity}>
          {item.quantity} {item.unit}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  quantity: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  expiryBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
}); 