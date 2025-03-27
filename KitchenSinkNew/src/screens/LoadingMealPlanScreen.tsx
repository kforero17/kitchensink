import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Animated, Easing } from 'react-native';
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
import { getPreferenceValue } from '../utils/preferences';
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
        
        // Get all user preferences
        const dietaryPrefs = await getDietaryPreferences();
        const foodPrefs = await getFoodPreferences();
        const cookingPrefs = await getCookingPreferences();
        const budgetPrefs = await getBudgetPreferences();
        
        // Check if user has enabled using pantry items in recipe generation
        const usePantryItems = await getPreferenceValue('usePantryItems', true);
        
        if (!dietaryPrefs || !foodPrefs || !cookingPrefs || !budgetPrefs) {
          throw new Error('One or more preferences not found');
        }
        
        // Set up meal counts based on selected meal types
        const mealTypes = cookingPrefs.mealTypes || [];
        logger.debug('Selected meal types:', mealTypes);
        
        // Default 0 for all meal types
        const counts = {
          breakfast: 0,
          lunch: 0,
          dinner: 0,
          snacks: 0
        };
        
        // Determine the number of meals per type
        // If user specified a particular count, respect that exactly
        const mealsPerType = cookingPrefs.weeklyMealPrepCount || 3;
        logger.debug(`User requested ${mealsPerType} meals per type`);
        
        // Set the requested number for each meal type
        mealTypes.forEach(type => {
          // Only assign to valid meal types
          if (type in counts) {
            counts[type as keyof typeof counts] = mealsPerType;
          }
        });
        
        // Ensure there's at least one meal type with a non-zero count
        if (Object.values(counts).every(count => count === 0)) {
          // Default to all meal types if none selected
          counts.breakfast = mealsPerType;
          counts.lunch = mealsPerType;
          counts.dinner = mealsPerType;
          counts.snacks = mealsPerType;
          logger.debug('No meal types selected, defaulting to all types');
        }
        
        logger.debug('Final meal counts:', counts);
        
        // Now fetch recipes with API preferences
        setLoadingState('fetching_recipes');
        const recipes = await apiRecipeService.getRecipes({
          dietary: dietaryPrefs,
          food: foodPrefs,
          cooking: cookingPrefs,
          budget: budgetPrefs,
          usePantryItems
        });
        
        logger.debug(`API returned ${recipes.length} total recipes`);
        
        if (usePantryItems) {
          logger.debug('Pantry-aware recipe generation was enabled');
          
          // Log recipes with high pantry match percentages
          const pantryMatches = recipes.filter((recipe: any) => 
            recipe.metadata?.pantryMatchPercentage > 25
          );
          
          logger.debug(`${pantryMatches.length} recipes have significant pantry matches`);
        }
        
        // Log the distribution of recipes by meal type
        const breakfastRecipes = recipes.filter(r => r.tags.includes('breakfast')).length;
        const lunchRecipes = recipes.filter(r => r.tags.includes('lunch')).length;
        const dinnerRecipes = recipes.filter(r => r.tags.includes('dinner')).length;
        const snackRecipes = recipes.filter(r => r.tags.includes('snacks')).length;
        
        logger.debug(`Recipe distribution: breakfast=${breakfastRecipes}, lunch=${lunchRecipes}, dinner=${dinnerRecipes}, snacks=${snackRecipes}`);
        
        if (recipes.length === 0) {
          throw new Error('No recipes found. Try adjusting your preferences.');
        }
        
        // Generate the meal plan
        setLoadingState('generating_plan');
        const result = await generateMealPlan(
          recipes,
          {
            dietary: dietaryPrefs,
            food: foodPrefs,
            cooking: cookingPrefs,
            budget: budgetPrefs
          },
          counts
        );
        
        // Ensure all recipes are marked as NOT part of the weekly meal plan by default
        // This is important - only recipes that user explicitly selects should be marked as weekly meal plan
        const processedRecipes = result.recipes.map(recipe => ({
          ...recipe,
          isWeeklyMealPlan: false // Explicitly set to false on generation
        }));
        
        // Success! Set the meal plan and navigate to next screen
        setMealPlan(processedRecipes);
        
        if (result.constraintsRelaxed && result.message) {
          // Just log the message instead of showing an alert to users
          logger.debug('Constraints relaxed:', result.message);
        }
        
        setLoadingState('done');
        
        // Navigate to meal plan screen
        setTimeout(() => {
          setIsLoading(false);
          console.log('Loading meal plan completed successfully. Navigating to MealPlan screen...');
          
          // Use a specific flag to prevent any possible return to Profile
          navigation.reset({
            index: 0,
            routes: [{ name: 'MealPlan', params: { fromGenerator: true }}],
          });
        }, 500);
      } catch (error: any) {
        logger.error('Error generating meal plan:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        setLoadingState('error');
        
        // Navigate back to home screen after a delay
        setTimeout(() => {
          setIsLoading(false);
          navigation.navigate('Home');
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