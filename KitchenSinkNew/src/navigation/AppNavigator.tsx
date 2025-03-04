import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { DietaryPreferencesScreen } from '../screens/DietaryPreferencesScreen';
import { FoodPreferencesScreen } from '../screens/FoodPreferencesScreen';
import { CookingHabitsScreen } from '../screens/CookingHabitsScreen';
import { BudgetPreferencesScreen } from '../screens/BudgetPreferencesScreen';
import LoadingMealPlanScreen from '../screens/LoadingMealPlanScreen';
import MealPlanScreen from '../screens/MealPlanScreen';
import DebugScreen from '../screens/DebugScreen';

export type RootStackParamList = {
  Home: undefined;
  DietaryPreferences: undefined;
  FoodPreferences: undefined;
  CookingHabits: undefined;
  BudgetPreferences: undefined;
  LoadingMealPlan: undefined;
  MealPlan: undefined;
  Debug: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="DietaryPreferences" component={DietaryPreferencesScreen} />
        <Stack.Screen name="FoodPreferences" component={FoodPreferencesScreen} />
        <Stack.Screen name="CookingHabits" component={CookingHabitsScreen} />
        <Stack.Screen name="BudgetPreferences" component={BudgetPreferencesScreen} />
        <Stack.Screen name="LoadingMealPlan" component={LoadingMealPlanScreen} />
        <Stack.Screen name="MealPlan" component={MealPlanScreen} />
        <Stack.Screen 
          name="Debug" 
          component={DebugScreen} 
          options={{ headerShown: true, title: 'Network Debug' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 