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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { getPreferenceValue, savePreferenceValue } from '../utils/preferences';
import { firestoreService } from '../services/firebaseService';
import { RecipeDocument, GroceryListDocument, PantryItemDocument, ItemStatus } from '../types/FirestoreSchema';
import { useMealPlan } from '../contexts/MealPlanContext';
import { pantryService } from '../services/pantryService';
import { groceryListService } from '../services/groceryListService';
import { theme } from '../styles/theme';
import AuthModal from '../components/AuthModal';

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
          color="#666"
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
  const [usePantryItems, setUsePantryItems] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Content sections
  const [savedRecipes, setSavedRecipes] = useState<RecipeDocument[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItemDocument[]>([]);
  const [groceryLists, setGroceryLists] = useState<GroceryListDocument[]>([]);
  
  // Expanded section states
  const [expandedSections, setExpandedSections] = useState({
    currentRecipes: true,
    pantry: true,
    groceryList: true,
    history: false,
    preferences: false
  });
  
  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const loadPreferences = async () => {
    const pantryPref = await getPreferenceValue<boolean>('usePantryItems', true);
    setUsePantryItems(pantryPref);
  };
  
  const loadUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Load recipes, pantry items and grocery lists in parallel
      const [recipesResult, pantryResult, groceryResult] = await Promise.all([
        firestoreService.getAllRecipes({ limit: 5, isFavorite: true }),
        pantryService.getAllPantryItems(),
        groceryListService.getAllGroceryLists()
      ]);
      
      setSavedRecipes(recipesResult);
      setPantryItems(pantryResult);
      setGroceryLists(groceryResult);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    loadPreferences();
  }, []);

  // Add useFocusEffect to reload data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadUserData();
      }
    }, [user])
  );
  
  // Pull to refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  // Toggle pantry items preference
  const handleTogglePantryItems = async (value: boolean) => {
    try {
      setUsePantryItems(value);
      await savePreferenceValue('usePantryItems', value);
    } catch (error) {
      console.error('Error saving pantry preference:', error);
      // Revert to previous state if save fails
      setUsePantryItems(!value);
    }
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

  const renderRecipeItem = (recipe: RecipeDocument) => (
    <TouchableOpacity 
      key={recipe.id}
      style={styles.listItem}
      onPress={() => Alert.alert('Coming Soon', 'Recipe details view coming soon!')}
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
              <MaterialCommunityIcons name="food" size={24} color="#999" />
            </View>
          )}
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={1}>{recipe.name}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {recipe.readyInMinutes} min • {recipe.servings} servings
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  const renderPantryItem = (item: PantryItemDocument) => (
    <TouchableOpacity 
      key={item.id}
      style={styles.listItem}
      onPress={() => navigation.navigate('Pantry')}
    >
      <View style={styles.listItemContent}>
        <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(item.category) }]}>
          <MaterialCommunityIcons 
            name={getCategoryIcon(item.category)} 
            size={18} 
            color="white" 
          />
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {item.quantity} {item.unit}
            {item.expirationDate ? ` • Expires: ${formatDate(item.expirationDate)}` : ''}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  const renderGroceryListItem = (list: GroceryListDocument) => (
    <TouchableOpacity 
      key={list.id}
      style={styles.listItem}
      onPress={() => Alert.alert('Coming Soon', 'Grocery list details view coming soon!')}
    >
      <View style={styles.listItemContent}>
        <View style={[styles.categoryIcon, { backgroundColor: '#5856D6' }]}>
          <MaterialCommunityIcons name="cart" size={18} color="white" />
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={1}>{list.name}</Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {list.items.length} items • {formatDate(list.createdAt)}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  // Helper function to get category icon
  const getCategoryIcon = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'Fruits': 'fruit-watermelon',
      'Vegetables': 'food-apple',
      'Meat': 'food-steak',
      'Dairy': 'cheese',
      'Grains': 'grain',
      'Baking': 'cookie',
      'Canned': 'food-variant',
      'Frozen': 'snowflake',
      'Snacks': 'food-croissant',
      'Beverages': 'cup',
      'Condiments': 'bottle-tonic',
      'Spices': 'shaker',
    };
    
    return categoryMap[category] || 'food';
  };

  // Helper function to get category color
  const getCategoryColor = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'Fruits': '#4CAF50',
      'Vegetables': '#8BC34A',
      'Meat': '#F44336',
      'Dairy': '#03A9F4',
      'Grains': '#FF9800',
      'Baking': '#795548',
      'Canned': '#607D8B',
      'Frozen': '#00BCD4',
      'Snacks': '#FF5722',
      'Beverages': '#9C27B0',
      'Condiments': '#FFEB3B',
      'Spices': '#FFC107',
    };
    
    return categoryMap[category] || '#9E9E9E';
  };

  // Helper function to format date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.profileSection}>
          {user ? (
            <>
              <View style={styles.avatarContainer}>
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
              <Text style={styles.email}>{user?.email}</Text>
              {user?.displayName && (
                <Text style={styles.name}>{user.displayName}</Text>
              )}
            </>
          ) : (
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Sign in to save your preferences</Text>
              <TouchableOpacity 
                style={styles.signInButton}
                onPress={() => setShowAuthModal(true)}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading your data...</Text>
          </View>
        ) : (
          <>
            {user && (
              <>
                <ExpandableSection
                  title="Current Recipes"
                  isExpanded={expandedSections.currentRecipes}
                  onToggle={() => toggleSection('currentRecipes')}
                >
                  {savedRecipes.length > 0 ? (
                    savedRecipes.map(recipe => renderRecipeItem(recipe))
                  ) : (
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons 
                        name="food-variant" 
                        size={48} 
                        color="#ccc" 
                      />
                      <Text style={styles.emptyStateText}>No saved recipes yet</Text>
                      <TouchableOpacity 
                        style={styles.emptyStateButton}
                        onPress={() => navigation.navigate('LoadingMealPlan')}
                      >
                        <Text style={styles.emptyStateButtonText}>Generate Meal Plan</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {savedRecipes.length > 0 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => Alert.alert('Coming Soon', 'Full recipe list coming soon!')}
                    >
                      <Text style={styles.viewAllText}>View All Recipes</Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </ExpandableSection>

                <ExpandableSection
                  title="My Pantry"
                  isExpanded={expandedSections.pantry}
                  onToggle={() => toggleSection('pantry')}
                >
                  {pantryItems.length > 0 ? (
                    pantryItems.slice(0, 5).map(item => renderPantryItem(item))
                  ) : (
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons 
                        name="fridge-outline" 
                        size={48} 
                        color="#ccc" 
                      />
                      <Text style={styles.emptyStateText}>Your pantry is empty</Text>
                      <TouchableOpacity 
                        style={styles.emptyStateButton}
                        onPress={() => navigation.navigate('Pantry')}
                      >
                        <Text style={styles.emptyStateButtonText}>Add Items to Pantry</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {pantryItems.length > 0 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => navigation.navigate('Pantry')}
                    >
                      <Text style={styles.viewAllText}>Manage Pantry</Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </ExpandableSection>

                <ExpandableSection
                  title="My Grocery Lists"
                  isExpanded={expandedSections.groceryList}
                  onToggle={() => toggleSection('groceryList')}
                >
                  {groceryLists.length > 0 ? (
                    groceryLists.slice(0, 3).map(list => renderGroceryListItem(list))
                  ) : (
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons 
                        name="cart-outline" 
                        size={48} 
                        color="#ccc" 
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
                  {groceryLists.length > 0 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => Alert.alert('Coming Soon', 'Grocery list history coming soon!')}
                    >
                      <Text style={styles.viewAllText}>View All Lists</Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </ExpandableSection>

                <ExpandableSection
                  title="History"
                  isExpanded={expandedSections.history}
                  onToggle={() => toggleSection('history')}
                >
                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => Alert.alert('Coming Soon', 'Recipe history coming soon!')}
                  >
                    <MaterialCommunityIcons name="history" size={24} color="#666" />
                    <Text style={styles.settingsMenuItemText}>Recipe History</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.settingsMenuItem}
                    onPress={() => Alert.alert('Coming Soon', 'Grocery list history coming soon!')}
                  >
                    <MaterialCommunityIcons name="clipboard-list" size={24} color="#666" />
                    <Text style={styles.settingsMenuItemText}>Grocery List History</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
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
                onPress={() => navigation.navigate('DietaryPreferences')}
              >
                <MaterialCommunityIcons name="food-apple-outline" size={24} color="#666" />
                <Text style={styles.settingsMenuItemText}>Dietary Preferences</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => navigation.navigate('FoodPreferences')}
              >
                <MaterialCommunityIcons name="silverware-fork-knife" size={24} color="#666" />
                <Text style={styles.settingsMenuItemText}>Food Preferences</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => navigation.navigate('CookingHabits')}
              >
                <MaterialCommunityIcons name="chef-hat" size={24} color="#666" />
                <Text style={styles.settingsMenuItemText}>Cooking Habits</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.settingsMenuItem}
                onPress={() => navigation.navigate('BudgetPreferences')}
              >
                <MaterialCommunityIcons name="currency-usd" size={24} color="#666" />
                <Text style={styles.settingsMenuItemText}>Budget Settings</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
              
              <View style={styles.settingsMenuItem}>
                <MaterialCommunityIcons name="fridge-outline" size={24} color="#666" />
                <Text style={styles.settingsMenuItemText}>Use Pantry in Recipe Generation</Text>
                <Switch
                  value={usePantryItems}
                  onValueChange={handleTogglePantryItems}
                  trackColor={{ false: '#dfdfdf', true: '#c4e6ff' }}
                  thumbColor={usePantryItems ? theme.colors.primary : '#a0a0a0'}
                />
              </View>
            </ExpandableSection>

            {user && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={handleSignOut}
                >
                  <MaterialCommunityIcons name="logout" size={24} color="#666" />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteAccountButton}
                  onPress={handleDeleteAccount}
                >
                  <MaterialCommunityIcons name="delete" size={24} color="#dc3545" />
                  <Text style={styles.deleteAccountText}>Delete Account</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
      
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
    backgroundColor: '#f8f9fa',
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
    color: '#666',
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: '#e1e4e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  signInContainer: {
    alignItems: 'center',
    padding: 20,
  },
  signInText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  expandableSection: {
    backgroundColor: 'white',
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e1e4e8',
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
  },
  expandableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  expandableContent: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e1e4e8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 16,
    marginVertical: 8,
  },
  settingsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingsMenuItemText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: '#333',
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
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
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginVertical: 12,
  },
  emptyStateButton: {
    backgroundColor: theme.colors.primary,
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
    borderTopColor: '#f0f0f0',
  },
  viewAllText: {
    color: theme.colors.primary,
    fontWeight: '600',
    marginRight: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  signOutText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#666',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deleteAccountText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#dc3545',
  },
});

export default ProfileScreen; 