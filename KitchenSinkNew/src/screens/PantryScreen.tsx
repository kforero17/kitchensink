import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { PantryItem } from '../types/PantryItem';
import { PantryItemCard } from '../components/PantryItemCard';
import { AddPantryItemModal } from '../components/AddPantryItemModal';
import { getPantryItems, addPantryItem, deletePantryItem } from '../services/pantryService';
import { theme } from '../styles/theme';
import logger from '../utils/logger';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Network from 'expo-network';
// import { resilientStorage } from '../utils/ResilientAsyncStorage';

// logger.debug('[PantryScreen] Imported resilientStorage:', resilientStorage);

// Simple in-memory storage to replace resilientStorage
const inMemoryStorage = {
  _store: new Map<string, string>(),
  
  getItem: async (key: string): Promise<string | null> => {
    logger.debug(`[InMemoryStorage] Getting key: ${key}`);
    return inMemoryStorage._store.get(key) || null;
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    logger.debug(`[InMemoryStorage] Setting key: ${key}`);
    inMemoryStorage._store.set(key, value);
  },
  
  removeItem: async (key: string): Promise<void> => {
    logger.debug(`[InMemoryStorage] Removing key: ${key}`);
    inMemoryStorage._store.delete(key);
  }
};

// Mock pantry items for when storage fails
const MOCK_PANTRY_ITEMS: PantryItem[] = [
  { id: 'mock-1', name: 'Milk', quantity: 1, unit: 'gallon', category: 'Dairy' },
  { id: 'mock-2', name: 'Eggs', quantity: 12, unit: 'count', category: 'Dairy' },
  { id: 'mock-3', name: 'Bread', quantity: 1, unit: 'loaf', category: 'Bakery' },
  { id: 'mock-4', name: 'Butter', quantity: 1, unit: 'pound', category: 'Dairy' },
];

