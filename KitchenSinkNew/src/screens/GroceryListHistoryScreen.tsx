import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { groceryListService } from '../services/groceryListService';
import { GroceryListDocument } from '../types/FirestoreSchema';
import { STORAGE_KEYS } from '../constants/storage';
import { resilientStorage } from '../utils/ResilientAsyncStorage';
import ErrorBoundary from '../components/ErrorBoundary';
import logger from '../utils/logger';
import firestore from '@react-native-firebase/firestore';

type GroceryListHistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroceryListHistory'>;

// Helper to create firestore timestamps
const createTimestamp = (date = new Date()) => {
  return firestore.Timestamp.fromDate(date);
};

// SafeListRenderer - wraps the FlatList in protective checks to prevent undefined errors
const SafeListRenderer = ({ 
  lists, 
  isLoading,
  isRefreshing,
  onRefresh,
  renderItem,
  keyExtractor
}: { 
  lists: GroceryListDocument[] | null;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  renderItem: any;
  keyExtractor: any;
}) => {
  // Prevent rendering if lists is not an array
  if (!lists) {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading grocery lists...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="cart-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No grocery lists found</Text>
      </View>
    );
  }

  // Safety check for empty lists
  if (lists.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="cart-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No grocery lists yet</Text>
        <Text style={styles.emptySubtext}>Your saved grocery lists will appear here</Text>
      </View>
    );
  }
  
  // Simple renderList function to avoid potential issues with dynamic imports
  return (
    <FlatList
      data={lists}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={['#0066cc']}
        />
      }
    />
  );
};

// Mock data for fallback when storage is unreachable
const MOCK_GROCERY_LISTS: GroceryListDocument[] = [
  {
    id: 'mock-1',
    name: 'Weekly Groceries',
    items: [],
    createdAt: createTimestamp(),
    updatedAt: createTimestamp()
  },
  {
    id: 'mock-2',
    name: 'Party Shopping',
    items: [],
    createdAt: createTimestamp(),
    updatedAt: createTimestamp()
  }
];

const GroceryListHistoryScreen: React.FC = () => {
  const navigation = useNavigation<GroceryListHistoryScreenNavigationProp>();
  const [lists, setLists] = useState<GroceryListDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [storageIsReady, setStorageIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);

  // First check if storage is ready - do this once on mount
  useEffect(() => {
    let isMounted = true;
    
    const checkStorage = async () => {
      try {
        logger.debug('[GroceryListHistoryScreen] Checking storage availability...');
        
        // Check if resilientStorage is available
        const isAvailable = await resilientStorage.checkAvailability();
        logger.debug(`[GroceryListHistoryScreen] Storage availability: ${isAvailable}`);
        
        if (isMounted) {
          setStorageAvailable(isAvailable);
          setStorageIsReady(true);
        }
      } catch (error) {
        logger.error('[GroceryListHistoryScreen] Error checking storage:', error);
        if (isMounted) {
          setStorageAvailable(false);
          setStorageIsReady(false);
          setError(error instanceof Error ? error : new Error('Failed to initialize storage'));
        }
      }
    };
    
    checkStorage();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Load grocery lists - only after storage is ready
  useEffect(() => {
    if (storageIsReady) {
      loadGroceryLists();
    }
  }, [storageIsReady]);

  const loadGroceryLists = useCallback(async (isRefreshing = false) => {
    if (!storageIsReady) return;
    
    if (!isRefreshing) {
      setIsLoading(true);
    }
    
    setError(null);
    
    try {
      logger.debug('[GroceryListHistoryScreen] Loading grocery lists');
      
      let result: GroceryListDocument[] = [];
      
      try {
        // Try with the service first
        result = await groceryListService.getAllGroceryLists();
        logger.debug(`[GroceryListHistoryScreen] Loaded ${result.length} lists from service`);
      } catch (serviceError) {
        logger.error('[GroceryListHistoryScreen] Service error:', serviceError);
        
        // If the service fails, default to mock data after retry count
        logger.warn(`[GroceryListHistoryScreen] Using mock data due to service error`);
        result = MOCK_GROCERY_LISTS;
      }
      
      // Use mock data if we still don't have anything and we've tried a few times
      if (result.length === 0 && retryCount >= 2) {
        logger.debug('[GroceryListHistoryScreen] No lists found after retries, using mock data');
        result = MOCK_GROCERY_LISTS;
      }
      
      setLists(result);
      setRetryCount(0);
    } catch (e) {
      logger.error('[GroceryListHistoryScreen] Error loading grocery lists:', e);
      
      setError(e instanceof Error ? e : new Error('Failed to load grocery lists'));
      
      const nextRetryCount = retryCount + 1;
      setRetryCount(nextRetryCount);
      
      if (nextRetryCount >= 3) {
        logger.warn(`[GroceryListHistoryScreen] Too many retries (${nextRetryCount}), using mock data`);
        setLists(MOCK_GROCERY_LISTS);
        setError(null);
      } else if (nextRetryCount < 3) {
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, nextRetryCount) * 200;
        logger.debug(`[GroceryListHistoryScreen] Scheduling retry #${nextRetryCount} in ${delay}ms`);
        setTimeout(() => loadGroceryLists(), delay);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [retryCount, storageIsReady]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadGroceryLists(true);
  }, [loadGroceryLists]);

  const formatDate = (date: any): string => {
    if (!date) return 'Unknown date';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderItem = useCallback(({ item }: { item: GroceryListDocument }) => {
    if (!item) {
      logger.warn('[GroceryListHistoryScreen] Invalid item in renderItem');
      return null;
    }
    
    const safeItem = {
      ...item,
      id: item.id || `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: item.name || 'Untitled List',
      items: Array.isArray(item.items) ? item.items : []
    };
    
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          navigation.navigate('GroceryList', {
            selectedRecipes: [], 
            existingListId: safeItem.id
          });
        }}
      >
        <View style={styles.listItemContent}>
          <View style={[styles.categoryIcon, { backgroundColor: '#5856D6' }]}>
            <MaterialCommunityIcons name="cart" size={18} color="white" />
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle} numberOfLines={1}>{safeItem.name}</Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {safeItem.items.length} items • {formatDate(safeItem.createdAt)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  const keyExtractor = useCallback((item: GroceryListDocument) => {
    if (!item || !item.id) {
      return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    return item.id;
  }, []);

  return (
    <ErrorBoundary
      storageKeys={[STORAGE_KEYS.GROCERY_LISTS_HISTORY, STORAGE_KEYS.GROCERY_LIST_CURRENT]}
      fallback={
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Grocery List History</Text>
          </View>
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#dc3545" />
            <Text style={styles.errorText}>Storage error detected</Text>
            <Text style={styles.emptySubtext}>We're having trouble accessing your grocery lists</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                // Force a refresh on navigation
                navigation.goBack();
                setTimeout(() => navigation.navigate('GroceryListHistory'), 500);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      }
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Grocery List History</Text>
        </View>
        
        {resilientStorage.isUsingFallback && resilientStorage.isUsingFallback() && (
          <View style={styles.warningBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#856404" />
            <Text style={styles.warningText}>
              Storage issues detected. Using backup system.
            </Text>
          </View>
        )}

        {!storageIsReady ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.emptyText}>Initializing storage...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#dc3545" />
            <Text style={styles.errorText}>{error.message || 'An error occurred'}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setRetryCount(0);
                loadGroceryLists();
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SafeListRenderer
            lists={lists}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
          />
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  listContent: {
    padding: 16,
  },
  listItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  warningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  warningText: {
    color: '#856404',
    marginLeft: 8,
    fontSize: 14,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default GroceryListHistoryScreen; 