import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Animated, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMealPlan } from '../contexts/MealPlanContext';
import { Recipe } from '../contexts/MealPlanContext';
import { recordMealPlan } from '../utils/recipeHistory';
import { getBudgetPreferences } from '../utils/preferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { swapRecipe } from '../utils/recipeSwapper';
import logger from '../utils/logger';
import { apiRecipeService } from '../services/apiRecipeService';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
type MealPlanNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MealPlan'>;

const MealPlanScreen: React.FC = () => {
  const navigation = useNavigation<MealPlanNavigationProp>();
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState<MealType>('breakfast');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetPreferences>({ amount: 0, frequency: 'weekly' });
  const [swappingRecipeId, setSwappingRecipeId] = useState<string | null>(null);
  const { mealPlan, setMealPlan } = useMealPlan();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Load budget preferences when component mounts
  useEffect(() => {
    const loadBudget = async () => {
      const budgetPrefs = await getBudgetPreferences();
      if (budgetPrefs) {
        setBudget(budgetPrefs);
      }
    };
    loadBudget();
  }, []);

  // Record recipe history when meal plan is first viewed
  useEffect(() => {
    if (mealPlan.length > 0) {
      recordMealPlan(mealPlan)
        .then(() => console.log('Meal plan recorded to history'))
        .catch(err => console.error('Failed to record meal plan history:', err));
    }
  }, [mealPlan]);

  // Filter recipes by meal type
  const getRecipesByType = useCallback((type: MealType): Recipe[] => {
    return mealPlan.filter(recipe => recipe.tags.includes(type));
  }, [mealPlan]);

  const toggleRecipeSelection = (recipeId: string) => {
    setSelectedRecipes(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(recipeId)) {
        newSelection.delete(recipeId);
      } else {
        newSelection.add(recipeId);
      }
      return newSelection;
    });
  };

  const toggleRecipeDetails = (recipeId: string) => {
    setExpandedRecipeId(expandedRecipeId === recipeId ? null : recipeId);
  };

  // Handles recipe swapping functionality
  const handleSwapRecipe = async (recipeId: string, mealType: string) => {
    try {
      setSwappingRecipeId(recipeId);
      
      // Use the centralized swapRecipe utility
      const alternativeRecipe = await swapRecipe(recipeId, mealType, mealPlan);
      
      if (!alternativeRecipe) {
        Alert.alert(
          "No Alternative Found",
          "We couldn't find a suitable alternative recipe. Try adjusting your preferences."
        );
        return;
      }
      
      // Replace the recipe in the meal plan
      const updatedMealPlan = mealPlan.map(recipe => 
        recipe.id === recipeId ? alternativeRecipe : recipe
      );
      
      // Update the meal plan
      setMealPlan(updatedMealPlan);
      
      // If the swapped recipe was selected, select the new one
      if (selectedRecipes.has(recipeId)) {
        setSelectedRecipes(prev => {
          const newSelection = new Set(prev);
          newSelection.delete(recipeId);
          newSelection.add(alternativeRecipe.id);
          return newSelection;
        });
      }
      
      // If the swapped recipe was expanded, expand the new one
      if (expandedRecipeId === recipeId) {
        setExpandedRecipeId(alternativeRecipe.id);
      }
      
    } catch (error) {
      logger.error('Error swapping recipe:', error);
      Alert.alert(
        "Error",
        "Something went wrong while swapping the recipe. Please try again."
      );
    } finally {
      setSwappingRecipeId(null);
    }
  };

  // Function to handle refreshing recipes from API
  const handleRefreshRecipes = async () => {
    setIsRefreshing(true);
    
    try {
      // Load current budget preference for total calculation
      const budgetPrefs = await getBudgetPreferences();
      
      // Clear the cache to force a fresh fetch from API
      apiRecipeService.setClearCache(true);
      
      // Navigate to loading screen which will fetch fresh recipes
      navigation.navigate('LoadingMealPlan');
    } catch (error) {
      // Show error alert
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh recipes. Please try again later.',
        [{ text: 'OK' }]
      );
      setIsRefreshing(false);
    }
  };

  const renderBudgetSection = () => {
    // Calculate the total cost of selected recipes
    const selectedRecipesArray = mealPlan.filter(r => selectedRecipes.has(r.id));
    const totalCost = selectedRecipesArray.reduce((sum, recipe) => sum + recipe.estimatedCost, 0);
    const budgetPercentage = (totalCost / budget.amount) * 100;
    
    let statusColor = '#4CAF50'; // Green for good
    if (budgetPercentage > 85) {
      statusColor = '#F44336'; // Red for over budget
    } else if (budgetPercentage > 70) {
      statusColor = '#FFC107'; // Yellow for warning
    }
    
    return (
      <View style={styles.budgetContainer}>
        <Text style={styles.budgetTitle}>Weekly Budget</Text>
        <View style={styles.budgetInfoContainer}>
          <View style={styles.budgetInfo}>
            <Text style={styles.budgetText}>
              ${budget.amount.toFixed(2)}
            </Text>
            <Text style={styles.budgetLabel}>Budget</Text>
          </View>
          <View style={styles.budgetInfo}>
            <Text style={styles.costText}>
              ${totalCost.toFixed(2)}
            </Text>
            <Text style={styles.budgetLabel}>Meal Plan Cost</Text>
          </View>
        </View>
        
        {/* Add Refresh Button */}
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefreshRecipes}
          disabled={isRefreshing}
        >
          <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.refreshButtonText}>
            {isRefreshing ? 'Refreshing...' : 'Refresh Recipes'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMealTypeTabs = () => {
    const tabs: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    return (
      <View style={styles.tabsContainer}>
        {tabs.map(tab => {
          const isActive = tab === selectedTab;
          const count = getRecipesByType(tab).length;
          
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive ? styles.activeTab : null]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, isActive ? styles.activeTabText : null]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {count > 0 && ` (${count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderRecipeCard = (recipe: Recipe) => {
    const isExpanded = expandedRecipeId === recipe.id;
    const isSelected = selectedRecipes.has(recipe.id);
    const isSwapping = swappingRecipeId === recipe.id;
    
    return (
      <View key={recipe.id} style={[styles.recipeCard, isSelected ? styles.selectedRecipeCard : null]}>
        <TouchableOpacity style={styles.recipeHeader} onPress={() => toggleRecipeDetails(recipe.id)}>
          <View style={styles.recipeTitleRow}>
            <TouchableOpacity 
              style={[styles.checkbox, isSelected ? styles.checkboxSelected : null]} 
              onPress={() => toggleRecipeSelection(recipe.id)}
            >
              {isSelected && <MaterialCommunityIcons name="check" size={16} color="#ffffff" />}
            </TouchableOpacity>
            <Text style={styles.recipeTitle}>{recipe.name}</Text>
          </View>
          <View style={styles.recipeDetails}>
            <Text style={styles.recipeInfo}>
              <MaterialCommunityIcons name="clock-outline" size={14} /> {recipe.prepTime} prep + {recipe.cookTime} cook
            </Text>
            <Text style={styles.recipeInfo}>
              <MaterialCommunityIcons name="currency-usd" size={14} /> ${recipe.estimatedCost.toFixed(2)}
            </Text>
          </View>
          <MaterialCommunityIcons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={24} 
            color="#666" 
            style={styles.expandIcon}
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.recipeDescription}>{recipe.description}</Text>
            
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.ingredient}>
                • {ingredient.measurement} {ingredient.item}
              </Text>
            ))}
            
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.instructions.map((step, index) => (
              <Text key={index} style={styles.instruction}>
                {index + 1}. {step}
              </Text>
            ))}
            
            <TouchableOpacity 
              style={styles.swapButton}
              onPress={() => handleSwapRecipe(recipe.id, selectedTab)}
              disabled={isSwapping}
            >
              {isSwapping ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="swap-horizontal" size={16} color="#ffffff" />
                  <Text style={styles.swapButtonText}>Swap Recipe</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Meal Plan</Text>
      </View>
      
      {renderBudgetSection()}
      {renderMealTypeTabs()}
      
      <ScrollView style={styles.recipeList}>
        {getRecipesByType(selectedTab).length > 0 ? (
          getRecipesByType(selectedTab).map(renderRecipeCard)
        ) : (
          <Text style={styles.emptyState}>No {selectedTab} recipes in your plan.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
  },
  budgetContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  budgetInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetInfo: {
    alignItems: 'center',
  },
  budgetText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetLabel: {
    color: '#6c757d',
  },
  costText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007bff',
  },
  tabText: {
    color: '#6c757d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007bff',
  },
  recipeList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  recipeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  selectedRecipeCard: {
    borderWidth: 2,
    borderColor: '#007bff',
  },
  recipeHeader: {
    padding: 16,
  },
  recipeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ced4da',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },
  recipeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recipeInfo: {
    color: '#6c757d',
    fontSize: 14,
  },
  expandIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  recipeDescription: {
    marginBottom: 16,
    color: '#495057',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  ingredient: {
    marginBottom: 4,
    color: '#495057',
  },
  instruction: {
    marginBottom: 8,
    color: '#495057',
    lineHeight: 20,
  },
  emptyState: {
    textAlign: 'center',
    marginTop: 32,
    color: '#6c757d',
    fontSize: 16,
  },
  swapButton: {
    marginTop: 16,
    backgroundColor: '#007bff',
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginTop: 15,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    marginLeft: 5,
    fontWeight: '500',
  },
});

export default MealPlanScreen; 