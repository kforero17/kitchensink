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
import { fetchRecommendedRecipes } from '../services/recommendationMealPlanService';
import { getPreferenceValue } from '../utils/preferences';
import logger from '../utils/logger';
import { MealType } from '../types/CookingPreferences';
import { apiRecipeService } from '../services/apiRecipeService';
import auth from '@react-native-firebase/auth';

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
        
        // Determine the number of meals per type, enforcing a minimum of 5
        // The user can ask for more than 5, but never less.
        const MIN_MEALS_PER_TYPE = 5;
        const requestedMealsPerType = cookingPrefs.weeklyMealPrepCount ?? MIN_MEALS_PER_TYPE;
        const mealsPerType = Math.max(requestedMealsPerType, MIN_MEALS_PER_TYPE);
        logger.debug(`Meals per type set to ${mealsPerType} (requested: ${requestedMealsPerType}, minimum enforced: ${MIN_MEALS_PER_TYPE})`);
        
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
        
        // ---- Ensure Firebase auth is ready ----
        if (!auth().currentUser) {
          logger.info('[AUTH DEBUG] Waiting for Firebase auth...');
          await new Promise(resolve => {
            const timeout = setTimeout(() => {
              logger.warn('[AUTH DEBUG] Auth wait timeout – continuing without uid');
              resolve(null);
            }, 5000);
            const unsub = auth().onAuthStateChanged(user => {
              if (user) {
                clearTimeout(timeout);
                unsub();
                logger.info('[AUTH DEBUG] Auth ready:', user.uid);
                resolve(null);
              }
            });
          });
        }
        
        // Now fetch recipes with API preferences
        setLoadingState('fetching_recipes');
        const recipes = await fetchRecommendedRecipes({
          dietary: dietaryPrefs,
          food: foodPrefs,
          cooking: cookingPrefs,
          budget: budgetPrefs,
          usePantryItems,
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
        
        // DEBUG: Log first 5 recipes with their tags to see what we're working with
        logger.debug('[DEBUG] First 5 recipes from API:');
        recipes.slice(0, 5).forEach((r, i) => {
          logger.debug(`[DEBUG] ${i + 1}. ${r.name} - Tags: [${r.tags.join(', ')}]`);
        });
        
        // DEBUG: Log specifically any breakfast-tagged recipes
        const breakfastTaggedRecipes = recipes.filter(r => r.tags.includes('breakfast'));
        logger.debug(`[DEBUG] Found ${breakfastTaggedRecipes.length} breakfast-tagged recipes`);
        if (breakfastTaggedRecipes.length > 0) {
          logger.debug('[DEBUG] Sample breakfast recipes:');
          breakfastTaggedRecipes.slice(0, 3).forEach(r => {
            logger.debug(`[DEBUG] - ${r.name} (${r.id})`);
          });
        }
        
        if (recipes.length === 0) {
          throw new Error('No recipes found. Try adjusting your preferences.');
        }

        // ------------------------------------------------------------------
        // Ensure we have at least the desired number of breakfast recipes
        // ------------------------------------------------------------------
        if (counts.breakfast > 0 && breakfastRecipes < counts.breakfast) {
          const extraNeeded = counts.breakfast - breakfastRecipes;
          logger.debug(`[DEBUG] Need ${extraNeeded} more breakfast recipes – fetching dedicated breakfast batch`);

          try {
            // Re-use apiRecipeService directly for a broad fetch then filter
            const uid = auth().currentUser?.uid ?? null;
            const apiRecipes = await apiRecipeService.getRecipes({
              dietary: dietaryPrefs,
              food: foodPrefs,
              cooking: { ...cookingPrefs, mealTypes: ['breakfast'] },
              budget: budgetPrefs,
            }, uid);

            const extraBreakfast = apiRecipes
              .filter(r => r.tags.includes('breakfast'))
              .filter(r => !recipes.some(existing => existing.id === r.id))
              .slice(0, extraNeeded);

            logger.debug(`[DEBUG] Fetched ${extraBreakfast.length} extra breakfast recipes`);

            recipes.push(...extraBreakfast);
          } catch (extraErr) {
            logger.warn('[DEBUG] Extra breakfast fetch failed:', extraErr);
          }
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
        
        // Log a sample of processed recipes with their imageUrls
        if (processedRecipes.length > 0) {
          logger.debug('[LoadingMealPlanScreen] Sample recipes being set to context:',
            processedRecipes.slice(0, 3).map(r => ({ name: r.name, imageUrl: r.imageUrl, tags: r.tags }))
          );
        }
        
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
          <MaterialCommunityIcons name="food-fork-drink" size={60} color="#D9A15B" />
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
    backgroundColor: '#FAF6F1',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
    color: '#4E4E4E',
  },
  subtitle: {
    fontSize: 16,
    color: '#7A736A',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#B57A42',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default LoadingMealPlanScreen; 