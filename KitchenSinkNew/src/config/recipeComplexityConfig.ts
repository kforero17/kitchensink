/**
 * Configuration for scoring recipe complexity
 */

export interface ComplexityConfig {
  stepCountWeight: number;
  ingredientCountWeight: number;
  specialEquipmentWeight: number;
  advancedTechniquesWeight: number;
}

export const DEFAULT_COMPLEXITY_CONFIG: ComplexityConfig = {
  stepCountWeight: 25,       // Weight for number of instruction steps
  ingredientCountWeight: 25, // Weight for number of ingredients
  specialEquipmentWeight: 25, // Weight for special equipment requirements
  advancedTechniquesWeight: 25 // Weight for advanced cooking techniques
};

// Special equipment that might increase recipe complexity
export const SPECIAL_EQUIPMENT = [
  'blender',
  'food processor',
  'stand mixer',
  'pressure cooker',
  'slow cooker',
  'sous vide',
  'mandoline',
  'thermometer',
  'dutch oven',
  'cast iron',
  'grill',
  'smoker'
];

// Advanced techniques that might increase recipe complexity
export const ADVANCED_TECHNIQUES = [
  'brine',
  'sous vide',
  'deglaze',
  'blanch',
  'temper',
  'reduce',
  'clarify',
  'render',
  'marinate',
  'ferment',
  'cure',
  'smoke',
  'caramelize',
  'fold',
  'knead',
  'proof',
  'flambe',
  'emulsify'
];

/**
 * Calculates complexity score based on step count
 * More steps = more complex
 */
export function calculateStepComplexity(
  stepCount: number,
  config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG
): number {
  const BASELINE_STEPS = 5; // Consider 5 steps as baseline
  const MAX_STEPS = 20; // Cap at 20 steps for scoring
  
  if (stepCount <= BASELINE_STEPS) return 0;
  
  const normalizedSteps = Math.min(stepCount, MAX_STEPS) - BASELINE_STEPS;
  return (normalizedSteps / (MAX_STEPS - BASELINE_STEPS)) * 100 * (config.stepCountWeight / 100);
}

/**
 * Calculates complexity score based on ingredient count
 * More ingredients = more complex
 */
export function calculateIngredientComplexity(
  ingredientCount: number,
  config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG
): number {
  const BASELINE_INGREDIENTS = 5; // Consider 5 ingredients as baseline
  const MAX_INGREDIENTS = 15; // Cap at 15 ingredients for scoring
  
  if (ingredientCount <= BASELINE_INGREDIENTS) return 0;
  
  const normalizedIngredients = Math.min(ingredientCount, MAX_INGREDIENTS) - BASELINE_INGREDIENTS;
  return (normalizedIngredients / (MAX_INGREDIENTS - BASELINE_INGREDIENTS)) * 100 * (config.ingredientCountWeight / 100);
}

/**
 * Detects special equipment required by a recipe
 */
export function detectSpecialEquipment(instructions: string[]): string[] {
  const instructionText = instructions.join(' ').toLowerCase();
  return SPECIAL_EQUIPMENT.filter(equipment => 
    instructionText.includes(equipment.toLowerCase())
  );
}

/**
 * Detects advanced techniques used in a recipe
 */
export function detectAdvancedTechniques(instructions: string[]): string[] {
  const instructionText = instructions.join(' ').toLowerCase();
  return ADVANCED_TECHNIQUES.filter(technique => 
    instructionText.includes(technique.toLowerCase())
  );
}

/**
 * Calculates a recipe's complexity score
 * Returns a value from 0 (simple) to 100 (complex)
 */
export function calculateRecipeComplexity(
  steps: string[],
  ingredients: { item: string; measurement: string }[],
  config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG
): {
  score: number;
  specialEquipment: string[];
  advancedTechniques: string[];
} {
  const stepComplexity = calculateStepComplexity(steps.length, config);
  const ingredientComplexity = calculateIngredientComplexity(ingredients.length, config);
  
  const specialEquipment = detectSpecialEquipment(steps);
  const specialEquipmentScore = specialEquipment.length > 0 ? 
    (specialEquipment.length / 3) * 100 * (config.specialEquipmentWeight / 100) : 0;
  
  const advancedTechniques = detectAdvancedTechniques(steps);
  const advancedTechniquesScore = advancedTechniques.length > 0 ?
    (advancedTechniques.length / 3) * 100 * (config.advancedTechniquesWeight / 100) : 0;
  
  // Sum all components and cap at 100
  const totalScore = Math.min(100, 
    stepComplexity + 
    ingredientComplexity + 
    specialEquipmentScore + 
    advancedTechniquesScore
  );
  
  return {
    score: Math.round(totalScore),
    specialEquipment,
    advancedTechniques
  };
} 