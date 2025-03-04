import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Animated, Easing, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMealPlan } from '../contexts/MealPlanContext';
import { generateMealPlan } from '../utils/mealPlanSelector';
import { 
  getDietaryPreferences, 
  getFoodPreferences,
  getCookingPreferences,
  getBudgetPreferences
} from '../utils/preferences';
import { apiRecipeService } from '../services/apiRecipeService';
import logger from '../utils/logger';
import { MealType } from '../types/CookingPreferences';

type LoadingMealPlanScreenProps = NativeStackNavigationProp<RootStackParamList, 'LoadingMealPlan'>;

// Loading states to show progress
type LoadingState = 'loading_preferences' | 'fetching_recipes' | 'generating_plan' | 'done' | 'error';

const LoadingMealPlanScreen: React.FC = () => {
  const navigation = useNavigation<LoadingMealPlanScreenProps>();
  const { setMealPlan, setIsLoading } = useMealPlan();
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading_preferences');
  const spinValue = new Animated.Value(0);

  // Create the spinning animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Generate meal plan based on user preferences
  useEffect(() => {
    const generatePlan = async () => {
      try {
        setIsLoading(true);
        setLoadingState('loading_preferences');
        
        // Load all user preferences
        const dietaryPrefs = await getDietaryPreferences();
        const foodPrefs = await getFoodPreferences();
        const cookingPrefs = await getCookingPreferences();
        const budgetPrefs = await getBudgetPreferences();
        
        if (!dietaryPrefs || !foodPrefs || !cookingPrefs || !budgetPrefs) {
          throw new Error('Failed to load user preferences');
        }
        
        // Get the user's selected meal types
        const selectedMealTypes = cookingPrefs.mealTypes || [];
        
        // If no meal types selected, use all meal types
        if (selectedMealTypes.length === 0) {
          selectedMealTypes.push('breakfast', 'lunch', 'dinner', 'snacks');
        }
        
        // Set up meal counts based on selected meal types (3-5 recipes per selected type)
        const mealCounts = {
          breakfast: selectedMealTypes.includes('breakfast') ? 3 : 0,
          lunch: selectedMealTypes.includes('lunch') ? 3 : 0,
          dinner: selectedMealTypes.includes('dinner') ? 3 : 0,
          snacks: selectedMealTypes.includes('snacks') ? 2 : 0,
        };
        
        // Log for debugging
        logger.debug('Generating meal plan with preferences:', {
          dietary: dietaryPrefs,
          food: foodPrefs,
          cooking: cookingPrefs,
          budget: budgetPrefs,
          selectedMealTypes,
          mealCounts
        });
        
        // Update loading state
        setLoadingState('fetching_recipes');
        
        // Fetch recipes from API service
        const recipes = await apiRecipeService.getRecipes({
          dietary: dietaryPrefs,
          food: foodPrefs,
          cooking: cookingPrefs,
          budget: budgetPrefs
        });
        
        // Check if we have recipes
        logger.debug('Recipe service returned:', {
          totalRecipes: recipes.length,
          breakfastRecipes: recipes.filter(r => r.tags.includes('breakfast')).length,
          lunchRecipes: recipes.filter(r => r.tags.includes('lunch')).length,
          dinnerRecipes: recipes.filter(r => r.tags.includes('dinner')).length,
          snackRecipes: recipes.filter(r => r.tags.includes('snacks')).length,
        });
        
        // Update loading state
        setLoadingState('generating_plan');
        
        // Generate the meal plan
        const result = await generateMealPlan(
          recipes,
          {
            dietary: dietaryPrefs,
            food: foodPrefs,
            cooking: cookingPrefs,
            budget: budgetPrefs
          },
          mealCounts
        );
        
        // Log the generated recipes by meal type
        const generatedPlan = {
          totalRecipes: result.recipes.length,
          breakfastRecipes: result.recipes.filter(r => r.tags.includes('breakfast')).length,
          lunchRecipes: result.recipes.filter(r => r.tags.includes('lunch')).length,
          dinnerRecipes: result.recipes.filter(r => r.tags.includes('dinner')).length,
          snackRecipes: result.recipes.filter(r => r.tags.includes('snacks')).length,
        };
        
        logger.debug('Generated meal plan:', generatedPlan);
        
        // Save the meal plan to context
        setMealPlan(result.recipes);
        
        // If constraints were relaxed, we could show a message
        if (result.constraintsRelaxed && result.message) {
          logger.debug('Constraints relaxed:', result.message);
        }
        
        // Update loading state
        setLoadingState('done');
        
        // Navigate to meal plan screen after a delay
        setTimeout(() => {
          setIsLoading(false);
          navigation.replace('MealPlan');
        }, 1500);
        
      } catch (error: any) {
        logger.error('Failed to generate meal plan:', error);
        setLoadingState('error');
        
        // Set error message
        let errorMessage = 'Failed to generate your meal plan. Please try again.';
        
        // Handle specific error cases
        if (error.message && error.message.includes('API')) {
          errorMessage = 'Could not connect to recipe service. Using backup recipes.';
        } else if (error.message && error.message.includes('preferences')) {
          errorMessage = 'Failed to load your preferences. Please set them up again.';
        } else if (error.message && error.message.includes('plan')) {
          errorMessage = 'Could not generate a meal plan that meets all your requirements. Please try with fewer restrictions.';
        }
        
        setError(errorMessage);
        
        // Navigate back to home screen after a delay
        setTimeout(() => {
          setIsLoading(false);
          navigation.replace('Home');
        }, 3000);
      }
    };

    generatePlan();
  }, [navigation, setMealPlan, setIsLoading]);

  // Generate the rotation interpolation
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  // Get loading message based on state
  const getLoadingMessage = (): string => {
    switch (loadingState) {
      case 'loading_preferences':
        return 'Loading your preferences...';
      case 'fetching_recipes':
        return 'Finding recipes that match your preferences...';
      case 'generating_plan':
        return 'Creating your personalized meal plan...';
      case 'done':
        return 'Plan generated successfully!';
      case 'error':
        return 'There was a problem generating your plan.';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <MaterialCommunityIcons name="food-fork-drink" size={60} color="#007AFF" />
        </Animated.View>
        <Text style={styles.title}>Generating Meal Plan</Text>
        <Text style={styles.subtitle}>
          {getLoadingMessage()}
        </Text>
        
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default LoadingMealPlanScreen; 