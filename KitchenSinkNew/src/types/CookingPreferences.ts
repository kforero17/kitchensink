export interface CookingPreferences {
  cookingFrequency: CookingFrequency;
  preferredCookingDuration: CookingDuration;
  skillLevel: CookingSkillLevel;
  mealTypes: MealType[];
  servingSizePreference: number;
  weeklyMealPrepCount: number;
  householdSize: number;
}

export interface PreferenceOption<T> {
  value: T;
  label: string;
  description: string;
  icon?: string;
}

export type CookingFrequency = 
  | 'daily'
  | 'few_times_week'
  | 'weekends_only'
  | 'rarely';

export type CookingDuration = 
  | 'under_30_min'
  | '30_to_60_min'
  | 'over_60_min';

export type CookingSkillLevel = 
  | 'beginner'
  | 'intermediate'
  | 'advanced';

export type MealPlanningFrequency = 
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'rarely';

export type MealType = 
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snacks'
  | 'dessert';

export const COOKING_FREQUENCY_OPTIONS: PreferenceOption<CookingFrequency>[] = [
  {
    value: 'daily',
    label: 'Daily',
    description: 'I cook most of my meals every day',
    icon: 'calendar',
  },
  {
    value: 'few_times_week',
    label: 'Few times a week',
    description: 'I cook 2-4 times per week',
    icon: 'calendar-outline',
  },
  {
    value: 'weekends_only',
    label: 'Weekends only',
    description: 'I mainly cook during weekends',
    icon: 'calendar-number',
  },
  {
    value: 'rarely',
    label: 'Rarely',
    description: 'I cook occasionally',
    icon: 'calendar-clear',
  },
];

export const COOKING_DURATION_OPTIONS: PreferenceOption<CookingDuration>[] = [
  {
    value: 'under_30_min',
    label: 'Quick meals',
    description: 'Less than 30 minutes',
    icon: 'timer-outline',
  },
  {
    value: '30_to_60_min',
    label: 'Medium length',
    description: '30-60 minutes',
    icon: 'time-outline',
  },
  {
    value: 'over_60_min',
    label: 'Extended cooking',
    description: 'More than 60 minutes',
    icon: 'hourglass-outline',
  },
];

export const COOKING_SKILL_OPTIONS: PreferenceOption<CookingSkillLevel>[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'I\'m learning to cook',
    icon: 'star-outline',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'I can follow most recipes',
    icon: 'star-half',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'I\'m an experienced cook',
    icon: 'star',
  },
];

export const MEAL_PLANNING_OPTIONS: PreferenceOption<MealPlanningFrequency>[] = [
  {
    value: 'daily',
    label: 'Daily',
    description: 'I plan meals each day',
    icon: 'today',
  },
  {
    value: 'weekly',
    label: 'Weekly',
    description: 'I plan meals for the week',
    icon: 'calendar',
  },
  {
    value: 'monthly',
    label: 'Monthly',
    description: 'I plan meals for the month',
    icon: 'calendar-number',
  },
  {
    value: 'rarely',
    label: 'Rarely',
    description: 'I don\'t usually plan meals',
    icon: 'calendar-clear',
  },
];

export const MEAL_TYPE_OPTIONS: PreferenceOption<MealType>[] = [
  {
    value: 'breakfast',
    label: 'Breakfast',
    description: 'Morning meals and brunch recipes',
    icon: 'sunny-outline',
  },
  {
    value: 'lunch',
    label: 'Lunch',
    description: 'Midday meals and light dishes',
    icon: 'restaurant-outline',
  },
  {
    value: 'dinner',
    label: 'Dinner',
    description: 'Evening meals and main courses',
    icon: 'moon-outline',
  },
  {
    value: 'snacks',
    label: 'Snacks',
    description: 'Light bites and appetizers',
    icon: 'cafe-outline',
  },
  {
    value: 'dessert',
    label: 'Dessert',
    description: 'Sweet treats and baked goods',
    icon: 'ice-cream-outline',
  },
]; 