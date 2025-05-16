import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
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
// import { PantryItemCard } from '../components/PantryItemCard'; // This line should be commented out
import { getPantryItems, addPantryItem, deletePantryItem, updatePantryItem } from '../services/pantryService'; // Uncomment getPantryItems, addPantryItem, and deletePantryItem
import { theme } from '../styles/theme';
import logger from '../utils/logger';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Network from 'expo-network'; // Uncomment Network
import { resilientStorage } from '../utils/ResilientAsyncStorage';
import { AddPantryItemModal } from '../components/AddPantryItemModal'; // Uncomment this
import { LinearGradient } from 'expo-linear-gradient'; // Import LinearGradient

// Immediate log to check resilientStorage at module load time
logger.debug('[PantryScreen MODULE LOAD] resilientStorage status:', resilientStorage);

// Uncomment MOCK_PANTRY_ITEMS
const MOCK_PANTRY_ITEMS: PantryItem[] = [
  { id: 'mock-1', name: 'Milk', quantity: 1, unit: 'gallon', category: 'Dairy' },
  { id: 'mock-2', name: 'Eggs', quantity: 12, unit: 'count', category: 'Dairy' },
  { id: 'mock-3', name: 'Bread', quantity: 1, unit: 'loaf', category: 'Bakery' },
  { id: 'mock-4', name: 'Butter', quantity: 1, unit: 'pound', category: 'Dairy' },
];

/* // Keep CATEGORIES commented for now
const CATEGORIES = [
  // ...
];
*/

// Uncomment PantryItemRow
/*
const PantryItemRow = React.memo(({ item, onDelete }: { item: PantryItem, onDelete: (id: string) => void }) => {
  return (
    <PantryItemCard item={item} onDelete={onDelete} />
  );
});
*/

/* // Keep PantryItemsList (the more complex wrapper) commented for now
const PantryItemsList = ({ ... }) => {
  // ...
};
*/

const PantryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Pantry'>>();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true); // Uncomment isOnline state
  
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // const [renderError, setRenderError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storageServiceReady, setStorageServiceReady] = useState(false);
  
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  // loadItems and its dependent useEffects are now being uncommented
  const loadItems = useCallback(async () => {
    if (!storageServiceReady) { 
      logger.warn('[PantryScreen loadItems] Attempted to load items, but storage service is not ready. Aborting.');
      return;
    }
    if (!user?.uid) {
      logger.warn('[PantryScreen loadItems] User not available. Aborting.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      // setRenderError(null); // Keep renderError logic out for now
      logger.debug('[PantryScreen] Loading pantry items...');
      
      const networkState = await Network.getNetworkStateAsync();
      setIsOnline(networkState.isConnected ?? false);

      if (!networkState.isConnected) {
        if (resilientStorage && typeof resilientStorage.getItem === 'function') {
          const cachedItems = await resilientStorage.getItem('pantryItems');
        if (cachedItems) {
          setItems(JSON.parse(cachedItems));
          setLoading(false);
          return;
          }
        } else {
          logger.warn('[PantryScreen] resilientStorage.getItem is not available for loading cached items offline.');
        }
      }

      let result: PantryItem[] = [];
      
      try {
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
      
      if (resilientStorage && typeof resilientStorage.setItem === 'function') {
        await resilientStorage.setItem('pantryItems', JSON.stringify(result));
      } else {
        logger.warn('[PantryScreen] resilientStorage.setItem is not available for caching items.');
      }
    } catch (e) {
      logger.error('[PantryScreen] Error loading pantry items:', e);
      setError('Failed to load pantry items. Please try again.');
      
      if (resilientStorage && typeof resilientStorage.getItem === 'function') {
        const cachedItems = await resilientStorage.getItem('pantryItems');
      if (cachedItems) {
        setItems(JSON.parse(cachedItems));
        }
      } else {
        logger.warn('[PantryScreen] resilientStorage.getItem is not available for fallback loading.');
      }
      
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
  }, [user?.uid, retryCount, isOnline, storageServiceReady]);

  useEffect(() => {
    logger.debug('[PantryScreen MOUNT] resilientStorage status in useEffect:', resilientStorage);
    if (resilientStorage) {
      setStorageServiceReady(true);
    }
  }, []);

  // Load items when user is available AND storage service is ready
  useEffect(() => {
    if (user?.uid && storageServiceReady) {
      logger.debug('[PantryScreen] User and storage service ready, calling loadItems. UID:', user.uid.substring(0, 10) + '...');
      loadItems();
    } else if (user?.uid && !storageServiceReady) {
      logger.warn('[PantryScreen] User is ready, but storage service is NOT. Holding off on loadItems.');
    }
  }, [user?.uid, storageServiceReady, loadItems]);

  // Uncomment Animation Effect
  useEffect(() => {
    if (items && items.length > 0 && !loading) { // Ensure items has length before animating
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
  }, [items, loading, fadeAnim, slideAnim]); // Added fadeAnim, slideAnim to deps

  // Uncomment handleDeleteItem function
  const handleDeleteItem = async (itemId: string) => {
    if (!user?.uid) {
        Alert.alert("Error", "You must be logged in to delete items.");
        return;
    }
    if (!storageServiceReady) {
        logger.warn('[PantryScreen handleDeleteItem] Storage service not ready.');
        Alert.alert('Error', 'Storage service is not ready, please try again shortly.');
        return;
    }

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
              logger.debug(`[PantryScreen] Attempting to delete item: ${itemId}`);
              let success = false;
              if (fallbackMode) {
                // In fallback mode, just update UI and cache if possible
                success = true;
                logger.info('[PantryScreen] Fallback mode: Simulating delete.');
              } else {
                success = await deletePantryItem(user.uid, itemId);
              }
              
              if (success) {
                const updatedItems = items.filter(item => item.id !== itemId);
                setItems(updatedItems);
                if (resilientStorage && typeof resilientStorage.setItem === 'function') {
                  await resilientStorage.setItem('pantryItems', JSON.stringify(updatedItems));
                }
                logger.debug(`[PantryScreen] Successfully deleted item: ${itemId} and updated cache.`);
              } else {
                Alert.alert('Error', 'Failed to delete item. It might have already been removed or a server error occurred.');
                logger.warn(`[PantryScreen] deletePantryItem service call returned false for item: ${itemId}`);
              }
            } catch (error) {
              logger.error('[PantryScreen] Error deleting pantry item:', error);
              Alert.alert('Error', 'An error occurred while deleting the item.');
              // Optimistically remove from UI if server delete fails but error is caught
              // This might be too aggressive depending on desired UX
              // setItems(prev => prev.filter(item => item.id !== itemId)); 
            }
          },
        },
      ]
    );
  };

  // Uncomment handleAddItem function
  const handleAddItem = async (name: string, quantity: number, unit: string, category: string) => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to add items.');
      return;
    }
    if (!storageServiceReady) {
        logger.warn('[PantryScreen handleAddItem] Storage service not ready.');
        Alert.alert('Error', 'Storage service is not ready, please try again shortly.');
        return;
    }

    try {
      logger.debug(`[PantryScreen] Adding item: ${name}, ${quantity} ${unit}, ${category}`);
      
      let itemId: string | null = null;
      
      if (fallbackMode) { // Assuming fallbackMode state exists and is managed
        itemId = `mock-${Date.now()}`;
        const newItem: PantryItem = { id: itemId, name, quantity, unit, category };
        const updatedItems = [...items, newItem];
        setItems(updatedItems);
        if (resilientStorage && typeof resilientStorage.setItem === 'function') {
          await resilientStorage.setItem('pantryItems', JSON.stringify(updatedItems));
        }
        logger.debug(`[PantryScreen] Successfully added mock item with ID: ${itemId}`);

      } else {
        itemId = await addPantryItem(user.uid, { name, quantity, unit, category });
        if (itemId) {
          const newItem: PantryItem = { id: itemId, name, quantity, unit, category };
          const updatedItems = [...items, newItem];
          setItems(updatedItems);
          if (resilientStorage && typeof resilientStorage.setItem === 'function') {
            await resilientStorage.setItem('pantryItems', JSON.stringify(updatedItems));
          }
          logger.debug(`[PantryScreen] Successfully added item with ID: ${itemId} to Firestore and cache`);
        } else {
          Alert.alert('Error', 'Failed to add item to the pantry.');
        }
      }
    } catch (error) {
      logger.error('[PantryScreen] Error adding pantry item:', error);
      Alert.alert('Error', 'An error occurred while adding the item.');
    }
    setModalVisible(false);
  };

  const handleOpenEditModal = (item: PantryItem) => {
    setEditingItem(item);
    setEditModalVisible(true);
  };

  // Placeholder for actual update logic
  const handleUpdatePantryItem = async (id: string, name: string, quantity: number, unit: string, category: string) => {
    if (!user?.uid) {
      Alert.alert("Error", "You must be logged in to update items.");
      return;
    }
    if (!storageServiceReady) {
      logger.warn('[PantryScreen handleUpdatePantryItem] Storage service not ready.');
      Alert.alert('Error', 'Storage service is not ready, please try again shortly.');
      return;
    }
    
    logger.debug('[PantryScreen] Attempting to update item in Firestore:', { id, name, quantity, unit, category });

    const itemDataToUpdate: Partial<Omit<PantryItem, 'id'>> = { name, quantity, unit, category };

    let success = false;
    if (fallbackMode) {
      logger.info('[PantryScreen] Fallback mode: Simulating update for item:', id);
      success = true; // Simulate success for UI update in fallback
    } else {
      success = await updatePantryItem(user.uid, id, itemDataToUpdate);
    }

    if (success) {
      const updatedItems = items.map(item => 
        item.id === id ? { ...item, ...itemDataToUpdate } : item
      );
      setItems(updatedItems);
      if (resilientStorage && typeof resilientStorage.setItem === 'function') {
        await resilientStorage.setItem('pantryItems', JSON.stringify(updatedItems));
      }
      logger.info(`[PantryScreen] Successfully updated item: ${id}. UI and cache updated.`);
      Alert.alert("Success", "Item successfully updated.");
    } else {
      Alert.alert("Error", "Failed to update item in Firestore. Please try again.");
      logger.error(`[PantryScreen] Firestore update failed for item: ${id}`);
    }

    setEditingItem(null);
    setEditModalVisible(false);
  };

  // Simplified render, but with structure and some state display
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={styles.title.color} />
        </TouchableOpacity>
        <Text style={styles.title}>My Pantry</Text>
        <TouchableOpacity
          style={styles.addButtonContainer}
          onPress={() => setModalVisible(true)}
        >
          <LinearGradient
            colors={['#D9A15B', '#B57A42']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
        {loading === true && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={'#D9A15B'} />
              <Text style={styles.loadingText}>Loading pantry items...</Text>
            </View>
        )}

        {loading === false && error !== null && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading === false && error === null && items.length === 0 && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="fridge-outline" size={48} color="#A09483" />
              <Text style={styles.emptyText}>Your pantry is empty.</Text>
          </View>
        )}
        
        {loading === false && error === null && items.length > 0 && (
          <ScrollView style={styles.listContent}>
            {items.map(item => (
              <View key={item.id} style={styles.simpleItemContainer}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.simpleItemName}>{item.name}</Text>
                  <Text style={styles.simpleItemQuantity}>{item.quantity} {item.unit}</Text>
                </View>
                <TouchableOpacity onPress={() => handleOpenEditModal(item)} style={styles.simpleEditButton}> 
                  <Ionicons name="pencil-outline" size={22} color={'#D9A15B'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.simpleDeleteButton}> 
                  <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
            ))}
          </ScrollView>
          )}
        </Animated.View>

      <View style={{ padding:10, borderTopWidth: 1, borderColor: '#ccc'}}>
        <Text>Debug Info:</Text>
        <Text>Storage Service Ready: {storageServiceReady ? 'Yes' : 'No'}</Text>
        <Text>User: {user ? user.uid.substring(0,5) : 'Not logged in'}</Text>
        <Text>Items count: {items.length}</Text>
        <Text>Loading state: {loading ? 'True' : 'False'}</Text>
        <Text>Error state: {error || 'null'}</Text>
      </View>

      {/* Modal for Adding - controlled by modalVisible */}
      <AddPantryItemModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddItem}
        modalTitle="Add New Pantry Item"
      />

      {/* Modal for Editing - controlled by editModalVisible and editingItem */}
      {editingItem && (
        <AddPantryItemModal
          visible={editModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setEditingItem(null);
          }}
          onSaveEdit={handleUpdatePantryItem} // This should call the updated handler
          itemToEdit={editingItem}
          modalTitle="Edit Pantry Item"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4E4E4E',
  },
  addButtonContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  addButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { 
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  simpleItemContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16, 
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  simpleItemName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4E4E4E',
  },
  simpleItemQuantity: {
    fontSize: 14,
    color: '#7A736A',
    marginTop: 4, 
  },
  simpleEditButton: { 
    padding: 8,
    marginRight: 4,
  },
  simpleDeleteButton: { 
    padding: 8,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#7A736A',
  },
  errorContainer: {
    flex:1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: theme.colors.error,
    marginVertical: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  emptyContainer: {
    flex:1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#7A736A',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default PantryScreen; 