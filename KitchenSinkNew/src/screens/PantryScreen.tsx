import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pantryService } from '../services/pantryService';
import { PantryItemDocument, MeasurementUnit, ItemStatus } from '../types/FirestoreSchema';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';
import { Picker } from '@react-native-picker/picker';
import { RootStackParamList } from '../navigation/AppNavigator';

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

type PantryScreenRouteProp = RouteProp<RootStackParamList, 'Pantry' | 'PantryEdit'>;
type PantryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Pantry' | 'PantryEdit'>;

const PantryScreen: React.FC = () => {
  const navigation = useNavigation<PantryScreenNavigationProp>();
  const route = useRoute<PantryScreenRouteProp>();
  const isFromProfile = route.params?.fromProfile === true;
  // Check if this screen is being rendered in edit mode (PantryEdit route)
  const isEditMode = route.name === 'PantryEdit';
  const { user } = useAuth();
  
  // State for pantry items
  const [pantryItems, setPantryItems] = useState<PantryItemDocument[]>([]);
  const [filteredItems, setFilteredItems] = useState<PantryItemDocument[]>([]);
  const [categorizedItems, setCategorizedItems] = useState<Record<string, PantryItemDocument[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  
  // State for showing/hiding the swipe tip
  const [showSwipeTip, setShowSwipeTip] = useState(!isEditMode);
  const swipeTipAnimation = useRef(new Animated.Value(1)).current;
  
  // State for add/edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [isItemEditMode, setIsItemEditMode] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<PantryItemDocument>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Auto-hide swipe tip after a delay
  useEffect(() => {
    if (showSwipeTip) {
      const timer = setTimeout(() => {
        Animated.timing(swipeTipAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        }).start(() => {
          setShowSwipeTip(false);
        });
      }, 8000); // Hide after 8 seconds
      
      return () => clearTimeout(timer);
    }
  }, [showSwipeTip]);
  
  // Load pantry items
  const loadPantryItems = async () => {
    try {
      setLoading(true);
      const items = await pantryService.getAllPantryItems();
      setPantryItems(items);
      applyFilters(items, searchQuery, selectedCategory);
      
      // Organize items by category for the edit mode view
      const categorized: Record<string, PantryItemDocument[]> = {};
      items.forEach(item => {
        const category = item.category || 'Other';
        if (!categorized[category]) {
          categorized[category] = [];
        }
        categorized[category].push(item);
      });
      
      // Sort each category alphabetically by item name
      Object.keys(categorized).forEach(category => {
        categorized[category].sort((a, b) => a.name.localeCompare(b.name));
      });
      
      setCategorizedItems(categorized);
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
    setIsItemEditMode(false);
    setModalVisible(true);
  };
  
  // Open edit item modal
  const handleEditItem = (item: PantryItemDocument) => {
    setCurrentItem(item);
    setIsItemEditMode(true);
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
              setDeletingItem(itemId);
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
            } finally {
              setDeletingItem(null);
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
      if (isItemEditMode && currentItem.id) {
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
  
  // Swipeable Pantry Item Component
  const SwipeablePantryItem = ({ item }: { item: PantryItemDocument }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const swipeThreshold = -100; // Distance required to trigger delete action
    const isDeleting = deletingItem === item.id;
    
    // Create a fade-in animation for the hint indicator
    const [showHint, setShowHint] = useState(false);
    const hintOpacity = useRef(new Animated.Value(0)).current;
    
    // Track if the item is fully swiped
    const [isFullySwiped, setIsFullySwiped] = useState(false);
    
    // Show hint when component mounts (first time only)
    useEffect(() => {
      if (!showHint) {
        setShowHint(true);
        // Animate hint opacity
        Animated.sequence([
          Animated.delay(500), // Wait a moment before showing hint
          Animated.timing(hintOpacity, {
            toValue: 0.7,
            duration: 300,
            useNativeDriver: true
          }),
          Animated.delay(1000), // Keep hint visible for a second
          Animated.timing(hintOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true
          })
        ]).start();
      }
    }, []);
    
    // Reset swipe position when item is deleted or new items load
    useEffect(() => {
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        tension: 40,
        useNativeDriver: false
      }).start();
      setIsFullySwiped(false);
    }, [pantryItems.length]);
    
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false, // Don't capture taps
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only activate for horizontal swipes and prevent tap handling
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 3) && Math.abs(gestureState.dx) > 10;
        },
        onPanResponderGrant: () => {
          pan.extractOffset();
        },
        onPanResponderMove: (_, gestureState) => {
          // Only allow left swipes (negative dx) with a maximum limit
          if (gestureState.dx < 0) {
            // Limit how far the item can be swiped to the left
            const limitedDx = Math.max(gestureState.dx, swipeThreshold * 1.2);
            Animated.event(
              [null, { dx: pan.x }],
              { useNativeDriver: false }
            )({ nativeEvent: { gestureState: { ...gestureState, dx: limitedDx } } });
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < swipeThreshold) {
            // Swiped far enough to reveal delete button
            Animated.spring(pan, {
              toValue: { x: swipeThreshold, y: 0 },
              friction: 6,
              tension: 40,
              useNativeDriver: false
            }).start(() => {
              setIsFullySwiped(true);
            });
          } else {
            // Not swiped far enough, return to original position with a bounce effect
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              friction: 5,
              tension: 40,
              useNativeDriver: false
            }).start(() => {
              setIsFullySwiped(false);
            });
          }
        },
        onPanResponderTerminationRequest: () => false, // Don't release responder during gesture
      })
    ).current;

    // Show delete button based on swipe distance
    const deleteButtonOpacity = pan.x.interpolate({
      inputRange: [swipeThreshold, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp'
    });
    
    // Calculate background color for delete action
    const deleteBackgroundColor = pan.x.interpolate({
      inputRange: [swipeThreshold, 0],
      outputRange: [theme.colors.error, 'transparent'],
      extrapolate: 'clamp'
    });

    return (
      // Apply panResponder to the outer container to handle swipe gestures
      <View style={styles.swipeableContainer} {...panResponder.panHandlers}>
        {/* Delete background that appears on swipe */}
        <Animated.View 
          style={[
            styles.deleteBackground,
            { backgroundColor: deleteBackgroundColor }
          ]}
        >
          <TouchableOpacity
            style={styles.deleteBackgroundButton}
            onPress={() => isFullySwiped && handleDeleteItem(item.id)}
            disabled={!isFullySwiped || isDeleting}
          >
            <Animated.View style={{ opacity: deleteButtonOpacity }}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View style={styles.deleteIconContainer}>
                  <Ionicons name="trash" size={24} color="white" />
                  <Text style={styles.deleteText}>Delete</Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Swipe hint indicator */}
        {showHint && (
          <Animated.View 
            style={[
              styles.swipeHint,
              { opacity: hintOpacity }
            ]}
          >
            <MaterialCommunityIcons 
              name="gesture-swipe-left" 
              size={24} 
              color="white" 
            />
          </Animated.View>
        )}
        
        {/* Main content - No responder handlers here */}
        <Animated.View 
          style={[
            styles.itemContainer,
            { 
              transform: [{ translateX: pan.x }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
              backgroundColor: theme.colors.cardBackground,
              opacity: 0.95 // Slightly reduce opacity to indicate not interactive
            }
          ]}
          pointerEvents="none" // Completely disable all touch interactions
        >
          <View style={styles.itemContentContainer}>
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
          </View>
        </Animated.View>
      </View>
    );
  };
  
  // Render a single item - Updated to use the swipeable component
  const renderItem = ({ item }: { item: PantryItemDocument }) => (
    <SwipeablePantryItem item={item} />
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

  // Render standard view or categorized edit view based on mode
  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading pantry items...</Text>
        </View>
      );
    }
    
    if (isEditMode) {
      // Render categorized view with edit capabilities
      if (Object.keys(categorizedItems).length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="basket-outline" size={64} color={theme.colors.neutral} />
            <Text style={styles.emptyText}>Your pantry is empty</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleAddItem}
            >
              <Text style={styles.emptyButtonText}>Add Items</Text>
            </TouchableOpacity>
          </View>
        );
      }
      
      return (
        <ScrollView style={styles.content}>
          {Object.entries(categorizedItems)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>{category}</Text>
                {items.map(item => (
                  <View key={item.id} style={styles.editItemContainer}>
                    <View style={styles.editItemContent}>
                      <Text style={styles.editItemName}>{item.name}</Text>
                      <Text style={styles.editItemDetails}>
                        {item.quantity} {item.unit}
                        {item.expirationDate && 
                          ` • Expires: ${formatDate(item.expirationDate.toDate())}`}
                      </Text>
                    </View>
                    <View style={styles.editItemActions}>
                      <TouchableOpacity
                        style={styles.editItemButton}
                        onPress={() => handleEditItem(item)}
                      >
                        <Ionicons name="pencil" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editItemButton}
                        onPress={() => handleDeleteItem(item.id)}
                      >
                        <Ionicons name="trash" size={20} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
        </ScrollView>
      );
    }
    
    // Render swipe-only view
    if (filteredItems.length === 0) {
      return (
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
      );
    }
    
    return (
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
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {isFromProfile && !isEditMode && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        {isEditMode && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text style={[
          styles.title, 
          (isFromProfile || isEditMode) && { marginLeft: 8 }
        ]}>
          {isEditMode ? 'Manage Pantry' : 'My Pantry'}
        </Text>
        {!isEditMode && (
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.managePantryButton}
              onPress={() => {
                // Navigate to the full edit version of the pantry
                navigation.navigate('PantryEdit');
              }}
            >
              <MaterialCommunityIcons name="pencil" size={16} color="white" />
              <Text style={styles.managePantryButtonText}>Manage</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddItem}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
        {isEditMode && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddItem}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Swipe Tip Banner with animation - only show in swipe mode */}
      {showSwipeTip && !isEditMode && (
        <Animated.View 
          style={[
            styles.swipeTipContainer,
            { 
              backgroundColor: '#FFEBEE', 
              paddingVertical: 14,
              borderLeftWidth: 4,
              borderLeftColor: '#D32F2F',
              opacity: swipeTipAnimation,
              transform: [{ 
                translateY: swipeTipAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0]
                }) 
              }]
            }
          ]}
        >
          <View style={styles.swipeTipIcon}>
            <MaterialCommunityIcons name="gesture-swipe-left" size={30} color="#D32F2F" />
          </View>
          <View style={styles.swipeTipContent}>
            <Text style={[styles.swipeTipTitle, { color: '#D32F2F', fontWeight: 'bold' }]}>
              Swipe Only Mode
            </Text>
            <Text style={[styles.swipeTipText, { color: '#D32F2F' }]}>
              Tapping on items is disabled. You can only swipe left to delete items.
            </Text>
          </View>
          
          {/* Close button */}
          <TouchableOpacity 
            style={styles.swipeTipCloseButton}
            onPress={() => {
              Animated.timing(swipeTipAnimation, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
              }).start(() => {
                setShowSwipeTip(false);
              });
            }}
          >
            <Ionicons name="close" size={20} color="#D32F2F" />
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Instruction banner for edit mode */}
      {isEditMode && (
        <View style={[styles.instructionContainer, { backgroundColor: '#E3F2FD' }]}>
          <MaterialCommunityIcons name="information-outline" size={24} color="#1976D2" />
          <Text style={styles.instructionText}>
            Tap the pencil icon to edit an item or the trash icon to delete it. Use the + button to add new items.
          </Text>
        </View>
      )}
      
      {!isEditMode && (
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
      )}
      
      {!isEditMode && renderCategoryChips()}
      
      {renderContent()}
      
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
                {isItemEditMode ? 'Edit Pantry Item' : 'Add Pantry Item'}
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
                  {isItemEditMode ? 'Update' : 'Add'}
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
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  managePantryButton: {
    backgroundColor: theme.colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 12,
  },
  managePantryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    zIndex: 1,
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
  swipeableContainer: {
    position: 'relative',
    marginBottom: 10,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden', // Ensure content doesn't escape rounded corners
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  deleteBackgroundButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  swipeHint: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContentContainer: {
    flex: 1,
  },
  swipeTipContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    position: 'relative', // For absolute positioning of close button
  },
  swipeTipText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
    flex: 1,
  },
  swipeTipIcon: {
    marginRight: 12,
  },
  swipeTipContent: {
    flex: 1,
  },
  swipeTipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  swipeTipCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 10, // Ensure it's above other content
  },
  categorySection: {
    marginBottom: 16,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: 8,
    marginHorizontal: 16,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  editItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  editItemContent: {
    flex: 1,
  },
  editItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  editItemDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  editItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editItemButton: {
    padding: 8,
    marginLeft: 8,
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  instructionText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 12,
    flex: 1,
  },
  content: {
    padding: 16,
  },
});

export default PantryScreen; 