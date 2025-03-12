/**
 * Utility functions for standardizing recipe measurements into real-world purchasing quantities
 */

// Common purchase sizes for different types of ingredients
export const STANDARD_PACKAGE_SIZES: Record<string, string[]> = {
  // Baking & Dry Goods
  'flour': ['5 lb bag', '2 lb bag'],
  'sugar': ['4 lb bag', '2 lb bag'],
  'brown sugar': ['1 lb box', '2 lb box'],
  'powdered sugar': ['1 lb box', '2 lb box'],
  'baking powder': ['8 oz can'],
  'baking soda': ['1 lb box'],
  'cocoa powder': ['8 oz container'],
  'chocolate chips': ['12 oz bag'],
  'oats': ['18 oz container', '42 oz container'],
  'breadcrumbs': ['15 oz container'],
  'cornstarch': ['16 oz box'],

  // Dairy & Refrigerated
  'milk': ['half gallon', 'gallon'],
  'heavy cream': ['1 pint carton'],
  'half and half': ['1 pint carton'],
  'buttermilk': ['1 quart carton'],
  'sour cream': ['16 oz container'],
  'yogurt': ['32 oz container', '6 oz container'],
  'cream cheese': ['8 oz package'],
  'butter': ['1 lb package (4 sticks)'],
  'eggs': ['dozen', 'half dozen'],
  'cheese': ['8 oz block', '16 oz block'],
  'shredded cheese': ['8 oz bag'],

  // Oils & Vinegars
  'olive oil': ['16 oz bottle', '32 oz bottle'],
  'vegetable oil': ['48 oz bottle'],
  'canola oil': ['48 oz bottle'],
  'vinegar': ['16 oz bottle'],
  'apple cider vinegar': ['16 oz bottle'],
  'balsamic vinegar': ['16 oz bottle'],

  // Condiments & Sauces
  'ketchup': ['20 oz bottle'],
  'mustard': ['8 oz bottle'],
  'mayonnaise': ['30 oz jar'],
  'soy sauce': ['15 oz bottle'],
  'hot sauce': ['5 oz bottle'],
  'salsa': ['16 oz jar'],
  'bbq sauce': ['18 oz bottle'],
  'pasta sauce': ['24 oz jar'],

  // Canned Goods
  'tomato sauce': ['15 oz can', '8 oz can'],
  'tomato paste': ['6 oz can'],
  'diced tomatoes': ['14.5 oz can'],
  'chicken broth': ['32 oz carton', '14.5 oz can'],
  'beef broth': ['32 oz carton', '14.5 oz can'],
  'vegetable broth': ['32 oz carton', '14.5 oz can'],
  'beans': ['15 oz can'],
  'tuna': ['5 oz can'],

  // Spices & Herbs
  'salt': ['26 oz container'],
  'pepper': ['4 oz container'],
  'cinnamon': ['2.5 oz container'],
  'oregano': ['0.75 oz container'],
  'basil': ['0.75 oz container'],
  'thyme': ['0.75 oz container'],
  'rosemary': ['0.75 oz container'],
  'cumin': ['2 oz container'],
  'chili powder': ['2.5 oz container'],
  'paprika': ['2.5 oz container'],
  'garlic powder': ['3 oz container'],
  'onion powder': ['2.5 oz container'],

  // Produce
  'onion': ['1 onion', '3 lb bag'],
  'garlic': ['1 head', '3 pack'],
  'potato': ['5 lb bag', '1 potato'],
  'carrot': ['1 lb bag', '2 lb bag'],
  'celery': ['1 bunch'],
  'lettuce': ['1 head'],
  'tomato': ['1 tomato', '4 pack'],
  'lemon': ['1 lemon', '4 pack'],
  'lime': ['1 lime', '4 pack'],
  'apple': ['1 apple', '3 lb bag'],
  'banana': ['1 banana', 'bunch'],
  'avocado': ['1 avocado'],

  // Meat & Seafood
  'chicken breast': ['1 lb package', '3 lb package'],
  'chicken thighs': ['1 lb package'],
  'ground beef': ['1 lb package'],
  'steak': ['1 lb steak'],
  'pork chops': ['1 lb package'],
  'bacon': ['1 lb package'],
  'sausage': ['1 lb package'],
  'salmon': ['1 lb fillet'],
  'shrimp': ['1 lb bag'],

  // Grains & Pasta
  'rice': ['2 lb bag', '5 lb bag'],
  'pasta': ['16 oz box'],
  'bread': ['1 loaf'],
  'tortillas': ['10 count package'],
};

