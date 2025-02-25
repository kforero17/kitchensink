import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Animated, Easing, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMealPlan } from '../contexts/MealPlanContext';
import { generateMealPlan } from '../utils/mealPlanSelector';
import { 
  getDietaryPreferences, 
  getFoodPreferences,
  getCookingPreferences,
  getBudgetPreferences
} from '../utils/preferences';
import { recipeDatabase } from '../data/recipeDatabase';
import logger from '../utils/logger';

type LoadingMealPlanScreenProps = NativeStackNavigationProp<RootStackParamList, 'LoadingMealPlan'>;

const LoadingMealPlanScreen: React.FC = () => {
  const navigation = useNavigation<LoadingMealPlanScreenProps>();
  const { setMealPlan, setIsLoading } = useMealPlan();
  const [error, setError] = useState<string | null>(null);
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
        
        // Load all user preferences
        const dietaryPrefs = await getDietaryPreferences();
        const foodPrefs = await getFoodPreferences();
        const cookingPrefs = await getCookingPreferences();
        const budgetPrefs = await getBudgetPreferences();
        
        if (!dietaryPrefs || !foodPrefs || !cookingPrefs || !budgetPrefs) {
          throw new Error('Failed to load user preferences');
        }
        
        // Set up meal counts (could be adjusted based on preferences)
        const mealCounts = {
          breakfast: 2,
          lunch: 2,
          dinner: 2,
          snacks: 1
        };
        
        // Log for debugging
        logger.debug('Generating meal plan with preferences:', {
          dietary: dietaryPrefs,
          food: foodPrefs,
          cooking: cookingPrefs,
          budget: budgetPrefs,
          mealCounts
        });
        
        // Generate the meal plan
        const result = await generateMealPlan(
          recipeDatabase,
          {
            dietary: dietaryPrefs,
            food: foodPrefs,
            cooking: cookingPrefs,
            budget: budgetPrefs
          },
          mealCounts
        );
        
        // Save the meal plan to context
        setMealPlan(result.recipes);
        
        // If constraints were relaxed, we could show a message
        if (result.constraintsRelaxed && result.message) {
          logger.debug('Constraints relaxed:', result.message);
        }
        
        // Navigate to meal plan screen after a delay
        setTimeout(() => {
          setIsLoading(false);
          navigation.replace('MealPlan');
        }, 1500);
        
      } catch (error) {
        logger.error('Failed to generate meal plan:', error);
        setError('Failed to generate your meal plan. Please try again.');
        
        // Navigate back to home after a delay
        setTimeout(() => {
          setIsLoading(false);
          navigation.navigate('Home');
          Alert.alert(
            'Error',
            'Failed to generate your meal plan. Please try again.',
            [{ text: 'OK' }]
          );
        }, 1500);
      }
    };
    
    generatePlan();
  }, [navigation, setMealPlan, setIsLoading]);

  // Interpolate the spin value to rotate from 0 to 360 degrees
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Create an array of utensils with their angles
  const utensils = [
    { icon: 'silverware-fork', angle: '0deg' },
    { icon: 'silverware-spoon', angle: '120deg' },
    { icon: 'silverware-variant', angle: '240deg' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.spinningContainer, { transform: [{ rotate: spin }] }]}>
          {utensils.map((utensil, index) => (
            <Animated.View
              key={index}
              style={[
                styles.utensilContainer,
                {
                  transform: [
                    { rotate: utensil.angle },
                    { translateX: 50 }, // Radius of the circle
                  ],
                },
              ]}
            >
              <Icon
                name={utensil.icon}
                size={30}
                color="#007bff"
                style={{ transform: [{ rotate: `-${utensil.angle}` }] }}
              />
            </Animated.View>
          ))}
        </Animated.View>
        <Text style={styles.loadingText}>
          {error ? 'Something went wrong...' : 'Generating your meal plan...'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  spinningContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  utensilContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 40,
    fontSize: 18,
    color: '#007bff',
    fontWeight: '600',
  },
});

export default LoadingMealPlanScreen; 