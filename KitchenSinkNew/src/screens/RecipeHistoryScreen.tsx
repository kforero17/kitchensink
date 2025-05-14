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
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

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

  // Add helper function to format date
  const formatDate = (date: Date | FirebaseFirestoreTypes.Timestamp): string => {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : date.toDate();
    return dateObj.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
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
          <MaterialCommunityIcons name="arrow-left" size={24} color="#4E4E4E" />
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
          <MaterialCommunityIcons name="account-lock" size={64} color="#C4B5A4" />
          <Text style={styles.authTitle}>Sign in to see your recipe history</Text>
          <Text style={styles.authSubtitle}>
            Your recipe history and preferences will be saved when you sign in
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => setShowAuthModal(true)}
          >
            <LinearGradient
              colors={['#D9A15B', '#B57A42']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 12, paddingHorizontal: 24 }}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </LinearGradient>
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
              <ActivityIndicator size="large" color="#D9A15B" />
              <Text style={styles.loadingText}>Loading your recipe history...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={handleRefresh}
                  tintColor="#D9A15B" // For iOS
                  colors={['#D9A15B']} // For Android
                />
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
                          <View style={[styles.recipeCard, (item as any)._isPlaceholder && styles.placeholderCard]}>
                            <View style={styles.recipeImageContainer}>
                              {item.imageUrl ? (
                                <Image source={{ uri: item.imageUrl }} style={styles.recipeImage} resizeMode="cover" />
                              ) : (
                                <View style={[styles.recipeImage, styles.placeholderImage]}>
                                  <MaterialCommunityIcons 
                                    name="food" 
                                    size={30} 
                                    color={(item as any)._isPlaceholder ? "#856404" : "#C4B5A4"} />
                                </View>
                              )}
                              {/* Display rating badge if applicable */}
                              {item.feedback?.rating && item.feedback.rating > 0 && (
                                <View style={styles.ratingBadge}>
                                  <MaterialCommunityIcons name="star" size={14} color="#FFFFFF" />
                                  <Text style={styles.ratingBadgeText}>
                                    {item.feedback.rating}/5
                                  </Text>
                                </View>
                              )}
                              {/* Display cooked badge if applicable */}
                              {item.feedback?.isCooked && (
                                <View style={[styles.ratingBadge, styles.cookedBadge, (!item.feedback?.rating || item.feedback.rating === 0) && styles.cookedBadgeOnly ]}>
                                  <MaterialCommunityIcons name="silverware-fork-knife" size={14} color="#FFFFFF" />
                                  <Text style={styles.cookedBadgeText}>Cooked</Text>
                                </View>
                              )}
                            </View>
                            
                            <View style={styles.recipeInfo}>
                                <Text 
                                  style={[styles.recipeTitle, (item as any)._isPlaceholder && styles.placeholderText]} 
                                  numberOfLines={2}
                                >
                                  {item.name || "Untitled Recipe"}
                                </Text>
                              
                              <View style={styles.recipeMetadata}>
                                <Text style={styles.recipeSubText}>
                                  {item.readyInMinutes || '?'} min • {item.servings || '?'} {item.servings === 1 ? 'serving' : 'servings'}
                                </Text>
                              </View>

                              {item.tags && item.tags.length > 0 && item.tags.some(tag => ['breakfast', 'lunch', 'dinner', 'snacks'].includes(tag)) && (
                                <View style={styles.mealTypeContainer}>
                                    <View style={styles.mealTypeTag}>
                                      <Text style={styles.mealTypeText}>
                                        {item.tags.includes('breakfast') ? 'Breakfast' : 
                                        item.tags.includes('lunch') ? 'Lunch' : 
                                        item.tags.includes('dinner') ? 'Dinner' : 'Snack'}
                                      </Text>
                                    </View>
                                    {item.feedback?.isLiked === true && (
                                      <View style={[styles.mealTypeTag, styles.likedTag]}>
                                        <MaterialCommunityIcons name="heart" size={12} color="#FFFFFF" />
                                        <Text style={styles.likedTagText}>Liked</Text>
                                      </View>
                                    )}
                                </View>
                              )}
                              
                              {item.feedback?.feedbackDate && (
                                <Text 
                                  style={[styles.feedbackDate, (item as any)._isPlaceholder && styles.placeholderText]}
                                >
                                  {(item as any)._isPlaceholder ? "Feedback pending" : `Feedback from ${formatDate(item.feedback.feedbackDate)}`}
                                </Text>
                              )}
                               {(item as any)._isPlaceholder && (
                                <Text style={styles.placeholderInfo}>
                                  Recipe details may be incomplete.
                                </Text>
                              )}
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
                      <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#D9A15B" />
                      <Text style={styles.errorText}>Sorry, we encountered an error while loading your recipes.</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                          debugLog("Manual retry triggered");
                          setLoading(true);
                          setTimeout(() => loadHistoryData(true), 500);
                        }}
                      >
                        <LinearGradient
                          colors={['#D9A15B', '#B57A42']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ paddingVertical: 12, paddingHorizontal: 24 }}
                        >
                          <Text style={styles.retryButtonText}>Retry</Text>
                        </LinearGradient>
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
    backgroundColor: '#FAF7F2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)', // Use a slightly transparent white for depth
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    // Add platform-specific shadows for a subtle lift
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTitle: {
    fontSize: 24, // Increased font size for better hierarchy
    fontWeight: '700', // Bolder for emphasis
    color: '#4E4E4E', // Darker text color for readability
    flex: 1, // Ensure it takes available space if other elements are added
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', // Match header background
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3', // Consistent border color
    paddingHorizontal: 8, // Add some horizontal padding for tabs
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2, // Thicker active border
    borderBottomColor: 'transparent', // Default to transparent
    paddingHorizontal: 4, // Reduce padding if text is longer
  },
  activeTab: {
    borderBottomColor: '#D9A15B', // Accent color for active tab
  },
  tabText: {
    fontSize: 14, // Slightly larger tab text
    fontWeight: '500',
    color: '#7A736A', // Softer color for inactive tabs
  },
  activeTabText: {
    color: '#D9A15B', // Accent color for active tab text
    fontWeight: '600', // Bolder for active tab
  },
  listContent: {
    padding: 16,
    paddingBottom: 32, // More space at the bottom
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
    color: '#7A736A', // Consistent softer text color
    textAlign: 'center',
  },
  sectionHeader: { // Kept for potential future use, styled consistently
    paddingVertical: 12,
    backgroundColor: '#FAF7F2', // Match main background
  },
  sectionHeaderText: {
    fontSize: 18, // Larger section header text
    fontWeight: '600',
    color: '#4E4E4E', // Consistent header text color
  },
  recipeItem: {
    marginBottom: 16,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', // White card background
    borderRadius: 12, // Rounded corners
    overflow: 'hidden', // Ensure content respects border radius
    borderWidth: 1, // Subtle border
    borderColor: 'rgba(0,0,0,0.05)', // Very light border color
    ...Platform.select({ // Consistent shadow styling
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, // Softer shadow
        shadowRadius: 8, // Wider shadow
      },
      android: {
        elevation: 3, // Standard elevation for Android
      },
    }),
  },
  recipeImageContainer: { // Container for image and badges
    width: 100,
    height: 100, // Square image
    position: 'relative', // For absolute positioning of badges
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2', // Lighter placeholder background
  },
  recipeInfo: { // Text content part of the card
    flex: 1,
    padding: 12,
    justifyContent: 'space-between', // Distribute content vertically
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E4E4E',
    marginBottom: 4, // Space below title
  },
  recipeMetadata: { // Container for time/servings
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recipeSubText: { // For time, servings
    fontSize: 12,
    color: '#7A736A',
  },
  mealTypeContainer: { // For meal type and liked tags
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4, // Space above tags
    flexWrap: 'wrap',
  },
  mealTypeTag: {
    backgroundColor: '#C4B5A4', // Muted accent color
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12, // Pill shape
    marginRight: 4,
    marginBottom: 4,
  },
  mealTypeText: {
    color: '#FFFFFF', // White text on colored tag
    fontSize: 10, // Smaller tag text
    fontWeight: '600',
  },
  likedTag: {
    backgroundColor: '#E57373', // Distinct color for liked
    marginLeft: 4,
  },
  likedTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  feedbackDate: {
    fontSize: 12,
    color: '#7A736A',
    marginTop: 'auto', // Push to bottom if space allows
  },
  emptyContainer: {
    paddingVertical: 48, // More vertical padding
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 20, // Larger empty state text
    fontWeight: '600',
    color: '#4E4E4E', // Consistent text color
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7A736A', // Softer subtext color
    textAlign: 'center',
    marginBottom: 16,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    fontSize: 24, // Larger auth title
    fontWeight: '600',
    color: '#4E4E4E',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16, // Slightly larger auth subtitle
    color: '#7A736A',
    marginBottom: 24,
    textAlign: 'center',
  },
  signInButton: { // Style for the TouchableOpacity wrapper of LinearGradient
    borderRadius: 12, // Rounded corners for the button
    overflow: 'hidden', // Ensure gradient respects border radius
  },
  signInButtonText: { // Text inside the gradient button
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center', // Ensure text is centered
  },
  warningBanner: { // Consistent warning banner style
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD', // Standard warning yellow
    borderColor: '#FFEEBA', // Lighter border for warning
    borderWidth: 1,
    padding: 12, // Increased padding
    paddingHorizontal: 16,
  },
  warningText: {
    color: '#856404', // Dark yellow text for warning
    marginLeft: 8,
    fontSize: 14,
  },
  emptyWarningSubtext: { // For warnings within empty state
    fontSize: 14, // Match other subtext
    color: '#856404',
    backgroundColor: '#FFF3CD',
    textAlign: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 8, // Rounded corners
  },
  errorContainer: { // Consistent error state styling
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#4E4E4E', // Use standard text color for error message
    fontSize: 16, // Standard message font size
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: { // Style for TouchableOpacity wrapper of LinearGradient
    borderRadius: 12,
    overflow: 'hidden',
  },
  retryButtonText: { // Text inside gradient button
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  ratingBadge: { // Badge for rating on image
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#D9A15B', // Accent color for rating
    borderRadius: 12, // Pill shape
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10, // Smaller badge text
    fontWeight: '600',
    marginLeft: 4, // Space icon from text
  },
  cookedBadge: { // Badge for cooked status on image
    backgroundColor: '#4E4E4E', // Darker, neutral color for cooked
    left: 'auto', // Reset left if rating badge is present
    right: 8, // Position to the right
    // If rating is also present, this will be to the right of it.
    // If only cooked is present, it will be top-right.
  },
  cookedBadgeOnly: { // If only cooked badge is shown, position it on the left
    left: 8,
    right: 'auto',
  },
  cookedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  placeholderCard: { // Specific styling for placeholder recipe cards
    backgroundColor: '#FFF9F2', // Very light cream for placeholder background
    borderColor: '#E6DED3', // Softer border for placeholder
  },
  placeholderText: { // Text color for placeholder content
    color: '#A09483', // Muted text color for placeholders
  },
  placeholderInfo: { // Additional info text for placeholders
    fontSize: 10,
    color: '#A09483',
    textAlign: 'center',
    marginTop: 4,
  },
  // Debug button styles from your example, adapted to the theme
  debugButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugButton: {
    width: 36, // Slightly smaller debug buttons
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(250, 247, 242, 0.9)', // Background to match app theme, slightly transparent
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8, // Spacing between debug buttons
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  // Removed feedbackIndicators, ratingContainer, ratingText, feedbackIcon from old styles
  // as their display is now handled by badges on the image and updated mealTypeContainer.
  // Styles for pantryItem, groceryItem are kept in case they are used elsewhere or planned for future.
  pantryItem: {
    marginBottom: 16,
  },
  pantryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  pantryDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  pantryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E4E4E',
    marginBottom: 4,
  },
  pantryInfo: {
    fontSize: 14,
    color: '#7A736A',
  },
  groceryItem: {
    marginBottom: 16,
  },
  groceryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  groceryDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  groceryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E4E4E',
    marginBottom: 4,
  },
  groceryInfo: {
    fontSize: 14,
    color: '#7A736A',
  },
});

export default RecipeHistoryScreen; 