// Default purchase size for ingredients not in our dictionary
const DEFAULT_PACKAGE_SIZE = 'standard package';

// Units that typically indicate small quantities that can be consolidated
const SMALL_QUANTITY_UNITS = ['teaspoon', 'tsp', 'tablespoon', 'tbsp', 'pinch', 'dash'];

// Measurement variations to normalize
const MEASUREMENT_VARIATIONS: Record<string, string[]> = {
  'cup': ['cups', 'c.', 'c'],
  'tablespoon': ['tablespoons', 'tbsp', 'tbsp.', 'tbs', 'tbs.', 'T'],
  'teaspoon': ['teaspoons', 'tsp', 'tsp.', 't'],
  'pound': ['pounds', 'lb', 'lb.', 'lbs', 'lbs.'],
  'ounce': ['ounces', 'oz', 'oz.'],
  'gram': ['grams', 'g', 'g.'],
  'kilogram': ['kilograms', 'kg', 'kg.'],
  'milliliter': ['milliliters', 'ml', 'ml.'],
  'liter': ['liters', 'l', 'l.'],
};

/**
 * Normalizes an ingredient name to match our standard dictionary
 * @param ingredient The ingredient name to normalize
 * @returns The normalized ingredient name
 */
export function normalizeIngredientName(ingredient: string): string {
  const lowercased = ingredient.toLowerCase().trim();
  
  // Remove any measurement info that might be in the name
  const wordList = lowercased.split(' ');
  const filteredWords = wordList.filter(word => {
    // Remove numbers, fractions and common measurement words
    return !word.match(/^\d+([./]\d+)?$/) && 
           !['cup', 'cups', 'tbsp', 'tsp', 'teaspoon', 'tablespoon', 'ounce', 'oz', 'pound', 'lb'].includes(word);
  });
  
  const cleaned = filteredWords.join(' ').trim();
  
  // Handle common variations
  if (cleaned.includes('chicken breast')) return 'chicken breast';
  if (cleaned.includes('ground beef')) return 'ground beef';
  if (cleaned.includes('olive oil')) return 'olive oil';
  if (cleaned.includes('vegetable oil')) return 'vegetable oil';
  
  // For items with adjectives like "fresh", "chopped", etc., try to match the core ingredient
  for (const [key] of Object.entries(STANDARD_PACKAGE_SIZES)) {
    if (cleaned.includes(key)) {
      return key;
    }
  }
  
  return cleaned;
}

/**
 * Check if a measurement is a small quantity
 * @param measurement The measurement string to check
 * @returns True if the measurement represents a small quantity
 */
export function isSmallQuantity(measurement: string): boolean {
  const lowercased = measurement.toLowerCase();
  
  // Check if any small quantity indicators are present
  for (const unit of SMALL_QUANTITY_UNITS) {
    if (lowercased.includes(unit)) {
      // Extract any numeric value if present
      const match = lowercased.match(/(\d+([./]\d+)?)/);
      if (match) {
        const value = parseFloat(eval(match[1])); // safely evaluate fractions
        // Consider it small if less than 4 tablespoons or equivalent
        return value <= 4;
      }
      return true;
    }
  }
  
  return false;
}

/**
 * Determine the standard package size for an ingredient
 * @param ingredient The normalized ingredient name
 * @param measurement The measurement from the recipe
 * @returns The recommended package size
 */
export function getStandardPackageSize(ingredient: string, measurement: string): string {
  const normalizedIngredient = normalizeIngredientName(ingredient);
  
  // Find the standard package sizes for this ingredient
  const packageSizes = STANDARD_PACKAGE_SIZES[normalizedIngredient];
  
  if (!packageSizes) {
    // If we don't have a specific package size, return a generic recommendation
    return DEFAULT_PACKAGE_SIZE;
  }
  
  // For small measurements, always recommend the smallest package
  if (isSmallQuantity(measurement)) {
    return packageSizes[packageSizes.length - 1]; // Smallest package is usually listed last
  }
  
  // Default to the first (typically standard) package size
  return packageSizes[0];
}

/**
 * Converts raw ingredient data into a standardized grocery list item
 * @param ingredient The ingredient name
 * @param measurement The original recipe measurement
 * @returns An object with standardized shopping information
 */
export function standardizeGroceryItem(ingredient: string, measurement: string): {
  ingredient: string;
  originalMeasurement: string;
  recommendedPackage: string;
} {
  const normalizedName = normalizeIngredientName(ingredient);
  const packageSize = getStandardPackageSize(normalizedName, measurement);
  
  return {
    ingredient: normalizedName,
    originalMeasurement: measurement,
    recommendedPackage: packageSize
  };
} 