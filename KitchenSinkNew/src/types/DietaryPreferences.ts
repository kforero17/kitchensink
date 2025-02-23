export interface DietaryPreferences {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  nutFree: boolean;
  lowCarb: boolean;
  allergies: string[];
  restrictions: string[];
}

export interface DietaryPreferencesState extends DietaryPreferences {
  isLoading: boolean;
  error: string | null;
} 