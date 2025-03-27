import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

import { HomeScreen } from '../screens/HomeScreen';
import { DietaryPreferencesScreen } from '../screens/DietaryPreferencesScreen';
import { FoodPreferencesScreen } from '../screens/FoodPreferencesScreen';
import { CookingHabitsScreen } from '../screens/CookingHabitsScreen';
import { BudgetPreferencesScreen } from '../screens/BudgetPreferencesScreen';
import LoadingMealPlanScreen from '../screens/LoadingMealPlanScreen';
import MealPlanScreen from '../screens/MealPlanScreen';
import GroceryListScreen from '../screens/GroceryListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DebugScreen from '../screens/DebugScreen';
import PantryScreen from '../screens/PantryScreen';
import TestPickerScreen from '../screens/TestPickerScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import RecipeHistoryScreen from '../screens/RecipeHistoryScreen';

export type RootStackParamList = {
  Home: undefined;
  DietaryPreferences: { fromProfile?: boolean } | undefined;
  FoodPreferences: { fromProfile?: boolean } | undefined;
  CookingHabits: { fromProfile?: boolean } | undefined;
  BudgetPreferences: { fromProfile?: boolean } | undefined;
  LoadingMealPlan: undefined;
  MealPlan: {
    selectedRecipe?: any;
    fromGenerator?: boolean;
  };
  RecipeDetail: {
    recipe: any;
  };
  GroceryList: {
    selectedRecipes: any[];
    existingListId?: string;
  };
  Profile: undefined;
  Debug: undefined;
  Pantry: { fromProfile?: boolean } | undefined;
  PantryEdit: undefined;
  TestPicker: undefined;
  RecipeHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Define the onboarding flow
const OnboardingStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
    }}
  >
    <Stack.Screen name="DietaryPreferences" component={DietaryPreferencesScreen} />
    <Stack.Screen name="FoodPreferences" component={FoodPreferencesScreen} />
    <Stack.Screen name="CookingHabits" component={CookingHabitsScreen} />
    <Stack.Screen name="BudgetPreferences" component={BudgetPreferencesScreen} />
    <Stack.Screen name="LoadingMealPlan" component={LoadingMealPlanScreen} />
    <Stack.Screen name="MealPlan" component={MealPlanScreen} />
    <Stack.Screen name="GroceryList" component={GroceryListScreen} />
  </Stack.Navigator>
);

const AppNavigator = () => {
  const { user, hasCompletedOnboarding } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        
        {/* Show all screens separately */}
        <Stack.Screen name="DietaryPreferences" component={DietaryPreferencesScreen} />
        <Stack.Screen name="FoodPreferences" component={FoodPreferencesScreen} />
        <Stack.Screen name="CookingHabits" component={CookingHabitsScreen} />
        <Stack.Screen name="BudgetPreferences" component={BudgetPreferencesScreen} />
        <Stack.Screen name="LoadingMealPlan" component={LoadingMealPlanScreen} />
        <Stack.Screen name="MealPlan" component={MealPlanScreen} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
        <Stack.Screen name="GroceryList" component={GroceryListScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Pantry" component={PantryScreen} />
        <Stack.Screen name="PantryEdit" component={PantryScreen} />
        <Stack.Screen 
          name="Debug" 
          component={DebugScreen} 
          options={{ headerShown: true, title: 'Network Debug' }}
        />
        <Stack.Screen name="TestPicker" component={TestPickerScreen} />
        <Stack.Screen name="RecipeHistory" component={RecipeHistoryScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 