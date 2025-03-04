declare module '@env' {
  export const SPOONACULAR_API_KEY: string;
  export const SPOONACULAR_BASE_URL: string;
  export const SPOONACULAR_INGREDIENTS_ENDPOINT: string;
  export const SPOONACULAR_RECIPES_ENDPOINT: string;
}

// Add global type for __DEV__
declare const __DEV__: boolean; 