import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMealPlan } from '../contexts/MealPlanContext';
import { Recipe } from '../contexts/MealPlanContext';
import { recordMealPlan } from '../utils/recipeHistory';
import { getBudgetPreferences } from '../utils/preferences';
import { BudgetPreferences } from '../types/BudgetPreferences';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

const MealPlanScreen: React.FC = () => {
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState<MealType>('breakfast');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetPreferences>({ amount: 0, frequency: 'weekly' });
  const { mealPlan } = useMealPlan();
  
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
        <Text style={styles.budgetTitle}>Budget</Text>
        <View style={styles.budgetProgressContainer}>
          <View style={[styles.budgetProgressBar, { width: `${Math.min(100, budgetPercentage)}%`, backgroundColor: statusColor }]} />
        </View>
        <View style={styles.budgetDetails}>
          <Text style={styles.budgetText}>${totalCost.toFixed(2)} spent</Text>
          <Text style={styles.budgetText}>${budget.amount.toFixed(2)} budget</Text>
        </View>
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
    
    return (
      <View key={recipe.id} style={[styles.recipeCard, isSelected ? styles.selectedRecipeCard : null]}>
        <TouchableOpacity style={styles.recipeHeader} onPress={() => toggleRecipeDetails(recipe.id)}>
          <View style={styles.recipeTitleRow}>
            <TouchableOpacity 
              style={[styles.checkbox, isSelected ? styles.checkboxSelected : null]} 
              onPress={() => toggleRecipeSelection(recipe.id)}
            >
              {isSelected && <Icon name="check" size={16} color="#ffffff" />}
            </TouchableOpacity>
            <Text style={styles.recipeTitle}>{recipe.name}</Text>
          </View>
          <View style={styles.recipeDetails}>
            <Text style={styles.recipeInfo}>
              <Icon name="clock-outline" size={14} /> {recipe.prepTime} prep + {recipe.cookTime} cook
            </Text>
            <Text style={styles.recipeInfo}>
              <Icon name="currency-usd" size={14} /> ${recipe.estimatedCost.toFixed(2)}
            </Text>
          </View>
          <Icon 
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
  budgetProgressContainer: {
    height: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  budgetProgressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  budgetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetText: {
    color: '#495057',
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
});

export default MealPlanScreen; 