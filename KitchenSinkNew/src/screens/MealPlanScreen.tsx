import React, { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Animated, ActivityIndicator, Alert, Image, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMealPlan } from '../contexts/MealPlanContext';
import { Recipe } from '../contexts/MealPlanContext';
import { recordMealPlan, saveMealPlanToFirestore, blockRecipePermanent, blockRecipeTemporary } from '../utils/recipeHistory';
import { getBudgetPreferences } from '../utils/preferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { swapRecipe } from '../utils/recipeSwapper';
import logger from '../utils/logger';
import { apiRecipeService } from '../services/apiRecipeService';
import PantryIngredientMatch from '../components/PantryIngredientMatch';
import { firestoreService } from '../services/firebaseService';

// Update MealType to include a combined lunch_dinner type
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
type MealPlanNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MealPlan'>;

const screenWidth = Dimensions.get('window').width;
const recipeImageHeight = screenWidth * 0.56; // 16:9 aspect ratio

const MealPlanScreen: React.FC = () => {
  const navigation = useNavigation<MealPlanNavigationProp>();
  const [selectedRecipes, setSelectedRecipes] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState<MealType>('breakfast');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetPreferences>({ amount: 0, frequency: 'weekly' });
  const [swappingRecipeId, setSwappingRecipeId] = useState<string | null>(null);
  const [blockingRecipeId, setBlockingRecipeId] = useState<string | null>(null);

  // Pending action state for confirmation modal
  const [pendingAction, setPendingAction] = useState<{
    type: 'swap' | 'hide_temp' | 'hide_perm';
    recipe: Recipe;
    mealType: MealType;
  } | null>(null);

  const executePendingAction = async () => {
    if (!pendingAction) return;
    const { type, recipe, mealType } = pendingAction;
    setPendingAction(null);
    switch (type) {
      case 'swap':
        await handleSwapRecipe(recipe.id, mealType);
        break;
      case 'hide_temp':
        await blockAndSwapRecipe(recipe, mealType, true, 10);
        break;
      case 'hide_perm':
        await blockAndSwapRecipe(recipe, mealType, false);
        break;
    }
  };
  const { mealPlan, setMealPlan } = useMealPlan();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPostMealPlanModal, setShowPostMealPlanModal] = useState(false);
  
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

  // Set initial tab - if we have lunch/dinner recipes, default to that tab
  useEffect(() => {
    if (mealPlan.length > 0) {
      // Check if we have any lunch or dinner recipes
      if (mealPlan.some(recipe => recipe.tags.includes('lunch'))) {
        setSelectedTab('lunch');
      } else if (mealPlan.some(recipe => recipe.tags.includes('dinner'))) {
        setSelectedTab('dinner');
      } else if (mealPlan.some(recipe => recipe.tags.includes('breakfast'))) {
        setSelectedTab('breakfast');
      } else if (mealPlan.some(recipe => recipe.tags.includes('snacks'))) {
        setSelectedTab('snacks');
      }
    }
  }, [mealPlan]);

  // Record recipe view history when meal plan is first viewed 
  // This only records view history and doesn't save to profile
  useEffect(() => {
    if (mealPlan.length > 0) {
      recordMealPlan(mealPlan)
        .then(() => console.log('Meal plan view history recorded'))
        .catch(err => console.error('Failed to record meal plan view history:', err));
    }
  }, [mealPlan]);

  // Filter recipes by their PRIMARY tag (tags[0]).
  // Using the primary tag guarantees that each recipe appears under exactly one meal-type tab,
  // eliminating cross-category duplicates and ensuring the counts match the generator’s intent.
  const getRecipesByType = useCallback((type: MealType): Recipe[] => {
    return mealPlan.filter(recipe => recipe.tags[0] === type);
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
      
      // Use the centralized swapRecipe utility directly with mealType
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

  // Helper to block a recipe (permanent or temporary) and attempt to swap in an alternative.
  const blockAndSwapRecipe = async (
    recipe: Recipe,
    mealType: MealType,
    temporary: boolean = false,
    generations: number = 10
  ) => {
    try {
      setBlockingRecipeId(recipe.id);

      // Block recipe
      if (temporary) {
        await blockRecipeTemporary(recipe.id, generations);
      } else {
        await blockRecipePermanent(recipe.id);
      }

      // Try to fetch an alternative recipe of the same meal type
      const alternative = await swapRecipe(recipe.id, mealType, mealPlan);

      if (alternative) {
        // Replace recipe in meal plan
        const updated = mealPlan.map(r => (r.id === recipe.id ? alternative : r));
        setMealPlan(updated);
      } else {
        // If no alternative, just remove it
        setMealPlan(mealPlan.filter(r => r.id !== recipe.id));
      }
    } catch (err) {
      logger.error('Error blocking and swapping recipe:', err);
      Alert.alert('Error', 'Unable to hide recipe at the moment. Please try again.');
    } finally {
      setBlockingRecipeId(null);
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

  // Helper function to convert decimal to fraction
  const decimalToFraction = (decimal: number): string => {
    if (decimal === 0) return '0';
    if (decimal === 1) return '1';
    if (decimal === 0.25) return '1/4';
    if (decimal === 0.33 || decimal === 0.333) return '1/3';
    if (decimal === 0.5) return '1/2';
    if (decimal === 0.66 || decimal === 0.666) return '2/3';
    if (decimal === 0.75) return '3/4';
    if (decimal >= 1) {
      const whole = Math.floor(decimal);
      const fraction = decimalToFraction(decimal - whole);
      return fraction === '0' ? whole.toString() : `${whole} ${fraction}`;
    }
    
    // For other decimals, convert to fraction
    const tolerance = 1.0E-6;
    let numerator = 1;
    let denominator = 1;
    let error = Math.abs(decimal - numerator / denominator);
    
    for (let d = 2; d <= 16; d++) {
      const n = Math.round(decimal * d);
      const newError = Math.abs(decimal - n / d);
      if (newError < error) {
        numerator = n;
        denominator = d;
        error = newError;
      }
    }
    
    if (error < tolerance) {
      return `${numerator}/${denominator}`;
    }
    
    // If we can't find a good fraction, return the decimal
    return decimal.toString();
  };

  // Helper function to format measurement
  const formatMeasurement = (measurement: string): string => {
    // Check if the measurement starts with a number
    const match = measurement.match(/^(\d*\.?\d+)\s*(.*)$/);
    if (match) {
      const [_, number, unit] = match;
      const fraction = decimalToFraction(parseFloat(number));
      return `${fraction} ${unit}`.trim();
    }
    return measurement;
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
              {budget.amount.toFixed(2)}
            </Text>
            <Text style={styles.budgetLabel}>Budget</Text>
          </View>
          <View style={styles.budgetInfo}>
            <Text style={styles.costText}>
              {totalCost.toFixed(2)}
            </Text>
            <Text style={styles.budgetLabel}>Meal Plan Cost</Text>
          </View>
        </View>
        
        {/* Action Buttons Container */}
        <View style={styles.actionButtonsContainer}>
          {/* Add Save Button */}
          <TouchableOpacity 
            style={[styles.saveButton, isSaving ? styles.buttonDisabled : null]}
            onPress={async () => {
              if (isSaving) return;
              
              const saved = await saveSelectedRecipesToProfile();
              if (saved) {
                Alert.alert(
                  "Recipes Saved",
                  "Your selected recipes have been saved to your profile. You can continue customizing your meal plan or view your saved recipes in your profile later.",
                  [{ text: "OK" }]
                );
              }
            }}
            onLongPress={resetAllWeeklyFlags}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="content-save" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : `Save Selected (${selectedRecipes.size})`}
            </Text>
          </TouchableOpacity>
          
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
      </View>
    );
  };

  const renderMealTypeTabs = () => {
    // Count recipes by **primary** meal type to stay consistent with getRecipesByType
    const breakfastCount = mealPlan.filter(r => r.tags[0] === 'breakfast').length;
    const lunchCount = mealPlan.filter(r => r.tags[0] === 'lunch').length;
    const dinnerCount = mealPlan.filter(r => r.tags[0] === 'dinner').length;
    const snacksCount = mealPlan.filter(r => r.tags[0] === 'snacks').length;
    
    // Define tabs to show - always include the combined lunch_dinner tab instead of separate ones
    const tabs: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    // Only show tabs that have recipes
    const filteredTabs = tabs.filter(tab => {
      // No combined logic needed
      
      return mealPlan.some(recipe => recipe.tags.includes(tab));
    });
    
    // If no tabs have recipes, show all tabs
    const displayTabs = filteredTabs.length > 0 ? filteredTabs : tabs;
    
    return (
      <View style={styles.tabsContainer}>
        {displayTabs.map(tab => {
          const isActive = tab === selectedTab;
          
          let count = getRecipesByType(tab).length;
          let tabLabel = '';
          
          // Set the tab label based on the tab type
          switch(tab) {
            default:
              tabLabel = tab.charAt(0).toUpperCase() + tab.slice(1);
          }
          
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive ? styles.activeTab : null]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text style={[styles.tabText, isActive ? styles.activeTabText : null]}>
                {tabLabel}
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
    const isBlocking = blockingRecipeId === recipe.id;
    
    // Log recipe name and imageUrl for debugging
    logger.debug(`[MealPlanScreen] Rendering card for: ${recipe.name}, ImageUrl: ${recipe.imageUrl}`);
    if (recipe.imageUrl) {
      logger.debug(`[MealPlanScreen] Image component will be rendered for ${recipe.name}`);
    } else {
      logger.debug(`[MealPlanScreen] Image component will NOT be rendered for ${recipe.name} (no imageUrl)`);
    }
    
    return (
      <View key={recipe.id} style={[styles.recipeCard, isSelected ? styles.selectedRecipeCard : null]}>
        <TouchableOpacity style={styles.recipeHeader} onPress={() => toggleRecipeDetails(recipe.id)}>
          {recipe.imageUrl && (
            <Image source={{ uri: recipe.imageUrl }} style={styles.recipeImage} />
          )}
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
              <MaterialCommunityIcons name="account-outline" size={14} /> {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
            </Text>
            <Text style={styles.recipeInfo}>
              <MaterialCommunityIcons name="currency-usd" size={14} /> {recipe.estimatedCost.toFixed(2)}
            </Text>
            
            {/* Add compact pantry match indicator */}
            <PantryIngredientMatch ingredients={recipe.ingredients} compact={true} />
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
            <Text style={styles.recipeDescription}>
              {recipe.description
                .split('.')
                .filter(sentence => sentence.trim().length > 0)
                .map((sentence, i, arr) => 
                  `${sentence.trim()}${i < arr.length - 1 ? '.' : ''}`
                )
                .join(' ')}
            </Text>
            
            {/* Add full pantry match component */}
            <PantryIngredientMatch ingredients={recipe.ingredients} />
            
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient, index) => (
              <Text key={index} style={styles.ingredient}>
                • {formatMeasurement(ingredient.measurement)} {ingredient.item}
              </Text>
            ))}
            
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.instructions.map((step, index) => (
              <Text key={index} style={styles.instruction}>
                {index + 1}. {step}
              </Text>
            ))}
            
            {/* Action buttons container */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <TouchableOpacity 
                style={[styles.swapButton, { flex: 1 }]}
                onPress={() => setPendingAction({ type: 'swap', recipe, mealType: selectedTab })}
                disabled={isSwapping || isBlocking}
              >
                {isSwapping ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="swap-horizontal" size={16} color="#ffffff" />
                    <Text style={styles.swapButtonText}>Swap</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.blockTempButton, { flex: 1 }]}
                onPress={() => setPendingAction({ type: 'hide_temp', recipe, mealType: selectedTab })}
                disabled={isBlocking || isSwapping}
              >
                {isBlocking ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="clock-alert" size={16} color="#ffffff" />
                    <Text style={styles.swapButtonText}>Hide 10x</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.blockPermButton, { flex: 1 }]}
                onPress={() => setPendingAction({ type: 'hide_perm', recipe, mealType: selectedTab })}
                disabled={isBlocking || isSwapping}
              >
                {isBlocking ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="block-helper" size={16} color="#ffffff" />
                    <Text style={styles.swapButtonText}>Hide</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Save selected recipes to user profile
  const saveSelectedRecipesToProfile = async () => {
    if (selectedRecipes.size === 0) {
      Alert.alert(
        "No Recipes Selected",
        "Please select at least one recipe to save to your weekly meal plan.",
        [{ text: "OK" }]
      );
      return false;
    }

    try {
      setIsSaving(true);
      
      // Convert the selected recipes Set to an array of Recipe objects
      const selectedRecipesArray = Array.from(selectedRecipes)
        .map(id => mealPlan.find(recipe => recipe.id === id))
        .filter((recipe): recipe is Recipe => recipe !== undefined);
      
      console.log(`Saving ${selectedRecipesArray.length} selected recipes to profile:`);
      selectedRecipesArray.forEach(recipe => {
        console.log(`- ${recipe.name} (${recipe.tags.join(', ')})`);
      });
      
      // Determine if we should replace existing recipes or append to them
      // For now, we'll replace existing recipes when saving from the meal plan screen
      // This preserves the original behavior but makes it explicit
      const replaceExisting = true;
      
      // Save only the selected recipes to Firestore
      const saveResult = await saveMealPlanToFirestore(selectedRecipesArray, replaceExisting);
      
      // Check for success (true) return value 
      if (saveResult === false) {
        throw new Error('Failed to save recipes to profile');
      }
      
      console.log('Successfully saved selected recipes to profile');
      
      // Show success message but don't navigate away - let the user continue with meal planning
      Alert.alert(
        "Recipes Saved",
        "Your selected recipes have been saved to your profile. You can continue customizing your meal plan or view your saved recipes in your profile later.",
        [{ text: "OK" }]
      );
      
      return true;
    } catch (error) {
      console.error('Failed to save selected recipes to profile:', error);
      Alert.alert(
        "Error",
        "There was a problem saving your recipes. Please try again.",
        [{ text: "OK" }]
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // For debugging: Reset all weekly meal plan flags
  const resetAllWeeklyFlags = async () => {
    try {
      console.log('Resetting all weekly meal plan flags...');
      await firestoreService.resetAllWeeklyMealPlanFlags();
      console.log('Successfully reset all weekly meal plan flags');
      Alert.alert(
        "Debug: Flags Reset",
        "All weekly meal plan flags have been reset. This is a debugging function.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error('Error resetting weekly meal plan flags:', error);
      Alert.alert(
        "Error",
        "Failed to reset weekly meal plan flags.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Meal Plan</Text>
        
        {/* Add Grocery List Button */}
        {mealPlan.length > 0 && (
          <TouchableOpacity 
            style={[styles.groceryButton, isSaving ? styles.buttonDisabled : null]}
            onPress={async () => {
              if (isSaving) return;
              
              // First save selected recipes to profile
              const saved = await saveSelectedRecipesToProfile();
              if (saved) {
                // Then navigate to grocery list with selected recipes
                const selectedRecipesArray = Array.from(selectedRecipes)
                  .map(id => mealPlan.find(recipe => recipe.id === id))
                  .filter(recipe => recipe !== undefined);
                
                navigation.navigate('GroceryList', { 
                  selectedRecipes: selectedRecipesArray 
                });
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="cart-outline" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.groceryButtonText}>
              {isSaving ? 'Saving...' : 'Create Grocery List'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Unified scrollable content */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Instructions for users */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#007bff" />{' '}
            Select recipes you want to include in your weekly meal plan, then tap "Save Selected" to save them to your profile.
          </Text>
        </View>

        {renderBudgetSection()}
        {renderMealTypeTabs()}

        {/* Selection Actions Bar */}
        {mealPlan.length > 0 && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionText}>
              {selectedRecipes.size} {selectedRecipes.size === 1 ? 'recipe' : 'recipes'} selected
            </Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => {
                  // Select all recipes in the current meal plan
                  const allIds = new Set(mealPlan.map(recipe => recipe.id));
                  setSelectedRecipes(allIds);
                }}
              >
                <MaterialCommunityIcons name="select-all" size={16} color="#333" />
                <Text style={styles.selectionButtonText}>Select All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => {
                  // Clear selection
                  setSelectedRecipes(new Set());
                }}
              >
                <MaterialCommunityIcons name="close" size={16} color="#333" />
                <Text style={styles.selectionButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recipe List */}
        <View style={styles.recipeList}>
          {getRecipesByType(selectedTab).length > 0 ? (
            getRecipesByType(selectedTab).map(renderRecipeCard)
          ) : (
            <Text style={styles.emptyState}>
              {`No ${selectedTab} recipes in your plan.`}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Add a button at the bottom of the screen to finish meal planning */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.finishButton}
          onPress={() => setShowPostMealPlanModal(true)}
        >
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPostMealPlanModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPostMealPlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>What would you like to do next?</Text>
            {selectedRecipes.size > 0 && (
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowPostMealPlanModal(false);
                  navigation.navigate('GroceryList', { selectedRecipes: mealPlan.filter(r => selectedRecipes.has(r.id)) });
                }}
              >
                <Text style={styles.modalButtonText}>Create Grocery List</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowPostMealPlanModal(false);
                navigation.navigate('Profile');
              }}
            >
              <Text style={styles.modalButtonText}>Go to Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={pendingAction !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingAction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '85%' }]}>
            {pendingAction && (
              <>
                <Text style={styles.modalTitle}>
                  {pendingAction.type === 'swap' && 'Swap Recipe'}
                  {pendingAction.type === 'hide_temp' && 'Temporarily Hide Recipe'}
                  {pendingAction.type === 'hide_perm' && 'Permanently Hide Recipe'}
                </Text>
                <Text style={{ color: '#4E4E4E', marginBottom: 20, textAlign: 'center' }}>
                  {pendingAction.type === 'swap' && 'We will look for an alternative recipe of the same meal type to replace this one.'}
                  {pendingAction.type === 'hide_temp' && 'This recipe will be hidden from recommendations for at least the next 10 meal-plan generations and replaced with another recipe now.'}
                  {pendingAction.type === 'hide_perm' && 'This recipe will be hidden permanently from future recommendations and replaced with another recipe now.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.blockPermButton, { flex: 1, backgroundColor: '#7A736A' }]}
                    onPress={() => setPendingAction(null)}
                  >
                    <Text style={styles.swapButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.swapButton, { flex: 1 }]}
                    onPress={executePendingAction}
                  >
                    <Text style={styles.swapButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F1',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4E4E4E',
  },
  budgetContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#4E4E4E',
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
    color: '#4E4E4E',
  },
  budgetLabel: {
    color: '#7A736A',
  },
  costText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#4E4E4E',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
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
    borderBottomColor: '#D9A15B',
  },
  tabText: {
    color: '#7A736A',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#D9A15B',
  },
  recipeList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  selectedRecipeCard: {
    borderWidth: 2,
    borderColor: '#D9A15B',
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
    borderColor: '#E0D8CC',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#D9A15B',
    borderColor: '#D9A15B',
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4E4E4E',
    flex: 1,
  },
  recipeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4
  },
  recipeInfo: {
    color: '#7A736A',
    fontSize: 14,
    marginRight: 16,
    marginBottom: 4
  },
  expandIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    color: '#7A736A',
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E0D8CC',
  },
  recipeDescription: {
    marginBottom: 16,
    color: '#4E4E4E',
    lineHeight: 22,
    flexWrap: 'wrap',
    fontSize: 14,
    paddingHorizontal: 4,
    textAlign: 'justify',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    color: '#4E4E4E',
  },
  ingredient: {
    marginBottom: 4,
    color: '#4E4E4E',
  },
  instruction: {
    marginBottom: 8,
    color: '#4E4E4E',
    lineHeight: 20,
  },
  emptyState: {
    textAlign: 'center',
    marginTop: 32,
    color: '#7A736A',
    fontSize: 16,
  },
  swapButton: {
    marginTop: 16,
    backgroundColor: '#D9A15B',
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#5C8A4F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    marginLeft: 5,
    fontWeight: '500',
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#B57A42',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    marginLeft: 5,
    fontWeight: '500',
  },
  groceryButton: {
    backgroundColor: '#5C8A4F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  groceryButtonText: {
    color: '#FFFFFF',
    marginLeft: 5,
    fontWeight: '500',
    fontSize: 14,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  selectionText: {
    flex: 1,
    color: '#7A736A',
    fontSize: 14,
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#E0D8CC',
    borderRadius: 4,
  },
  selectionButtonText: {
    color: '#4E4E4E',
    fontWeight: '500',
    marginLeft: 5,
  },
  buttonDisabled: {
    backgroundColor: '#E0D8CC',
  },
  instructionsContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8CC',
  },
  instructionsText: {
    color: '#7A736A',
    fontSize: 14,
  },
  recipeImage: {
    width: '100%',
    height: recipeImageHeight,
    resizeMode: 'cover',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0D8CC',
  },
  finishButton: {
    backgroundColor: '#5C8A4F',
    padding: 12,
    borderRadius: 5,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#4E4E4E',
  },
  modalButton: {
    backgroundColor: '#5C8A4F',
    padding: 12,
    borderRadius: 5,
    marginBottom: 10,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // Added styles for unified ScrollView
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // ensures content isn't hidden behind the footer
  },
  blockTempButton: {
    marginTop: 16,
    backgroundColor: '#B57A42', // brownish
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockPermButton: {
    marginTop: 16,
    backgroundColor: '#A14F4F', // reddish
    borderRadius: 4,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MealPlanScreen; 