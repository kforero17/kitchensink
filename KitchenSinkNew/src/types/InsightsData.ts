export interface WeeklyWasteData {
  weekLabel: string; // e.g. "Mar 3"
  amountSaved: number; // dollar estimate
}

export interface WeeklySpendData {
  weekLabel: string;
  estimatedSpend: number;
}

export interface NutritionSummary {
  totalCalories: number;
  avgCaloriesPerDay: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
}

export interface StreakData {
  currentStreak: number; // consecutive weeks
  longestStreak: number;
}

export interface WeeklyInsightsData {
  wasteAvoided: {
    thisWeekSaved: number;
    lastWeekSaved: number;
    weeklyTrend: WeeklyWasteData[]; // last 8 weeks
  };
  spendingTrends: {
    thisWeekSpend: number;
    averageWeeklySpend: number;
    weeklyTrend: WeeklySpendData[]; // last 8 weeks
  };
  nutrition: NutritionSummary | null; // null if no recipes cooked
  streak: StreakData;
  recipesThisWeek: number;
}
