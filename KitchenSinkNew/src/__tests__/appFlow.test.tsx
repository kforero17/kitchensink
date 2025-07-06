// @ts-nocheck

import React from 'react';

// Stub out react-native to avoid needing full native environment in Node
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: () => ({}) },
  Animated: {
    Value: function () { return { interpolate: () => '' }; },
    timing: () => ({ start: () => {} }),
    loop: () => ({ start: () => {} }),
  },
  Easing: { linear: () => {} },
}), { virtual: true });

// Stub icon library used in the component
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

import { render, waitFor } from '@testing-library/react-native';
import LoadingMealPlanScreen from '../screens/LoadingMealPlanScreen';

// Use fake timers to control setTimeouts within the component
jest.useFakeTimers();

// ---- Mock React Navigation ---- //
jest.mock('@react-navigation/native', () => {
  return {
    useNavigation: () => ({
      reset: jest.fn(),
      navigate: jest.fn(),
    }),
  };
});

// ---- Mock preference utilities ---- //
jest.mock('../utils/preferences', () => ({
  getDietaryPreferences: jest.fn().mockResolvedValue({
    vegan: false,
    vegetarian: true,
    glutenFree: false,
    dairyFree: false,
    allergies: [],
    lowCarb: false,
  }),
  getFoodPreferences: jest.fn().mockResolvedValue({
    favoriteIngredients: ['tomato'],
    dislikedIngredients: ['broccoli'],
    preferredCuisines: ['italian'],
  }),
  getCookingPreferences: jest.fn().mockResolvedValue({
    mealTypes: ['breakfast', 'lunch', 'dinner'],
    weeklyMealPrepCount: 1,
    preferredCookingDuration: 'under_30_min',
  }),
  getBudgetPreferences: jest.fn().mockResolvedValue({ amount: 50, frequency: 'weekly' }),
  getPreferenceValue: jest.fn().mockResolvedValue(false),
}));

// ---- Mock recommendation service ---- //
jest.mock('../services/recommendationMealPlanService', () => ({
  fetchRecommendedRecipes: jest.fn().mockResolvedValue([
    {
      id: '1',
      name: 'Pancakes',
      prepTime: '5 mins',
      cookTime: '10 mins',
      servings: 2,
      ingredients: [],
      instructions: [],
      tags: ['breakfast'],
      cuisines: [],
      estimatedCost: 5,
    },
    {
      id: '2',
      name: 'Salad',
      prepTime: '5 mins',
      cookTime: '0 mins',
      servings: 1,
      ingredients: [],
      instructions: [],
      tags: ['lunch'],
      cuisines: [],
      estimatedCost: 4,
    },
  ]),
}));

// ---- Mock mealPlanSelector.generateMealPlan ---- //
jest.mock('../utils/mealPlanSelector', () => ({
  generateMealPlan: jest.fn().mockResolvedValue({
    recipes: [
      {
        id: '1',
        name: 'Pancakes',
        prepTime: '5 mins',
        cookTime: '10 mins',
        servings: 2,
        ingredients: [],
        instructions: [],
        tags: ['breakfast'],
        cuisines: [],
        estimatedCost: 5,
        isWeeklyMealPlan: false,
      },
      {
        id: '2',
        name: 'Salad',
        prepTime: '5 mins',
        cookTime: '0 mins',
        servings: 1,
        ingredients: [],
        instructions: [],
        tags: ['lunch'],
        cuisines: [],
        estimatedCost: 4,
        isWeeklyMealPlan: false,
      },
    ],
    constraintsRelaxed: false,
  }),
}));

// ---- Mock MealPlanContext ---- //
const setMealPlanSpy = jest.fn();
const setIsLoadingSpy = jest.fn();

jest.mock('../contexts/MealPlanContext', () => {
  return {
    useMealPlan: () => ({
      setMealPlan: setMealPlanSpy,
      setIsLoading: setIsLoadingSpy,
    }),
  };
});

// ---- Mock logger to silence noisy output ---- //
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ============================= TEST ============================= //

describe.skip('Full preference → generation flow (requires RN env)', () => {
  it('loads preferences, fetches recipes, generates meal plan and stores it', async () => {
    render(React.createElement(LoadingMealPlanScreen, {}));

    // Fast-forward all timers (setTimeout in component)
    jest.runAllTimers();

    // Await async effects
    await waitFor(() => {
      expect(setMealPlanSpy).toHaveBeenCalledTimes(1);
      const firstCallArg = setMealPlanSpy.mock.calls[0][0];
      // Should contain two recipes from our mock with weekly flag false
      expect(firstCallArg.length).toBe(2);
      expect(firstCallArg.every((r: any) => r.isWeeklyMealPlan === false)).toBe(true);
    });

    // Verify loading flag toggled at least once
    expect(setIsLoadingSpy).toHaveBeenCalled();
  });
}); 