import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMealPlan } from '../contexts/MealPlanContext';
import { Recipe } from '../contexts/MealPlanContext';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

const MealPlanScreen: React.FC = () => {
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState<MealType>('breakfast');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const { mealPlan } = useMealPlan();
  
  // Mock budget data - this should come from your preferences context
  const budget = {
    amount: 150,
    frequency: 'weekly'
  };

  const calculateRemainingBudget = useCallback(() => {
    const spentAmount = Array.from(selectedRecipes).reduce((total, recipeId) => {
      const recipe = mealPlan.find(r => r.id === recipeId);
      return total + (recipe?.estimatedCost || 0);
    }, 0);
    return budget.amount - spentAmount;
  }, [selectedRecipes, mealPlan, budget.amount]);

  const toggleRecipeSelection = (recipeId: string) => {
    const newSelection = new Set(selectedRecipes);
    if (newSelection.has(recipeId)) {
      newSelection.delete(recipeId);
    } else {
      newSelection.add(recipeId);
    }
    setSelectedRecipes(newSelection);
  };

  const toggleRecipeDetails = (recipeId: string) => {
    setExpandedRecipeId(expandedRecipeId === recipeId ? null : recipeId);
  };

  const renderBudgetSection = () => {
    const remainingBudget = calculateRemainingBudget();
    const percentageUsed = ((budget.amount - remainingBudget) / budget.amount) * 100;

    return (
      <View style={styles.budgetContainer}>
        <Text style={styles.budgetTitle}>Budget Overview</Text>
        <View style={styles.budgetDetails}>
          <View style={styles.budgetItem}>
            <Text style={styles.budgetLabel}>Total Budget</Text>
            <Text style={styles.budgetAmount}>${budget.amount.toFixed(2)}</Text>
          </View>
          <View style={styles.budgetItem}>
            <Text style={styles.budgetLabel}>Remaining</Text>
            <Text style={[
              styles.budgetAmount,
              remainingBudget < 0 ? styles.overBudget : null
            ]}>
              ${remainingBudget.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${Math.min(percentageUsed, 100)}%` }]} />
        </View>
      </View>
    );
  };

  const renderMealTypeTabs = () => {
    const tabs: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.selectedTab]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.selectedTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderRecipeCard = (recipe: Recipe) => {
    const isSelected = selectedRecipes.has(recipe.id);
    const isExpanded = expandedRecipeId === recipe.id;

    return (
      <View
        key={recipe.id}
        style={[styles.recipeCard, isSelected && styles.selectedCard]}
      >
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeName}>{recipe.name}</Text>
          <View style={styles.costContainer}>
            <Icon name="currency-usd" size={16} color="#28a745" />
            <Text style={styles.recipeCost}>{recipe.estimatedCost.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.recipeDescription}>{recipe.description}</Text>

        <View style={styles.recipeMetadata}>
          <View style={styles.metadataItem}>
            <Icon name="clock-outline" size={16} color="#6c757d" />
            <Text style={styles.metadataText}>{recipe.cookTime}</Text>
          </View>

          <View style={styles.metadataItem}>
            <Icon name="account-group" size={16} color="#6c757d" />
            <Text style={styles.metadataText}>Serves {recipe.servings}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ingredients:</Text>
        <View style={styles.ingredientsContainer}>
          {recipe.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredient}>• {ingredient.item}</Text>
          ))}
        </View>

        <View style={styles.tagsContainer}>
          {recipe.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.sectionTitle}>Detailed Ingredients:</Text>
            <View style={styles.ingredientsContainer}>
              {recipe.ingredients.map((ingredient, index) => (
                <Text key={index} style={styles.ingredient}>
                  • {ingredient.item} ({ingredient.measurement})
                </Text>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Instructions:</Text>
            <View style={styles.instructionsContainer}>
              {recipe.instructions.map((instruction, index) => (
                <Text key={index} style={styles.instruction}>{index + 1}. {instruction}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.detailsButton]}
            onPress={() => toggleRecipeDetails(recipe.id)}
          >
            <Text style={styles.buttonText}>
              {isExpanded ? 'Hide Details' : 'Show Details'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isSelected ? styles.selectedButton : styles.selectButton]}
            onPress={() => toggleRecipeSelection(recipe.id)}
          >
            <Text style={[styles.buttonText, isSelected ? styles.selectedButtonText : styles.selectButtonText]}>
              {isSelected ? 'Selected' : 'Select Recipe'}
            </Text>
          </TouchableOpacity>
        </View>
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
      
      <ScrollView style={styles.recipesContainer}>
        {mealPlan
          .filter(recipe => recipe.tags.some(tag => tag.toLowerCase() === selectedTab))
          .map(recipe => renderRecipeCard(recipe))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
  },
  budgetContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#212529',
  },
  budgetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  budgetItem: {
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  budgetAmount: {
    fontSize: 20,
    fontWeight: '600',
    color: '#28a745',
  },
  overBudget: {
    color: '#dc3545',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 3,
  },
  tabsContainer: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingVertical: 8,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  selectedTab: {
    backgroundColor: '#007bff',
  },
  tabText: {
    fontSize: 14,
    color: '#495057',
  },
  selectedTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  recipesContainer: {
    flex: 1,
    padding: 16,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedCard: {
    borderColor: '#007bff',
    borderWidth: 2,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
    flex: 1,
    marginRight: 8,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 12,
  },
  recipeMetadata: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metadataText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 4,
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeCost: {
    fontSize: 16,
    color: '#28a745',
    fontWeight: '600',
    marginLeft: 4,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343a40',
    marginBottom: 8,
  },
  ingredientsContainer: {
    marginBottom: 16,
  },
  ingredient: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },
  instructionsContainer: {
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 8,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#495057',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  detailsButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  selectButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007bff',
  },
  selectedButton: {
    backgroundColor: '#007bff',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectButtonText: {
    color: '#007bff',
  },
  selectedButtonText: {
    color: '#fff',
  },
});

export default MealPlanScreen; 