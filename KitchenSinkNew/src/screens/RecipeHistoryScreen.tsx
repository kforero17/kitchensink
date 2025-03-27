import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { getRecipeHistory, RecipeHistoryItem } from '../utils/recipeHistory';
import { recipeFeedbackService, RecipeFeedback } from '../services/recipeFeedbackService';
import { firestoreService } from '../services/firebaseService';
import { RecipeDocument } from '../types/FirestoreSchema';
import AuthModal from '../components/AuthModal';
import { safeStorage } from '../utils/asyncStorageUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create a monkeypatch to ensure AsyncStorage is always available
// This prevents React Native internals from accessing an undefined AsyncStorage
(function monkeyPatchAsyncStorage() {
  // Create a simple in-memory implementation
  const memoryStorage = new Map<string, string>();
  
  // Create stub methods if AsyncStorage is ever undefined
  const asyncStorageStub = {
    getItem: async (key: string) => memoryStorage.get(key) || null,
    setItem: async (key: string, value: string) => { memoryStorage.set(key, value); },
    removeItem: async (key: string) => { memoryStorage.delete(key); },
    clear: async () => { memoryStorage.clear(); },
    getAllKeys: async () => Array.from(memoryStorage.keys()),
    multiGet: async (keys: string[]) => keys.map(key => [key, memoryStorage.get(key) || null]),
    multiSet: async (keyValuePairs: string[][]) => {
      keyValuePairs.forEach(([key, value]) => memoryStorage.set(key, value));
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach(key => memoryStorage.delete(key));
    },
  };
  
  // Patch the global AsyncStorage variable
  if (!AsyncStorage) {
    console.log('[AsyncStorage Patch] AsyncStorage was undefined, providing fallback');
    
    // @ts-ignore - force replace the undefined AsyncStorage
    global.AsyncStorage = asyncStorageStub;
  }
  
  // Also patch the module to ensure it's never undefined again
  const originalGet = Object.getOwnPropertyDescriptor(global, 'AsyncStorage');
  
  // Replace the property descriptor to prevent AsyncStorage from becoming undefined
  Object.defineProperty(global, 'AsyncStorage', {
    configurable: true,
    enumerable: true,
    get: function() {
      const currentValue = originalGet ? originalGet.get?.call(this) : AsyncStorage;
      return currentValue || asyncStorageStub;
    },
    set: function(val) {
      if (originalGet && originalGet.set) {
        originalGet.set.call(this, val || asyncStorageStub);
      }
    }
  });
})();

// Add a debug helper
const DEBUG_PREFIX = '[RecipeHistory Debug]';
const debugLog = (...args: any[]) => console.log(DEBUG_PREFIX, ...args);

// Debug AsyncStorage import status
debugLog('Starting RecipeHistoryScreen component');

// Update this type once you've added RecipeHistory to RootStackParamList
type RecipeHistoryNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
};

