export interface BudgetPreferences {
  amount: number;
  frequency: BudgetFrequency;
}

export type BudgetFrequency = 
  | 'daily'
  | 'weekly'
  | 'monthly';

export interface PreferenceOption<T> {
  value: T;
  label: string;
  description: string;
  icon?: string;
}

export const BUDGET_FREQUENCY_OPTIONS: PreferenceOption<BudgetFrequency>[] = [
  {
    value: 'daily',
    label: 'Daily',
    description: 'Set a daily budget for meals',
    icon: 'today',
  },
  {
    value: 'weekly',
    label: 'Weekly',
    description: 'Plan your meal budget by week',
    icon: 'calendar',
  },
  {
    value: 'monthly',
    label: 'Monthly',
    description: 'Manage your meal budget monthly',
    icon: 'calendar-number',
  },
]; 