import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { theme } from '../styles/theme';
import { PantryItem } from '../types/PantryItem';

const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat',
  'Seafood',
  'Bakery',
  'Frozen',
  'Canned Goods',
  'Dry Goods',
  'Spices',
  'Beverages',
  'Snacks',
  'Other',
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd?: (name: string, quantity: number, unit: string, category: string) => void;
  itemToEdit?: PantryItem | null;
  onSaveEdit?: (id: string, name: string, quantity: number, unit: string, category: string) => void;
  modalTitle?: string;
};

export const AddPantryItemModal: React.FC<Props> = ({
  visible,
  onClose,
  onAdd,
  itemToEdit,
  onSaveEdit,
  modalTitle = 'Add Pantry Item',
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');

  const isEditMode = !!itemToEdit;

  useEffect(() => {
    if (visible && itemToEdit) {
      setName(itemToEdit.name);
      setQuantity(String(itemToEdit.quantity));
      setUnit(itemToEdit.unit);
      setCategory(itemToEdit.category);
    } else if (!visible) {
      setName('');
      setQuantity('');
      setUnit('');
      setCategory('');
    }
  }, [visible, itemToEdit]);

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    if (!unit.trim()) {
      Alert.alert('Error', 'Please enter a unit');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (isEditMode && onSaveEdit && itemToEdit) {
      onSaveEdit(itemToEdit.id, name.trim(), quantityNum, unit.trim(), category);
    } else if (!isEditMode && onAdd) {
      onAdd(name.trim(), quantityNum, unit.trim(), category);
    }
    
    onClose();
  };

  const handleModalClose = () => {
    setName('');
    setQuantity('');
    setUnit('');
    setCategory('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleModalClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{isEditMode ? 'Edit Pantry Item' : modalTitle}</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Milk"
            autoFocus={!isEditMode}
          />

          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g., 2"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Unit</Text>
          <TextInput
            style={styles.input}
            value={unit}
            onChangeText={setUnit}
            placeholder="e.g., liters"
          />

          <Text style={styles.label}>Category</Text>
          <ScrollView style={styles.categoryContainer}>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonSelected,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleModalClose}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.addButton]}
              onPress={handleSubmit}
            >
              <Text style={[styles.buttonText, styles.addButtonText]}>
                {isEditMode ? 'Save Changes' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    color: theme.colors.text,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  categoryContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  categoryButtonTextSelected: {
    color: 'white',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.cardBackground,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  addButtonText: {
    color: 'white',
  },
}); 