const RecipeHistoryScreen: React.FC = () => {
  const navigation = useNavigation<RecipeHistoryNavigationProp>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recipes, setRecipes] = useState<RecipeDocument[]>([]);
  const [feedbackRecipes, setFeedbackRecipes] = useState<(RecipeDocument & { feedback?: RecipeFeedback })[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Tabs for filtering recipes
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'cooked' | 'highlyRated'>('all');

  // Add debugging state
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);
  
  // Check storage availability on component mount
  useEffect(() => {
    const checkStorageAvailability = async () => {
      try {
        debugLog('Checking storage availability...');
        const isAvailable = await safeStorage.checkAvailability();
        setStorageAvailable(isAvailable);
        debugLog('Storage availability:', isAvailable);
      } catch (error) {
        debugLog('Error checking storage:', error);
        setStorageAvailable(false);
      }
    };
    
    checkStorageAvailability();
  }, []);

  // Add a new useEffect to catch any rendering errors
  useEffect(() => {
    const handleRenderingErrors = () => {
      // Add global error handler
      const originalConsoleError = console.error;
      console.error = (...args) => {
        // Look for AsyncStorage related errors
        const errorString = args.join(' ');
        if (
          errorString.includes('AsyncStorage') || 
          errorString.includes('Cannot read') ||
          errorString.includes('undefined')
        ) {
          debugLog('Caught potential AsyncStorage error:', args);
          // Update our storage availability state
          setStorageAvailable(false);
        }
        
        // Call original console.error
        originalConsoleError.apply(console, args);
      };
      
      // Cleanup when component unmounts
      return () => {
        console.error = originalConsoleError;
      };
    };
    
    return handleRenderingErrors();
  }, []);

  // Load recipe history data
  const loadHistoryData = async (forceRefresh = false) => {
    debugLog('Loading history data...');
    
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get recipes from the weekly meal plan
      debugLog('Fetching meal plan recipes...');
      const mealPlanRecipes = await firestoreService.getAllRecipes({ 
        isWeeklyMealPlan: true,
        forceRefresh: Date.now() 
      });
      debugLog(`Fetched ${mealPlanRecipes.length} meal plan recipes`);
      
      // Get user feedback history
      let feedbackHistory: RecipeFeedback[] = [];
      try {
        debugLog('Fetching feedback history...');
        feedbackHistory = await recipeFeedbackService.getUserFeedbackHistory(100);
        debugLog(`Fetched ${feedbackHistory.length} feedback items`);
      } catch (feedbackError) {
        debugLog('Error loading feedback history:', feedbackError);
        // Continue without feedback history
      }
      
      // Get feedback recipe IDs that are not in meal plan
      const feedbackRecipeIds = feedbackHistory
        .map(f => f.recipeId)
        .filter(id => !mealPlanRecipes.some(r => r.id === id));
      
      // Fetch feedback recipes if there are any
      let feedbackRecipesData: RecipeDocument[] = [];
      if (feedbackRecipeIds.length > 0) {
        try {
          // Get unique IDs (remove duplicates)
          const uniqueIds = [...new Set(feedbackRecipeIds)];
          
          // Fetch recipes by IDs - use getRecipe instead of getRecipeById
          debugLog(`Fetching ${uniqueIds.length} feedback recipes...`);
          const promises = uniqueIds.map(id => firestoreService.getRecipe(id));
          const results = await Promise.all(promises);
          
          // Filter out null results
          feedbackRecipesData = results.filter((r): r is RecipeDocument => r !== null);
          debugLog(`Successfully fetched ${feedbackRecipesData.length} feedback recipes`);
        } catch (recipeError) {
          debugLog('Error loading feedback recipes:', recipeError);
          // Continue with empty feedback recipes
        }
      }
      
      // Set all recipes
      debugLog('Setting combined recipes data...');
      setRecipes([...mealPlanRecipes, ...feedbackRecipesData]);
      
      // Combine recipes with feedback
      const recipesWithFeedback = [...mealPlanRecipes, ...feedbackRecipesData].map(recipe => {
        const feedback = feedbackHistory.find(f => f.recipeId === recipe.id);
        return {
          ...recipe,
          feedback
        };
      });
      
      setFeedbackRecipes(recipesWithFeedback);
      debugLog('Recipe history data loaded successfully');
    } catch (error) {
      debugLog('Error loading recipe history:', error);
      console.error('Error loading recipe history:', error);
      Alert.alert('Error', 'Failed to load recipe history. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      debugLog('Screen focused, loading history data...');
      loadHistoryData();
    }, [user])
  );

  const handleRefresh = () => {
    debugLog('Manual refresh triggered');
    setRefreshing(true);
    loadHistoryData(true);
  };

  const handleAuthSuccess = () => {
    debugLog('Auth success, reloading data');
    setShowAuthModal(false);
    loadHistoryData();
  };

  // Filter recipes based on active tab
  const getFilteredRecipes = () => {
    debugLog(`Filtering recipes by tab: ${activeTab}`);
    switch (activeTab) {
      case 'favorites':
        // Only include recipes that have been explicitly liked (not using isFavorite)
        return feedbackRecipes.filter(r => r.feedback?.isLiked === true);
      case 'cooked':
        return feedbackRecipes.filter(r => r.feedback?.isCooked);
      case 'highlyRated':
        // Filter for recipes with rating >= 3 and sort by rating in descending order
        return feedbackRecipes
          .filter(r => r.feedback?.rating && r.feedback.rating >= 3)
          .sort((a, b) => {
            // Sort by rating (highest first)
            const ratingA = a.feedback?.rating || 0;
            const ratingB = b.feedback?.rating || 0;
            return ratingB - ratingA;
          });
      case 'all':
      default:
        return feedbackRecipes;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            debugLog('Navigating back');
            navigation.goBack();
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipe History</Text>
      </View>

      {storageAvailable === false && (
        <View style={styles.warningBanner}>
          <MaterialCommunityIcons name="alert" size={20} color="#856404" />
          <Text style={styles.warningText}>Some features may be limited due to storage access issues</Text>
        </View>
      )}

      {!user ? (
        <View style={styles.authContainer}>
          <MaterialCommunityIcons name="account-lock" size={64} color="#ccc" />
          <Text style={styles.authTitle}>Sign in to see your recipe history</Text>
          <Text style={styles.authSubtitle}>
            Your recipe history and preferences will be saved when you sign in
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => setShowAuthModal(true)}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Filter tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'all' && styles.activeTab]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
              onPress={() => setActiveTab('favorites')}
            >
              <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>
                Favorites
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'cooked' && styles.activeTab]}
              onPress={() => setActiveTab('cooked')}
            >
              <Text style={[styles.tabText, activeTab === 'cooked' && styles.activeTabText]}>
                Cooked
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'highlyRated' && styles.activeTab]}
              onPress={() => setActiveTab('highlyRated')}
            >
              <Text style={[styles.tabText, activeTab === 'highlyRated' && styles.activeTabText]}>
                Top Rated
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#333" />
              <Text style={styles.loadingText}>Loading your recipe history...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
            >
              {(() => {
                try {
                  // Get the filtered recipes
                  const recipes = getFilteredRecipes();
                  debugLog(`Rendering ${recipes.length} recipes in ScrollView`);
                  
                  // If no recipes, render the empty component
                  if (recipes.length === 0) {
                    return (
                      <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="food-off" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No recipes found</Text>
                        <Text style={styles.emptySubtext}>
                          {activeTab === 'all'
                            ? 'Your recipe history will appear here'
                            : activeTab === 'favorites'
                            ? 'You haven\'t liked any recipes yet'
                            : activeTab === 'highlyRated'
                            ? 'No highly rated recipes found'
                            : 'You haven\'t cooked any recipes yet'}
                        </Text>
                        {storageAvailable === false && (
                          <Text style={styles.emptyWarningSubtext}>
                            Note: Some local history may not be available due to storage access issues
                          </Text>
                        )}
                      </View>
                    );
                  }
                  
                  // Manually render each recipe
                  return (
                    <View>
                      {recipes.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.recipeItem}
                          onPress={() => navigation.navigate('RecipeDetail', { recipe: item })}
                        >
                          <View style={styles.recipeCard}>
                            {item.imageUrl ? (
                              <Image source={{ uri: item.imageUrl }} style={styles.recipeImage} />
                            ) : (
                              <View style={[styles.recipeImage, styles.placeholderImage]}>
                                <MaterialCommunityIcons name="food" size={32} color="#ccc" />
                              </View>
                            )}
                            
                            {/* Add rating badge for highly rated recipes */}
                            {item.feedback?.rating && item.feedback.rating >= 4 && (
                              <View style={styles.ratingBadge}>
                                <MaterialCommunityIcons name="star" size={12} color="#FFF" />
                                <Text style={styles.ratingBadgeText}>{item.feedback.rating}</Text>
                              </View>
                            )}
                            
                            <View style={styles.recipeDetails}>
                              <Text style={styles.recipeName} numberOfLines={1}>{item.name}</Text>
                              
                              <View style={styles.recipeMetadata}>
                                <Text style={styles.recipeInfo}>
                                  {item.readyInMinutes || '?'} min • {item.servings || '?'} {item.servings === 1 ? 'serving' : 'servings'}
                                </Text>
                              </View>
                              
                              {/* Tags */}
                              {item.tags && item.tags.length > 0 && (
                                <View style={styles.tagContainer}>
                                  {item.tags.some(tag => ['breakfast', 'lunch', 'dinner', 'snacks'].includes(tag)) && (
                                    <View style={styles.mealTypeTag}>
                                      <Text style={styles.mealTypeText}>
                                        {item.tags.includes('breakfast') ? 'Breakfast' : 
                                        item.tags.includes('lunch') ? 'Lunch' : 
                                        item.tags.includes('dinner') ? 'Dinner' : 'Snack'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                              
                              {/* Feedback indicators */}
                              <View style={styles.feedbackIndicators}>
                                {item.feedback?.isCooked && (
                                  <MaterialCommunityIcons name="silverware-variant" size={16} color="#4CAF50" style={styles.feedbackIcon} />
                                )}
                                {item.feedback?.isLiked === true && (
                                  <MaterialCommunityIcons name="heart" size={16} color="#FF4081" style={styles.feedbackIcon} />
                                )}
                                {item.feedback?.isDisliked && (
                                  <MaterialCommunityIcons name="thumb-down" size={16} color="#9E9E9E" style={styles.feedbackIcon} />
                                )}
                                {item.feedback?.rating && item.feedback.rating > 0 && (
                                  <View style={styles.ratingContainer}>
                                    <MaterialCommunityIcons name="star" size={16} color="#FFC107" />
                                    <Text style={styles.ratingText}>{item.feedback.rating}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                } catch (error) {
                  debugLog("Caught error during ScrollView rendering:", error);
                  setStorageAvailable(false);
                  
                  return (
                    <View style={styles.errorContainer}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#dc3545" />
                      <Text style={styles.errorText}>Sorry, we encountered an error while loading your recipes.</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                          debugLog("Manual retry triggered");
                          setLoading(true);
                          setTimeout(() => loadHistoryData(true), 500);
                        }}
                      >
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
              })()}
            </ScrollView>
          )}
        </>
      )}

      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </SafeAreaView>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingHorizontal: 4,
  },
  activeTab: {
    borderBottomColor: '#333',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#333',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  sectionHeader: {
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  recipeItem: {
    marginBottom: 16,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  recipeImage: {
    width: 100,
    height: 100,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recipeMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recipeInfo: {
    fontSize: 12,
    color: '#666',
  },
  tagContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  mealTypeTag: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mealTypeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  feedbackIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackIcon: {
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 2,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
    padding: 8,
    paddingHorizontal: 12,
  },
  warningText: {
    color: '#856404',
    marginLeft: 8,
    fontSize: 14,
  },
  emptyWarningSubtext: {
    fontSize: 12,
    color: '#856404',
    backgroundColor: '#fff3cd',
    textAlign: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#dc3545',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
});

export default RecipeHistoryScreen; 