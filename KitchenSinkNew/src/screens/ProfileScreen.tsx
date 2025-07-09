import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Switch,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { useMealPlan } from '../contexts/MealPlanContext';
import { getPreferenceValue, savePreferenceValue } from '../utils/preferences';
import { firestoreService } from '../services/firebaseService';
import { groceryListService } from '../services/groceryListService';
import { RecipeDocument, GroceryListDocument } from '../types/FirestoreSchema';
import AuthModal from '../components/AuthModal';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { testFeedbackPermissions } from '../utils/firestoreDebug';
import { recipeFeedbackService } from '../services/recipeFeedbackService';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

interface SectionProps {
  title: string;
  onToggle: () => void;
  isExpanded: boolean;
  children: React.ReactNode;
}

const ExpandableSection: React.FC<SectionProps> = ({ 
  title, 
  onToggle, 
  isExpanded, 
  children 
}) => {
  return (
    <View style={styles.expandableSection}>
      <TouchableOpacity 
        style={styles.expandableHeader} 
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.expandableTitle}>{title}</Text>
        <MaterialCommunityIcons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={24} 
          color="#7A736A"
        />
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.expandableContent}>
          {children}
        </View>
      )}
    </View>
  );
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const { mealPlan } = useMealPlan();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const isFocused = useIsFocused();
  
  // Add new state for tracking cooked recipes
  const [allRecipesCooked, setAllRecipesCooked] = useState(false);
  const [showNewMealPlanPrompt, setShowNewMealPlanPrompt] = useState(false);
  
  // Content sections
  const [savedRecipes, setSavedRecipes] = useState<RecipeDocument[]>([]);
  const [groceryLists, setGroceryLists] = useState<GroceryListDocument[]>([]);
  
  // Track if we've already loaded data on the first focus
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Expanded section states
  const [expandedSections, setExpandedSections] = useState({
    currentRecipes: true,
    groceryList: true,
    history: false,
    preferences: false,
    pantry: true
  });
  
  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Add function to check if all recipes are cooked
  const checkAllRecipesCooked = async (recipes: RecipeDocument[]) => {
    if (!recipes.length) return false;
    
    try {
      const feedbackHistory = await recipeFeedbackService.getUserFeedbackHistory(100);
      const recipeIds = new Set(recipes.map(r => r.id));
      const cookedRecipeIds = new Set(
        feedbackHistory
          .filter(f => f.isCooked)
          .map(f => f.recipeId)
      );
      
      // Check if all recipe IDs are in the cooked set
      return Array.from(recipeIds).every(id => cookedRecipeIds.has(id));
    } catch (error) {
      console.error('Error checking cooked recipes:', error);
      return false;
    }
  };

  // Load user data
  const loadUserData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load saved recipes
      const recipes = await firestoreService.getAllRecipes({ isWeeklyMealPlan: true });
      setSavedRecipes(recipes);
      
      // Load most recent grocery list
      const recentList = await groceryListService.getMostRecentGroceryList();
      setGroceryLists(recentList ? [recentList] : []);
      
      // Check if all recipes are cooked
      const allCooked = await checkAllRecipesCooked(recipes);
      setAllRecipesCooked(allCooked);
      
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load your data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);
  
  // Load data when screen is first mounted
  useEffect(() => {
    if (user && !initialDataLoaded) {
      loadUserData();
    }
  }, [user, initialDataLoaded]);

  // Add useFocusEffect to reload data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user && isFocused) {
        // When focusing the screen, always force a refresh
        loadUserData();
      }
    }, [user, isFocused])
  );
  
  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await user?.delete();
              navigation.navigate('Home');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ]
    );
  };
  
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    loadUserData();
  };

  const handleTestFirestore = async () => {
    try {
      Alert.alert('Testing Firestore', 'Starting permissions test...');
      await firestoreService.testFirestorePermissions();
      Alert.alert('Success', 'Firestore permissions test passed!');
    } catch (error) {
      Alert.alert('Error', `Firestore permissions test failed: ${error}`);
    }
  };

  // Add a new function to test feedback permissions
  const handleTestFeedbackPermissions = async () => {
    try {
      Alert.alert('Testing Permissions', 'Testing recipe feedback permissions...');
      const result = await testFeedbackPermissions();
      
      Alert.alert(
        result.success ? 'Success' : 'Permission Error',
        result.message
      );
    } catch (error) {
      Alert.alert('Error', `Permission test failed: ${error}`);
    }
  };

  // Direct test for reading the Firestore "recipes" collection
  const handleTestRecipesAccess = async () => {
    try {
      Alert.alert('Testing "recipes" Access', 'Fetching 5 docs from collection "recipes"...');

      const snapshot = await firestore().collection('recipes').limit(5).get();

      if (snapshot.empty) {
        Alert.alert('Recipes Access', 'Collection "recipes" returned 0 documents');
      } else {
        const sampleNames = snapshot.docs.map(d => d.get('name') || d.id).join(', ');
        Alert.alert('Recipes Access', `Fetched ${snapshot.size} docs. Sample: ${sampleNames}`);
      }
    } catch (err: any) {
      Alert.alert('Recipes Access Error', err?.message ?? err.toString());
    }
  };

  // Clean weekly meal plan data - dev only
  const handleCleanMealPlanData = async () => {
    try {
      Alert.alert(
        'Clean Data',
        'This will reset all weekly meal plan flags. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Reset', 
            style: 'destructive',
            onPress: async () => {
              // Show loading
              setLoading(true);
              
              // Reset all flags
              await firestoreService.resetAllWeeklyMealPlanFlags();
              
              // Reload data
              await loadUserData();
              
              Alert.alert('Success', 'Weekly meal plan data has been reset.');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Clean data failed: ${error}`);
      setLoading(false);
    }
  };

  // Add function to handle generating new meal plan
  const handleGenerateNewMealPlan = () => {
    setShowNewMealPlanPrompt(false);
    navigation.navigate('LoadingMealPlan');
  };

  // Add function to handle skipping new meal plan
  const handleSkipNewMealPlan = () => {
    setShowNewMealPlanPrompt(false);
  };

  const renderRecipeItem = (recipe: RecipeDocument) => (
    <TouchableOpacity 
      key={recipe.id}
      style={styles.listItem}
      onPress={() => {
        // Navigate to recipe detail screen with this recipe
        navigation.navigate('RecipeDetail', {
          recipe: recipe
        });
      }}
    >
      <View style={styles.listItemContent}>
        <View style={styles.itemImageContainer}>
          {recipe.imageUrl ? (
            <Image 
              source={{ uri: recipe.imageUrl }} 
              style={styles.itemImage} 
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
              <MaterialCommunityIcons name="food" size={24} color="#B57A42" />
            </View>
          )}
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={1}>{recipe.name}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {recipe.readyInMinutes} min • {recipe.servings} servings
          </Text>
          {recipe.tags && recipe.tags.length > 0 && (
            <View style={styles.tagContainer}>
              {recipe.tags.some(tag => ['breakfast', 'lunch', 'dinner', 'snacks'].includes(tag)) && (
                <View style={styles.mealTypeTag}>
                  <Text style={styles.mealTypeText}>
                    {recipe.tags.includes('breakfast') ? 'Breakfast' : 
                     recipe.tags.includes('lunch') ? 'Lunch' : 
                     recipe.tags.includes('dinner') ? 'Dinner' : 'Snack'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#B57A42" />
      </View>
    </TouchableOpacity>
  );

  const renderGroceryListItem = (list: GroceryListDocument) => (
    <TouchableOpacity 
      key={list.id}
      style={styles.listItem}
      onPress={() => {
        navigation.navigate('GroceryList', { 
          selectedRecipes: savedRecipes,
          existingListId: list.id
        });
      }}
    >
      <View style={styles.listItemContent}>
        <View style={[styles.categoryIcon, { backgroundColor: '#D9A15B' }]}>
          <MaterialCommunityIcons name="cart" size={18} color="white" />
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={1}>{list.name}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {list.items.length} items • {formatDate(list.createdAt)}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#B57A42" />
      </View>
    </TouchableOpacity>
  );

  // Helper function to format date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerWrapper}>
        <ImageBackground
          source={require('../../assets/kitchen-background.png')}
          style={styles.headerBackground}
          imageStyle={styles.headerBackgroundImage}
          blurRadius={2}
        >
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {user?.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}!` : 'Profile'}
              </Text>
            </View>
            <View style={styles.profileSection}>
              {user ? (
                <>
                  <View style={styles.avatarContainer}>
                    <View style={styles.avatarFrame}>
                      {user?.photoURL ? (
                        <Image
                          source={{ uri: user.photoURL }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <MaterialCommunityIcons name="account" size={40} color="#666" />
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.email}>{user?.email}</Text>
                    {user?.displayName && (
                      <Text style={styles.name}>{user.displayName}</Text>
                    )}
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </ImageBackground>
      </View>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Weekly Meal Plan */}
        <ExpandableSection 
          title="Weekly Meal Plan" 
          onToggle={() => toggleSection('currentRecipes')} 
          isExpanded={expandedSections.currentRecipes}
        >
          {user ? (
            <>
              <Text style={styles.sectionDescription}>
                Recipes you've selected for your weekly meal plan will appear here.
              </Text>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#D9A15B" />
                  <Text style={styles.loadingText}>Loading your data...</Text>
                </View>
              ) : (
                savedRecipes.length > 0 ? (
                  <>
                    {savedRecipes.map(recipe => renderRecipeItem(recipe))}
                    {allRecipesCooked && (
                      <TouchableOpacity
                        style={styles.generateNewPlanButton}
                        onPress={() => navigation.navigate('LoadingMealPlan')}
                      >
                        <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
                        <Text style={styles.generateNewPlanButtonText}>Generate New Meal Plan</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialCommunityIcons 
                      name="food-variant" 
                      size={64}
                      color="#B57A42"
                    />
                    <Text style={styles.emptyStateText}>No weekly meal plan yet</Text>
                    <TouchableOpacity
                      style={styles.emptyStateButton}
                      onPress={() => navigation.navigate('LoadingMealPlan')}
                    >
                      <Text style={styles.emptyStateButtonText}>Generate Meal Plan</Text>
                    </TouchableOpacity>
                  </View>
                )
              )}
              {savedRecipes.length > 0 && !allRecipesCooked && (
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => Alert.alert('Coming Soon', 'Full recipe list coming soon!')}
                >
                  <Text style={styles.viewAllText}>View All Recipes</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#4E4E4E" />
                </TouchableOpacity>
              )}
            </>
          ) : null}
        </ExpandableSection>

        {user && (
          <>
            <ExpandableSection
              title="My Pantry"
              isExpanded={expandedSections.pantry ?? true}
              onToggle={() => setExpandedSections(prev => ({ ...prev, pantry: !prev.pantry }))}
            >
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => navigation.navigate('Pantry')}
              >
                <MaterialCommunityIcons name="fridge-outline" size={24} color="#7A736A" />
                <Text style={styles.settingsMenuItemText}>View Pantry</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#B57A42" />
              </TouchableOpacity>
            </ExpandableSection>

            <ExpandableSection
              title="My Grocery Lists"
              isExpanded={expandedSections.groceryList}
              onToggle={() => toggleSection('groceryList')}
            >
              {groceryLists.length > 0 ? (
                <>
                  {groceryLists.map(list => renderGroceryListItem(list))}
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => navigation.navigate('GroceryListHistory')}
                  >
                    <Text style={styles.viewAllText}>View All Lists</Text>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#4E4E4E" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons 
                    name="cart-outline" 
                    size={48} 
                    color="#B57A42" 
                  />
                  <Text style={styles.emptyStateText}>No grocery lists yet</Text>
                  <TouchableOpacity 
                    style={styles.emptyStateButton}
                    onPress={() => navigation.navigate('LoadingMealPlan')}
                  >
                    <Text style={styles.emptyStateButtonText}>Create Grocery List</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ExpandableSection>

            <ExpandableSection
              title="History"
              isExpanded={expandedSections.history}
              onToggle={() => toggleSection('history')}
            >
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => navigation.navigate('RecipeHistory')}
              >
                <MaterialCommunityIcons name="history" size={24} color="#7A736A" />
                <Text style={styles.settingsMenuItemText}>Recipe History</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#B57A42" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => navigation.navigate('GroceryListHistory')}
              >
                <MaterialCommunityIcons name="cart-outline" size={24} color="#7A736A" />
                <Text style={styles.settingsMenuItemText}>Grocery List History</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#B57A42" />
              </TouchableOpacity>
            </ExpandableSection>
          </>
        )}

        <ExpandableSection
          title="Preferences"
          isExpanded={expandedSections.preferences}
          onToggle={() => toggleSection('preferences')}
        >
          <TouchableOpacity
            style={styles.settingsMenuItem}
            onPress={() => navigation.navigate('DietaryPreferences', { fromProfile: true })}
          >
            <MaterialCommunityIcons name="food-apple-outline" size={24} color="#7A736A" />
            <Text style={styles.settingsMenuItemText}>Dietary Preferences</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#B57A42" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingsMenuItem}
            onPress={() => navigation.navigate('FoodPreferences', { fromProfile: true })}
          >
            <MaterialCommunityIcons name="silverware-fork-knife" size={24} color="#7A736A" />
            <Text style={styles.settingsMenuItemText}>Food Preferences</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#B57A42" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingsMenuItem}
            onPress={() => navigation.navigate('CookingHabits', { fromProfile: true })}
          >
            <MaterialCommunityIcons name="chef-hat" size={24} color="#7A736A" />
            <Text style={styles.settingsMenuItemText}>Cooking Habits</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#B57A42" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingsMenuItem}
            onPress={() => navigation.navigate('BudgetPreferences', { fromProfile: true })}
          >
            <MaterialCommunityIcons name="currency-usd" size={24} color="#7A736A" />
            <Text style={styles.settingsMenuItemText}>Budget Settings</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#B57A42" />
          </TouchableOpacity>
        </ExpandableSection>

        {user && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <MaterialCommunityIcons name="logout" size={24} color="#7A736A" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccount}
            >
              <MaterialCommunityIcons name="delete" size={24} color="#B57A42" />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugSectionTitle}>Developer Tools</Text>
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={handleTestFirestore}
            >
              <Text style={styles.debugButtonText}>Test Firestore Permissions</Text>
            </TouchableOpacity>

            {/* Add new button for testing feedback permissions */}
            <TouchableOpacity 
              style={[styles.debugButton, { backgroundColor: '#D9A15B', marginTop: 8 }]} 
              onPress={handleTestFeedbackPermissions}
            >
              <Text style={styles.debugButtonText}>Test Feedback Permissions</Text>
            </TouchableOpacity>

            {/* Clean weekly meal plan data - dev only */}
            <TouchableOpacity 
              style={[styles.debugButton, { backgroundColor: '#B57A42', marginTop: 8 }]} 
              onPress={handleCleanMealPlanData}
            >
              <Text style={styles.debugButtonText}>Reset Weekly Meal Plan Data</Text>
            </TouchableOpacity>

            {/* New button: direct test of recipes collection */}
            <TouchableOpacity 
              style={[styles.debugButton, { backgroundColor: '#5C8A4F', marginTop: 8 }]} 
              onPress={handleTestRecipesAccess}
            >
              <Text style={styles.debugButtonText}>Test "recipes" Collection</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      
      <AuthModal 
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Add New Meal Plan Prompt Modal */}
      {showNewMealPlanPrompt && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="food-variant" size={48} color="#D9A15B" />
            <Text style={styles.modalTitle}>Time for a New Meal Plan!</Text>
            <Text style={styles.modalText}>
              You've cooked all the recipes in your current meal plan. Would you like to generate a new one?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={handleGenerateNewMealPlan}
              >
                <Text style={styles.primaryButtonText}>Generate New Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={handleSkipNewMealPlan}
              >
                <Text style={styles.secondaryButtonText}>Skip for Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F1',
  },
  headerWrapper: {
    width: '100%',
    height: 248,
    overflow: 'hidden',
    marginBottom: -12,
  },
  headerBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  headerBackgroundImage: {
    resizeMode: 'cover',
    opacity: 0.7,
  },
  headerOverlay: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(250, 246, 241, 0.7)', // subtle overlay for contrast
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4E4E4E',
    textAlign: 'left',
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    padding: 0,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  avatarFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFE7DD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarPlaceholder: {
    backgroundColor: '#E6DED3',
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  profileInfo: {
    alignItems: 'center',
  },
  email: {
    fontSize: 16,
    color: '#7A736A',
    marginBottom: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4E4E4E',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7A736A',
  },
  expandableSection: {
    backgroundColor: '#F5EFE6',
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E6DED3',
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F5EFE6',
  },
  expandableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4E4E4E',
  },
  expandableContent: {
    borderTopWidth: 1,
    borderTopColor: '#E6DED3',
  },
  section: {
    backgroundColor: '#F5EFE6',
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E6DED3',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7A736A',
    marginLeft: 16,
    marginVertical: 8,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  settingsMenuItemText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#4E4E4E',
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  itemImageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    backgroundColor: '#E6DED3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D9A15B',
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
    color: '#4E4E4E',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#7A736A',
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7A736A',
    marginVertical: 12,
  },
  emptyStateButton: {
    backgroundColor: '#D9A15B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E6DED3',
  },
  viewAllText: {
    color: '#4E4E4E',
    fontWeight: '600',
    marginRight: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  signOutText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#7A736A',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deleteAccountText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#B57A42',
  },
  debugButton: {
    marginTop: 20,
    backgroundColor: '#D9A15B',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealTypeTag: {
    backgroundColor: '#D9A15B',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  mealTypeText: {
    color: 'white',
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#7A736A',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  debugSection: {
    padding: 20,
    backgroundColor: '#F5EFE6',
    borderTopWidth: 1,
    borderTopColor: '#E6DED3',
  },
  debugSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E4E4E',
    marginBottom: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#F5EFE6',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4E4E4E',
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: '#7A736A',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  primaryButton: {
    backgroundColor: '#D9A15B',
  },
  secondaryButton: {
    backgroundColor: '#E6DED3',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: '#4E4E4E',
    fontWeight: '600',
    textAlign: 'center',
  },
  generateNewPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9A15B',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginHorizontal: 16,
  },
  generateNewPlanButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  headerContent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
});

export default ProfileScreen; 