import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: {
    item: string;
    measurement: string;
  }[];
  instructions: string[];
  imageUrl?: string;
  tags: string[];
  estimatedCost: number;
  isWeeklyMealPlan?: boolean;
}

interface MealPlanContextType {
  mealPlan: Recipe[];
  setMealPlan: (plan: Recipe[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const MealPlanContext = createContext<MealPlanContextType | undefined>(undefined);

export const MealPlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mealPlan, setMealPlan] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <MealPlanContext.Provider value={{ mealPlan, setMealPlan, isLoading, setIsLoading }}>
      {children}
    </MealPlanContext.Provider>
  );
};

export const useMealPlan = () => {
  const context = useContext(MealPlanContext);
  if (context === undefined) {
    throw new Error('useMealPlan must be used within a MealPlanProvider');
  }
  return context;
};

export default MealPlanContext; 