import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import firestore from '@react-native-firebase/firestore';
import { pantryService } from '../services/pantryService';
import { PantryItemDocument, MeasurementUnit, ItemStatus } from '../types/FirestoreSchema';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';
import { Picker } from '@react-native-picker/picker';

// List of categories for pantry items
const CATEGORIES = [
  'Dairy',
  'Meat',
  'Produce',
  'Bakery',
  'Canned Goods',
  'Dry Goods',
  'Frozen',
  'Condiments',
  'Spices',
  'Beverages',
  'Snacks',
  'Other',
];

// List of measurement units
const MEASUREMENT_UNITS: MeasurementUnit[] = [
  'whole',
  'grams',
  'kilograms',
  'ounces',
  'pounds',
  'milliliters',
  'liters',
  'teaspoons',
  'tablespoons',
  'cups',
  'pieces',
  'slices',
  'package',
  'can',
  'bottle',
  'box',
  'bag',
  'bunch',
  'other',
];

// Format a date for display
const formatDate = (date: Date | null): string => {
  if (!date) return 'Not set';
  return date.toLocaleDateString();
};

const PantryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // State for pantry items
  const [pantryItems, setPantryItems] = useState<PantryItemDocument[]>([]);
  const [filteredItems, setFilteredItems] = useState<PantryItemDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for add/edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<PantryItemDocument>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Load pantry items
  const loadPantryItems = async () => {
    try {
      setLoading(true);
      const items = await pantryService.getAllPantryItems();
      setPantryItems(items);
      applyFilters(items, searchQuery, selectedCategory);
    } catch (error) {
      console.error('Error loading pantry items:', error);
      Alert.alert('Error', 'Failed to load pantry items. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Load items when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPantryItems();
    }, [])
  );
  
  // Apply filters to pantry items
  const applyFilters = (
    items: PantryItemDocument[],
    query: string,
    category: string | null
  ) => {
    let result = [...items];
    
    // Apply search query filter
    if (query.trim() !== '') {
      result = result.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // Apply category filter
    if (category) {
      result = result.filter(item => item.category === category);
    }
    
    setFilteredItems(result);
  };
  
  // Handle search
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    applyFilters(pantryItems, text, selectedCategory);
  };
  
  // Handle category selection
  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
    applyFilters(pantryItems, searchQuery, category);
  };
  
  // Open add item modal
  const handleAddItem = () => {
    setCurrentItem({
      name: '',
      quantity: 1,
      unit: 'whole',
      category: CATEGORIES[0],
      notes: '',
    });
    setIsEditMode(false);
    setModalVisible(true);
  };
  
  // Open edit item modal
  const handleEditItem = (item: PantryItemDocument) => {
    setCurrentItem(item);
    setIsEditMode(true);
    setModalVisible(true);
  };
  
  // Delete item
  const handleDeleteItem = (itemId: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item from your pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await pantryService.deletePantryItem(itemId);
              if (success) {
                // Refresh the list
                loadPantryItems();
              } else {
                Alert.alert('Error', 'Failed to delete item. Please try again.');
              }
            } catch (error) {
              console.error('Error deleting pantry item:', error);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          },
        },
      ]
    );
  };
  
  // Save item (add or update)
  const handleSaveItem = async () => {
    try {
      if (!currentItem.name || currentItem.name.trim() === '') {
        Alert.alert('Error', 'Item name is required');
        return;
      }
      
      if (currentItem.quantity === undefined || currentItem.quantity <= 0) {
        Alert.alert('Error', 'Quantity must be greater than 0');
        return;
      }
      
      // For edit mode
      if (isEditMode && currentItem.id) {
        const { id, createdAt, updatedAt, ...updates } = currentItem as PantryItemDocument;
        const success = await pantryService.updatePantryItem(id, updates);
        
        if (success) {
          setModalVisible(false);
          loadPantryItems();
        } else {
          Alert.alert('Error', 'Failed to update item. Please try again.');
        }
      } 
      // For add mode
      else {
        const { id, createdAt, updatedAt, ...newItem } = currentItem as PantryItemDocument;
        
        // Convert expirationDate string to Firestore timestamp if needed
        let itemToAdd: any = { ...newItem };
        if (newItem.expirationDate && typeof newItem.expirationDate !== 'object') {
          itemToAdd.expirationDate = firestore.Timestamp.fromDate(new Date(newItem.expirationDate));
        }
        
        const itemId = await pantryService.addPantryItem(itemToAdd);
        
        if (itemId) {
          setModalVisible(false);
          loadPantryItems();
        } else {
          Alert.alert('Error', 'Failed to add item. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving pantry item:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };
  
  // Handle date change
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    
    if (selectedDate) {
      setCurrentItem({
        ...currentItem,
        expirationDate: firestore.Timestamp.fromDate(selectedDate),
      });
    }
  };
  
  // Render status tag
  const renderStatusTag = (status: ItemStatus) => {
    let backgroundColor = theme.colors.neutral;
    let textColor = theme.colors.text;
    
    switch (status) {
      case 'fresh':
        backgroundColor = theme.colors.success;
        textColor = 'white';
        break;
      case 'expiring':
        backgroundColor = theme.colors.warning;
        textColor = 'black';
        break;
      case 'expired':
        backgroundColor = theme.colors.error;
        textColor = 'white';
        break;
      case 'low':
        backgroundColor = theme.colors.secondary;
        textColor = 'white';
        break;
    }
    
    return (
      <View style={[styles.statusTag, { backgroundColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    );
  };
  
  // Render list item
  const renderItem = ({ item }: { item: PantryItemDocument }) => (
    <TouchableOpacity 
      style={styles.itemContainer}
      onPress={() => handleEditItem(item)}
    >
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.status && renderStatusTag(item.status)}
      </View>
      
      <View style={styles.itemDetails}>
        <Text style={styles.itemDetail}>
          Quantity: {item.quantity} {item.unit}
        </Text>
        
        {item.category && (
          <Text style={styles.itemDetail}>Category: {item.category}</Text>
        )}
        
        {item.expirationDate && (
          <Text style={styles.itemDetail}>
            Expires: {formatDate(item.expirationDate.toDate())}
          </Text>
        )}
      </View>
      
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditItem(item)}
        >
          <Ionicons name="pencil" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteItem(item.id)}
        >
          <Ionicons name="trash" size={20} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
  
  // Render category filter chips
  const renderCategoryChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryChipsContainer}
    >
      <TouchableOpacity
        style={[
          styles.categoryChip,
          !selectedCategory ? styles.selectedCategoryChip : null,
        ]}
        onPress={() => handleCategorySelect(null)}
      >
        <Text
          style={[
            styles.categoryChipText,
            !selectedCategory ? styles.selectedCategoryChipText : null,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>
      
      {CATEGORIES.map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryChip,
            selectedCategory === category ? styles.selectedCategoryChip : null,
          ]}
          onPress={() => handleCategorySelect(category)}
        >
          <Text
            style={[
              styles.categoryChipText,
              selectedCategory === category ? styles.selectedCategoryChipText : null,
            ]}
          >
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Pantry</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddItem}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.text} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pantry items..."
          value={searchQuery}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
        />
      </View>
      
      {renderCategoryChips()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading pantry items...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="basket-outline" size={64} color={theme.colors.neutral} />
          <Text style={styles.emptyText}>
            {searchQuery.trim() !== '' || selectedCategory
              ? 'No pantry items match your search'
              : 'Your pantry is empty'}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={handleAddItem}
          >
            <Text style={styles.emptyButtonText}>Add Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadPantryItems();
              }}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}
      
      {/* Add/Edit Item Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? 'Edit Pantry Item' : 'Add Pantry Item'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              {/* Item Name */}
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Milk, Eggs, Flour"
                value={currentItem.name}
                onChangeText={(text) =>
                  setCurrentItem({ ...currentItem, name: text })
                }
              />
              
              {/* Quantity and Unit */}
              <View style={styles.row}>
                <View style={styles.halfColumn}>
                  <Text style={styles.inputLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1"
                    value={
                      currentItem.quantity !== undefined
                        ? currentItem.quantity.toString()
                        : ''
                    }
                    onChangeText={(text) =>
                      setCurrentItem({
                        ...currentItem,
                        quantity: text === '' ? 0 : parseFloat(text),
                      })
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
                
                <View style={styles.halfColumn}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={currentItem.unit || 'whole'}
                      onValueChange={(itemValue) =>
                        setCurrentItem({ ...currentItem, unit: itemValue as MeasurementUnit })
                      }
                      style={styles.picker}
                    >
                      {MEASUREMENT_UNITS.map((unit) => (
                        <Picker.Item
                          key={unit}
                          label={unit}
                          value={unit}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
              
              {/* Category */}
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={currentItem.category || CATEGORIES[0]}
                  onValueChange={(itemValue) =>
                    setCurrentItem({ ...currentItem, category: itemValue })
                  }
                  style={styles.picker}
                >
                  {CATEGORIES.map((category) => (
                    <Picker.Item
                      key={category}
                      label={category}
                      value={category}
                    />
                  ))}
                </Picker>
              </View>
              
              {/* Expiration Date */}
              <Text style={styles.inputLabel}>Expiration Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Text>
                  {currentItem.expirationDate
                    ? formatDate(currentItem.expirationDate.toDate())
                    : 'Select a date'}
                </Text>
                <Ionicons name="calendar" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={
                    currentItem.expirationDate
                      ? currentItem.expirationDate.toDate()
                      : new Date()
                  }
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
              
              {/* Reorder Threshold */}
              <Text style={styles.inputLabel}>Reorder Threshold</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 2 (will mark as low when quantity <= this value)"
                value={
                  currentItem.reorderThreshold !== undefined
                    ? currentItem.reorderThreshold.toString()
                    : ''
                }
                onChangeText={(text) =>
                  setCurrentItem({
                    ...currentItem,
                    reorderThreshold: text === '' ? undefined : parseFloat(text),
                  })
                }
                keyboardType="decimal-pad"
              />
              
              {/* Notes */}
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Add any additional notes..."
                value={currentItem.notes || ''}
                onChangeText={(text) =>
                  setCurrentItem({ ...currentItem, notes: text })
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveItem}
              >
                <Text style={[styles.buttonText, styles.saveButtonText]}>
                  {isEditMode ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.cardBackground,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: theme.colors.text,
  },
  categoryChipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  categoryChip: {
    backgroundColor: theme.colors.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selectedCategoryChip: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  selectedCategoryChipText: {
    color: 'white',
    fontWeight: '500',
  },
  listContainer: {
    padding: 16,
  },
  itemContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  itemDetails: {
    marginBottom: 12,
  },
  itemDetail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginVertical: 2,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    padding: 6,
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: '50%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalScrollView: {
    padding: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfColumn: {
    width: '48%',
  },
  pickerContainer: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    color: theme.colors.text,
  },
  dateInput: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
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
  saveButton: {
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: 'white',
  },
});

export default PantryScreen; 