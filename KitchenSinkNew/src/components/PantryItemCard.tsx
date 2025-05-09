import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PantryItem } from '../types/PantryItem';
import { theme } from '../styles/theme';

type Props = {
  item: PantryItem;
  onDelete: (id: string) => void;
};

export const PantryItemCard: React.FC<Props> = ({ item, onDelete }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.name}>{item.name}</Text>
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
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  quantity: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  deleteButton: {
    padding: 8,
  },
}); 