// Categories for pantry items
const CATEGORIES = [
  'All',
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

// This component renders a single item from the pantry list
const PantryItemRow = React.memo(({ item, onDelete }: { item: PantryItem, onDelete: (id: string) => void }) => {
  return (
    <PantryItemCard item={item} onDelete={onDelete} />
  );
});

// This separates the list rendering from any AsyncStorage dependencies
const PantryItemsList = ({ 
  items, 
  isLoading,
  onDelete,
  onEmptyPress
}: { 
  items: PantryItem[] | null;
  isLoading: boolean;
  onDelete: (id: string) => void;
  onEmptyPress: () => void;
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading pantry items...</Text>
      </View>
    );
  }

  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="fridge-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>
          {!items ? 'Unable to load pantry items' : 'Your pantry is empty'}
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={onEmptyPress}
        >
          <Text style={styles.emptyButtonText}>
            {!items ? 'Retry' : 'Add Items'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // This ensures that we don't render if items is not valid
  const validItems = Array.isArray(items) ? items : [];
  
  try {
    return (
      <FlatList
        data={validItems}
        renderItem={({ item }) => (
          <PantryItemRow
            key={item?.id || `item-${Math.random()}`}
            item={item}
            onDelete={onDelete}
          />
        )}
        keyExtractor={item => item?.id || `item-${Math.random()}`}
        contentContainerStyle={styles.listContent}
      />
    );
  } catch (error) {
    logger.error('[PantryScreen] Error rendering items list:', error);
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#dc3545" />
        <Text style={styles.errorText}>Error displaying pantry items</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onEmptyPress}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
};

const PantryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Pantry'>>();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  
  // State management
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  // Check network status periodically
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        setIsOnline(networkState.isConnected ?? false);
      } catch (error) {
        logger.error('[PantryScreen] Error checking network status:', error);
        setIsOnline(true); // Assume online if we can't check
      }
    };

    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Load items when user is available
  useEffect(() => {
    if (user?.uid) {
      logger.debug('[PantryScreen] User detected, uid:', user.uid.substring(0, 10) + '...');
      loadItems();
    }
  }, [user?.uid]);

  // Animate in when items are loaded
  useEffect(() => {
    if (items && !loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [items, loading]);

  const loadItems = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      setError(null);
      setRenderError(null);
      logger.debug('[PantryScreen] Loading pantry items...');
      
      // Check network status
      const networkState = await Network.getNetworkStateAsync();
      setIsOnline(networkState.isConnected ?? false);

      if (!networkState.isConnected) {
        // Try to load from local storage
        const cachedItems = await inMemoryStorage.getItem('pantryItems');
        if (cachedItems) {
          setItems(JSON.parse(cachedItems));
          setLoading(false);
          return;
        }
      }

      let result: PantryItem[] = [];
      
      try {
        // Try loading from service with timeout
        const loadingPromise = getPantryItems(user.uid);
        const timeoutPromise = new Promise<PantryItem[]>((_, reject) => {
          setTimeout(() => reject(new Error('Pantry items loading timeout')), 5000);
        });
        
        result = await Promise.race([loadingPromise, timeoutPromise]);
        logger.debug(`[PantryScreen] Loaded ${result.length} pantry items from service`);
      } catch (serviceError) {
        logger.error('[PantryScreen] Service error:', serviceError);
        
        if (retryCount >= 2) {
          logger.warn('[PantryScreen] Using mock data after multiple failures');
          result = MOCK_PANTRY_ITEMS;
          setFallbackMode(true);
        } else {
          throw serviceError;
        }
      }
      
      setItems(result);
      setRetryCount(0);
      
      // Cache items locally
      await inMemoryStorage.setItem('pantryItems', JSON.stringify(result));
    } catch (e) {
      logger.error('[PantryScreen] Error loading pantry items:', e);
      setError('Failed to load pantry items. Please try again.');
      
      // Try to load from local storage as fallback
      const cachedItems = await inMemoryStorage.getItem('pantryItems');
      if (cachedItems) {
        setItems(JSON.parse(cachedItems));
      }
      
      // Implement exponential backoff for retries
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadItems();
        }, delay);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.uid, retryCount, isOnline]);

  const handleAddItem = async (name: string, quantity: number, unit: string, category: string) => {
    if (!user?.uid) return;

    try {
      logger.debug(`[PantryScreen] Adding item: ${name}, ${quantity} ${unit}`);
      
      let itemId: string | null = null;
      
      if (fallbackMode) {
        itemId = `mock-${Date.now()}`;
      } else {
        itemId = await addPantryItem(user.uid, { name, quantity, unit, category });
      }
      
      if (itemId) {
        const updatedItems = [...items, { id: itemId!, name, quantity, unit, category }];
        setItems(updatedItems);
        
        // Update local cache
        await inMemoryStorage.setItem('pantryItems', JSON.stringify(updatedItems));
        logger.debug(`[PantryScreen] Successfully added item with ID: ${itemId}`);
      } else {
        Alert.alert('Error', 'Failed to add item');
      }
    } catch (error) {
      logger.error('[PantryScreen] Error adding pantry item:', error);
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user?.uid) return;

    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              logger.debug(`[PantryScreen] Deleting item: ${itemId}`);
              
              let success = false;
              
              if (fallbackMode) {
                success = true;
              } else {
                success = await deletePantryItem(user.uid, itemId);
              }
              
              if (success) {
                const updatedItems = items.filter(item => item.id !== itemId);
                setItems(updatedItems);
                
                // Update local cache
                await inMemoryStorage.setItem('pantryItems', JSON.stringify(updatedItems));
                logger.debug('[PantryScreen] Successfully deleted item');
              } else {
                Alert.alert('Error', 'Failed to delete item');
              }
            } catch (error) {
              logger.error('[PantryScreen] Error deleting pantry item:', error);
              Alert.alert('Error', 'Failed to delete item');
              
              setItems(prev => {
                if (!prev) return [];
                return prev.filter(item => item.id !== itemId);
              });
            }
          },
        },
      ]
    );
  };

  const handleRetry = () => {
    setRetryCount(0);
    setFallbackMode(false);
    setError(null);
    setRenderError(null);
    loadItems();
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadItems();
  };

  // Filter items based on search query and selected category
  const filteredItems = useMemo(() => {
    logger.debug('[PantryScreen] Recalculating filteredItems. Current items count:', items?.length);
    if (!items) return [];
    
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  // Render category filter buttons
  const renderCategoryButton = (category: string) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.categoryButton,
        selectedCategory === category && styles.categoryButtonSelected
      ]}
      onPress={() => setSelectedCategory(category)}
    >
      <Text style={[
        styles.categoryButtonText,
        selectedCategory === category && styles.categoryButtonTextSelected
      ]}>
        {category}
      </Text>
    </TouchableOpacity>
  );

  // Render search bar
  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <MaterialCommunityIcons name="magnify" size={24} color="#666" />
      <TextInput
        style={styles.searchInput}
        placeholder="Search pantry items..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#666"
      />
      {searchQuery ? (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <MaterialCommunityIcons name="close-circle" size={20} color="#666" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (renderError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Pantry</Text>
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#dc3545" />
          <Text style={styles.errorText}>Storage error detected</Text>
          <Text style={styles.errorSubtext}>{renderError.message || 'We\'re having trouble accessing your pantry items'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  logger.debug('[PantryScreen] PRE-RENDER: About to render main content. Filtered items count:', filteredItems?.length);
  logger.debug('[PantryScreen] PRE-RENDER: Current error state:', error);
  logger.debug('[PantryScreen] PRE-RENDER: Current loading state:', loading);
  logger.debug('[PantryScreen] PRE-RENDER: Fallback mode:', fallbackMode);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Pantry</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          disabled={loading}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {fallbackMode && (
        <View style={styles.warningBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#856404" />
          <Text style={styles.warningText}>
            Storage issues detected. Using backup system.
          </Text>
        </View>
      )}

      {!isOnline && (
        <View style={styles.warningBanner}>
          <MaterialCommunityIcons name="wifi-off" size={20} color="#856404" />
          <Text style={styles.warningText}>
            You're offline. Changes will sync when you're back online.
          </Text>
        </View>
      )}
      
      {error ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        (() => {
          logger.debug('[PantryScreen] FINAL PRE-FLATLIST_RENDER_STATE:', {
            loading,
            error,
            items: items ? `Count: ${items.length}` : 'null/undefined',
            filteredItems: filteredItems ? `Count: ${filteredItems.length}` : 'null/undefined',
            isOnline,
            fallbackMode
          });
          return null; // This IIFE is just for logging
        })(),
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {renderSearchBar()}
          <View style={styles.categoriesContainer}>
            <FlatList
              data={CATEGORIES}
              renderItem={({ item }) => renderCategoryButton(item)}
              keyExtractor={item => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
            />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading pantry items...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="fridge-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {!items ? 'Unable to load pantry items' : 'Your pantry is empty'}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.emptyButtonText}>
                  {!items ? 'Retry' : 'Add Items'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <React.Fragment>
              <FlatList
                data={filteredItems}
                renderItem={({ item }) => (
                  <PantryItemRow
                    key={item?.id || `item-${Math.random()}`}
                    item={item}
                    onDelete={handleDeleteItem}
                  />
                )}
                keyExtractor={item => item?.id || `item-${Math.random()}`}
                contentContainerStyle={styles.listContent}
                onRefresh={handleRefresh}
                refreshing={isRefreshing}
              />
            </React.Fragment>
          )}
        </Animated.View>
      )}
      
      <AddPantryItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddItem}
      />
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
    padding: 16,
    backgroundColor: theme.colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: theme.colors.cardBackground,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
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
  listContent: {
    padding: 16,
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
  errorContainer: {
    padding: 16,
    backgroundColor: theme.colors.cardBackground,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    marginVertical: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.error,
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  retryButtonText: {
    color: 'white',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffeeba',
  },
  warningText: {
    color: '#856404',
    marginLeft: 8,
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PantryScreen; 