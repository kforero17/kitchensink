import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, Alert, Animated, PanResponder, Dimensions, Share, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Recipe } from '../types/Recipe';
import { standardizeGroceryItem } from '../utils/groceryStandardization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';
import AuthPrompt from '../components/AuthPrompt';
import { groceryListService } from '../services/groceryListService';
import { firestoreService } from '../services/firebaseService';
import { pantryService } from '../services/pantryService';

type GroceryListScreenRouteProp = RouteProp<RootStackParamList, 'GroceryList'>;
type GroceryListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'GroceryList'>;

interface Ingredient {
  name: string;
  measurement: string;
  category: string;
  recipeId: string;
  recipeName: string;
  recommendedPackage: string;
  parsedMeasurements?: Record<string, {
    quantity: number;
    unit: string;
    original: string[];
  }>;
  unparsedMeasurements?: string[];
}

// Define ingredient categories
const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  'Meat & Seafood': ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'bacon', 'sausage', 'steak'],
  'Produce': ['apple', 'banana', 'orange', 'lemon', 'lime', 'avocado', 'tomato', 'potato', 'onion', 'garlic', 'lettuce', 'spinach', 'kale', 'carrot', 'broccoli', 'pepper', 'cucumber', 'zucchini', 'mushroom', 'berry', 'strawberry', 'blueberry', 'grape', 'melon'],
  'Dairy & Eggs': ['milk', 'cream', 'cheese', 'butter', 'yogurt', 'egg', 'sour cream', 'cream cheese', 'feta'],
  'Grains & Bakery': ['bread', 'rice', 'pasta', 'flour', 'oats', 'cereal', 'tortilla', 'noodle', 'bagel', 'roll', 'bun', 'cracker', 'quinoa', 'couscous'],
  'Pantry': ['oil', 'vinegar', 'salt', 'pepper', 'sugar', 'spice', 'herb', 'sauce', 'broth', 'stock', 'bean', 'lentil', 'nut', 'seed', 'canned', 'condiment', 'syrup'],
  'Frozen': ['frozen', 'ice cream'],
  'Beverages': ['water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine', 'alcohol', 'drink'],
  'Snacks & Sweets': ['chocolate', 'candy', 'cookie', 'cracker', 'chip', 'snack', 'dessert', 'cake', 'pie', 'honey'],
};

// Measurement units for consolidation
const UNIT_GROUPS: Record<string, string[]> = {
  'volume': ['cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'fluid ounce', 'fluid ounces', 'fl oz', 'pint', 'pints', 'quart', 'quarts', 'gallon', 'gallons', 'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters'],
  'weight': ['pound', 'pounds', 'lb', 'lbs', 'ounce', 'ounces', 'oz', 'gram', 'grams', 'g', 'kg', 'kilogram', 'kilograms'],
  'count': ['', 'piece', 'pieces', 'whole', 'slice', 'slices', 'count', 'counts']
};

// Unit conversion factors within the same group (to standardize a base unit)
const UNIT_CONVERSIONS: Record<string, number> = {
  // Volume conversions (to cups)
  'tablespoon': 1/16,
  'tablespoons': 1/16,
  'tbsp': 1/16,
  'teaspoon': 1/48,
  'teaspoons': 1/48,
  'tsp': 1/48,
  'fluid ounce': 1/8,
  'fluid ounces': 1/8,
  'fl oz': 1/8,
  'pint': 2,
  'pints': 2,
  'quart': 4,
  'quarts': 4,
  'gallon': 16,
  'gallons': 16,
  'cup': 1,
  'cups': 1,
  // Weight conversions (to ounces)
  'pound': 16,
  'pounds': 16,
  'lb': 16,
  'lbs': 16,
  'ounce': 1,
  'ounces': 1,
  'oz': 1,
  'gram': 0.035274,
  'grams': 0.035274,
  'g': 0.035274,
  'kg': 35.274,
  'kilogram': 35.274,
  'kilograms': 35.274
};

// Default units for each measurement group
const DEFAULT_UNITS: Record<string, string> = {
  'volume': 'cups',
  'weight': 'ounces',
  'count': ''
};

// Display units - for nicer formatting
const DISPLAY_UNITS: Record<string, (qty: number) => { qty: number, unit: string }> = {
  'cups': (qty: number) => {
    if (qty >= 4) {
      return { qty: qty / 4, unit: 'quarts' };
    } else if (qty >= 1) {
      return { qty, unit: 'cups' };
    } else if (qty >= 1/4) {
      return { qty, unit: 'cups' };
    } else if (qty >= 1/16) {
      return { qty: qty * 16, unit: 'tablespoons' };
    } else {
      return { qty: qty * 48, unit: 'teaspoons' };
    }
  },
  'ounces': (qty: number) => {
    if (qty >= 16) {
      return { qty: qty / 16, unit: 'pounds' };
    } else {
      return { qty, unit: 'ounces' };
    }
  },
  '': (qty: number) => ({ qty, unit: qty === 1 ? '' : '' })
};

/**
 * Parse a measurement string to extract quantity and unit
 * @param measurement The measurement string from the recipe
 * @returns An object with quantity, unit, and measurement group
 */
const parseMeasurement = (measurement: string): { 
  quantity: number; 
  unit: string; 
  group: string | null; 
  originalMeasurement: string;
} => {
  const originalMeasurement = measurement;
  const lowerMeasurement = measurement.toLowerCase().trim();
  
  // Extract numeric part (quantity)
  const quantityMatch = lowerMeasurement.match(/^([\d./\s-]+)/);
  let quantity = 1;
  let remainingText = lowerMeasurement;
  
  if (quantityMatch && quantityMatch[1]) {
    // Process the quantity string
    const quantityStr = quantityMatch[1].trim();
    
    // Handle ranges like "1-2" (take the average)
    if (quantityStr.includes('-')) {
      const [min, max] = quantityStr.split('-').map(part => {
        // Handle fractions in the range parts
        if (part.includes('/')) {
          const [num, denom] = part.trim().split('/').map(Number);
          return num / denom;
        }
        return parseFloat(part.trim());
      });
      quantity = (min + max) / 2;
    }
    // Handle fractions like "1/2"
    else if (quantityStr.includes('/')) {
      const parts = quantityStr.split(' ');
      // Handle mixed numbers like "1 1/2"
      if (parts.length > 1 && !isNaN(parseFloat(parts[0]))) {
        const wholeNumber = parseFloat(parts[0]);
        const fractionPart = parts[1];
        const [numerator, denominator] = fractionPart.split('/').map(Number);
        quantity = wholeNumber + (numerator / denominator);
      } else {
        const [numerator, denominator] = quantityStr.split('/').map(Number);
        quantity = numerator / denominator;
      }
    } 
    // Handle simple numbers
    else {
      quantity = parseFloat(quantityStr) || 1;
    }
    
    // Remove the quantity part from the measurement
    remainingText = lowerMeasurement.substring(quantityMatch[0].length).trim();
  }
  
  // Find the unit
  let unit = '';
  let group: string | null = null;
  
  // Check for each known unit
  unitLoop: for (const [groupName, units] of Object.entries(UNIT_GROUPS)) {
    for (const knownUnit of units) {
      // If knownUnit is empty string, it's for unitless measurements like "2 eggs"
      if (knownUnit === '' && remainingText === '') {
        unit = '';
        group = groupName;
        break unitLoop;
      }
      // For actual units, check if the remaining text starts with them
      if (knownUnit !== '' && 
          (remainingText === knownUnit || 
           remainingText.startsWith(knownUnit + ' ') || 
           remainingText.startsWith(knownUnit + '.'))) {
        unit = knownUnit;
        group = groupName;
        break unitLoop;
      }
    }
  }
  
  return { quantity, unit, group, originalMeasurement };
};

/**
 * Convert quantity to a standard unit within its group for consolidation
 * @param quantity The quantity value
 * @param unit The unit string
 * @param group The measurement group (volume, weight, count)
 * @returns The quantity in the standard unit for the group
 */
const standardizeQuantity = (
  quantity: number, 
  unit: string, 
  group: string | null
): { standardizedQty: number; standardUnit: string } => {
  if (!group) {
    return { standardizedQty: quantity, standardUnit: unit };
  }
  
  const standardUnit = DEFAULT_UNITS[group];
  
  // If already in standard unit or no unit (count), return as is
  if (unit === standardUnit || unit === '') {
    return { standardizedQty: quantity, standardUnit };
  }
  
  // Convert to standard unit using conversion factors
  const conversionFactor = UNIT_CONVERSIONS[unit] || 1;
  return { standardizedQty: quantity * conversionFactor, standardUnit };
};

/**
 * Format a standardized quantity back to a user-friendly display format
 * @param quantity The standardized quantity
 * @param standardUnit The standard unit
 * @returns A formatted measurement string
 */
const formatMeasurement = (quantity: number, standardUnit: string): string => {
  // Get display converter for this unit
  const displayConverter = DISPLAY_UNITS[standardUnit] || (qty => ({ qty, unit: standardUnit }));
  const { qty, unit } = displayConverter(quantity);
  
  // Format the quantity
  let formattedQty: string;
  
  // Convert to fraction for common values if less than 10
  if (qty < 10) {
    // Round to nearest 1/8th for cups and common measurements
    const roundedQty = Math.round(qty * 8) / 8;
    
    // Whole numbers
    if (roundedQty === Math.floor(roundedQty)) {
      formattedQty = roundedQty.toString();
    } 
    // Common fractions
    else if (roundedQty === 0.25) {
      formattedQty = '1/4';
    } 
    else if (roundedQty === 0.5) {
      formattedQty = '1/2';
    } 
    else if (roundedQty === 0.75) {
      formattedQty = '3/4';
    } 
    else if (roundedQty === 0.125) {
      formattedQty = '1/8';
    } 
    else if (roundedQty === 0.375) {
      formattedQty = '3/8';
    } 
    else if (roundedQty === 0.625) {
      formattedQty = '5/8';
    } 
    else if (roundedQty === 0.875) {
      formattedQty = '7/8';
    } 
    // Mixed numbers
    else {
      const wholePart = Math.floor(roundedQty);
      const fractionPart = roundedQty - wholePart;
      
      let fractionStr = '';
      if (Math.abs(fractionPart - 0.25) < 0.01) {
        fractionStr = '1/4';
      } else if (Math.abs(fractionPart - 0.5) < 0.01) {
        fractionStr = '1/2';
      } else if (Math.abs(fractionPart - 0.75) < 0.01) {
        fractionStr = '3/4';
      } else if (Math.abs(fractionPart - 0.125) < 0.01) {
        fractionStr = '1/8';
      } else if (Math.abs(fractionPart - 0.375) < 0.01) {
        fractionStr = '3/8';
      } else if (Math.abs(fractionPart - 0.625) < 0.01) {
        fractionStr = '5/8';
      } else if (Math.abs(fractionPart - 0.875) < 0.01) {
        fractionStr = '7/8';
      } else {
        // If not a common fraction, just use decimal
        return `${qty.toFixed(2)} ${unit}`.trim();
      }
      
      formattedQty = `${wholePart} ${fractionStr}`;
    }
  } else {
    // For larger numbers, round to 1 decimal place
    formattedQty = qty.toFixed(1).replace(/\.0$/, '');
  }
  
  return `${formattedQty} ${unit}`.trim();
};

// Assign a category to an ingredient
const categorizeIngredient = (ingredient: string): string => {
  const lowerIngredient = ingredient.toLowerCase();
  
  for (const [category, items] of Object.entries(INGREDIENT_CATEGORIES)) {
    for (const item of items) {
      if (lowerIngredient.includes(item)) {
        return category;
      }
    }
  }
  
  return 'Other';
};

// Parse measurement to get quantity
const parseQuantity = (measurement: string): number => {
  // Extract the first number from the measurement string
  const match = measurement.match(/^([\d./]+)/);
  if (!match) return 1;
  
  const quantityStr = match[1];
  
  // Handle fractions like 1/2
  if (quantityStr.includes('/')) {
    const [numerator, denominator] = quantityStr.split('/').map(Number);
    return numerator / denominator;
  }
  
  return Number(quantityStr) || 1;
};

const GroceryListScreen: React.FC = () => {
  const navigation = useNavigation<GroceryListScreenNavigationProp>();
  const route = useRoute<GroceryListScreenRouteProp>();
  const { selectedRecipes = [], existingListId } = route.params || {};
  const { user, hasCompletedOnboarding, setHasCompletedOnboarding } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categorizedIngredients, setCategorizedIngredients] = useState<Record<string, Ingredient[]>>({});
  const [removedIngredients, setRemovedIngredients] = useState<Set<string>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [savedLists, setSavedLists] = useState<any[]>([]);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [listName, setListName] = useState('My Grocery List');
  
  // New state for selected items and tracking if we're from profile
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const isFromProfile = route.params?.existingListId !== undefined;

  // Load existing grocery list if existingListId is provided
  useEffect(() => {
    const loadExistingList = async () => {
      if (existingListId && user) {
        setLoading(true);
        try {
          // Get grocery list by ID
          const groceryList = await groceryListService.getGroceryList(existingListId);
          
          if (groceryList) {
            setListName(groceryList.name);
            
            // Group items by category
            const groupedItems: Record<string, Ingredient[]> = {};
            
            groceryList.items.forEach(item => {
              const category = item.category || 'Other';
              if (!groupedItems[category]) {
                groupedItems[category] = [];
              }
              
              groupedItems[category].push({
                name: item.name,
                measurement: item.measurement,
                category: item.category,
                recipeId: item.recipeId || '',
                recipeName: item.recipeName || '',
                recommendedPackage: item.recommendedPackage || ''
              });
              
              // Mark items as removed if they are checked
              if (item.isChecked) {
                setRemovedIngredients(prev => {
                  const newSet = new Set(prev);
                  newSet.add(item.name.toLowerCase());
                  return newSet;
                });
              }
            });
            
            setCategorizedIngredients(groupedItems);
          }
        } catch (error) {
          console.error('Error loading grocery list:', error);
          Alert.alert('Error', 'Failed to load grocery list. Please try again.');
        } finally {
          setLoading(false);
        }
      }
    };
    
    if (existingListId) {
      loadExistingList();
    }
  }, [existingListId, user]);

  // Process recipes to extract and categorize ingredients
  useEffect(() => {
    const loadData = async () => {
      try {
        // Only process recipes if we're not loading an existing list
        if (existingListId || !selectedRecipes || selectedRecipes.length === 0) {
          if (!existingListId) {
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        
        // Initialize with empty objects/arrays to prevent undefined errors
        setIngredients([]);
        setCategorizedIngredients({});
        
        // Extract and process ingredients
        const allIngredients: Ingredient[] = [];
        
        selectedRecipes.forEach((recipe: Recipe) => {
          if (recipe && recipe.ingredients) {
            recipe.ingredients.forEach((ing: {item: string; measurement: string}) => {
              // Standardize the ingredient for shopping
              const standardized = standardizeGroceryItem(ing.item, ing.measurement);
              
              // Add to ingredients list
              allIngredients.push({
                name: ing.item,
                measurement: ing.measurement,
                category: categorizeIngredient(ing.item),
                recipeId: recipe.id,
                recipeName: recipe.name,
                recommendedPackage: standardized.recommendedPackage
              });
            });
          }
        });
        
        setIngredients(allIngredients);
        
        // Group by category
        const grouped: Record<string, Ingredient[]> = {};
        
        // Process ingredients and build categories safely
        allIngredients.forEach(ing => {
          const category = ing.category || 'Other';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(ing);
        });
        
        // Consolidate duplicate ingredients
        Object.keys(grouped).forEach(category => {
          const consolidated: Record<string, Ingredient & {
            parsedMeasurements?: Record<string, {
              quantity: number;
              unit: string;
              original: string[];
            }>;
            unparsedMeasurements?: string[];
          }> = {};
          
          grouped[category].forEach(ing => {
            const key = ing.name.toLowerCase();
            
            if (!consolidated[key]) {
              consolidated[key] = {...ing};
              // Initialize with empty measurement data map for smart consolidation
              consolidated[key].parsedMeasurements = {};
              // Parse the initial measurement
              const parsedMeasurement = parseMeasurement(ing.measurement);
              
              if (parsedMeasurement.group) {
                // Convert to standard unit for the measurement group
                const { standardizedQty, standardUnit } = standardizeQuantity(
                  parsedMeasurement.quantity,
                  parsedMeasurement.unit,
                  parsedMeasurement.group
                );
                
                // Store for consolidation with same unit group
                if (!consolidated[key].parsedMeasurements[parsedMeasurement.group]) {
                  consolidated[key].parsedMeasurements[parsedMeasurement.group] = {
                    quantity: standardizedQty,
                    unit: standardUnit,
                    original: [parsedMeasurement.originalMeasurement]
                  };
                } else {
                  const existingData = consolidated[key].parsedMeasurements[parsedMeasurement.group];
                  existingData.quantity += standardizedQty;
                  existingData.original.push(parsedMeasurement.originalMeasurement);
                }
              } else {
                // For unparseable measurements, just keep as strings
                consolidated[key].unparsedMeasurements = [ing.measurement];
              }
            } else {
              // For existing ingredients, add the new measurement
              const parsedMeasurement = parseMeasurement(ing.measurement);
              
              if (parsedMeasurement.group && consolidated[key].parsedMeasurements) {
                // Convert to standard unit for the measurement group
                const { standardizedQty, standardUnit } = standardizeQuantity(
                  parsedMeasurement.quantity,
                  parsedMeasurement.unit,
                  parsedMeasurement.group
                );
                
                // Add to existing quantity for the same unit group
                if (!consolidated[key].parsedMeasurements[parsedMeasurement.group]) {
                  consolidated[key].parsedMeasurements[parsedMeasurement.group] = {
                    quantity: standardizedQty,
                    unit: standardUnit,
                    original: [parsedMeasurement.originalMeasurement]
                  };
                } else {
                  const existingData = consolidated[key].parsedMeasurements[parsedMeasurement.group];
                  existingData.quantity += standardizedQty;
                  existingData.original.push(parsedMeasurement.originalMeasurement);
                }
              } else {
                // For unparseable measurements, add to the list
                if (!consolidated[key].unparsedMeasurements) {
                  consolidated[key].unparsedMeasurements = [];
                }
                consolidated[key].unparsedMeasurements.push(ing.measurement);
              }
            }
          });
          
          // Format the final measurements for display
          Object.values(consolidated).forEach(ing => {
            const formattedMeasurements: string[] = [];
            
            // Add all parsed and consolidated measurements
            if (ing.parsedMeasurements) {
              Object.entries(ing.parsedMeasurements).forEach(([group, data]) => {
                const formattedMeasurement = formatMeasurement(data.quantity, data.unit);
                formattedMeasurements.push(formattedMeasurement);
              });
            }
            
            // Add any unparseable measurements
            if (ing.unparsedMeasurements && ing.unparsedMeasurements.length > 0) {
              formattedMeasurements.push(...ing.unparsedMeasurements);
            }
            
            // Join all measurements with commas
            ing.measurement = formattedMeasurements.join(', ');
            
            // Clean up temporary properties
            delete ing.parsedMeasurements;
            delete ing.unparsedMeasurements;
          });
          
          grouped[category] = Object.values(consolidated);
        });
        
        setCategorizedIngredients(grouped);
      } catch (error) {
        console.error('Error loading grocery list data:', error);
        // Initialize with empty values on error
        setIngredients([]);
        setCategorizedIngredients({});
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [selectedRecipes, existingListId]);
  
  useEffect(() => {
    const loadSavedLists = async () => {
      try {
        const savedListsJson = await AsyncStorage.getItem('@grocery_lists');
        if (savedListsJson) {
          setSavedLists(JSON.parse(savedListsJson));
        }
      } catch (error) {
        console.error('Error loading saved grocery lists:', error);
      }
    };

    loadSavedLists();
  }, []);
  
  // Show auth prompt when user completes the initial flow
  useEffect(() => {
    if (!user && !hasCompletedOnboarding) {
      // Wait a bit before showing the auth prompt to allow the user to see the grocery list first
      const timer = setTimeout(() => {
        setShowAuthPrompt(true);
        setHasCompletedOnboarding(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [user, hasCompletedOnboarding]);
  
  // Handle removing an ingredient
  const handleRemoveIngredient = (ingredientName: string) => {
    // Create a new set with the removed ingredient
    const newRemovedIngredients = new Set(removedIngredients);
    newRemovedIngredients.add(ingredientName.toLowerCase());
    setRemovedIngredients(newRemovedIngredients);
  };
  
  // Check if an ingredient is removed
  const isIngredientRemoved = (ingredientName: string): boolean => {
    return removedIngredients.has(ingredientName.toLowerCase());
  };

  // Add handler for selecting/deselecting items
  const handleToggleSelectItem = (ingredientName: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(ingredientName.toLowerCase())) {
        newSelected.delete(ingredientName.toLowerCase());
      } else {
        newSelected.add(ingredientName.toLowerCase());
      }
      return newSelected;
    });
  };

  // Check if an ingredient is selected
  const isIngredientSelected = (ingredientName: string): boolean => {
    return selectedItems.has(ingredientName.toLowerCase());
  };

  // Swipeable Ingredient component - moved inside the parent component
  const SwipeableIngredient = ({ 
    item, 
    isRemoved, 
    onRemove,
    onToggleSelect
  }: { 
    item: Ingredient, 
    isRemoved: boolean, 
    onRemove: () => void,
    onToggleSelect: () => void
  }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const swipeThreshold = -80; // Distance required to trigger removal
    
    // Determine if the measurement text is a consolidated measurement
    const isConsolidatedMeasurement = /^\d+(\.\d+)?|^\d+ \d+\/\d+|^\d+\/\d+/.test(item.measurement);
    
    const isSelected = isIngredientSelected(item.name);
    
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only activate for horizontal swipes and not for removed items
          return !isRemoved && Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 3);
        },
        onPanResponderGrant: () => {
          // Fix the typescript error by not accessing internal properties
          pan.extractOffset();
        },
        onPanResponderMove: (_, gestureState) => {
          // Only allow left swipes (negative dx)
          if (gestureState.dx < 0) {
            Animated.event(
              [null, { dx: pan.x }],
              { useNativeDriver: false }
            )(_, gestureState);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < swipeThreshold) {
            // Swiped far enough to remove
            Animated.timing(pan, {
              toValue: { x: -1000, y: 0 },
              duration: 250,
              useNativeDriver: false
            }).start(onRemove);
          } else {
            // Not swiped far enough, return to original position
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              friction: 5,
              useNativeDriver: false
            }).start();
          }
        }
      })
    ).current;

    // Show delete hint based on swipe distance
    const deleteOpacity = pan.x.interpolate({
      inputRange: [-100, -30],
      outputRange: [1, 0],
      extrapolate: 'clamp'
    });

    return (
      <View style={styles.swipeableContainer}>
        <Animated.View
          style={[
            styles.deleteBackground,
            {
              transform: [{ translateX: -100 }],
              opacity: deleteOpacity
            }
          ]}
        >
          <Text style={styles.deleteText}>Mark as Available</Text>
        </Animated.View>
        
        <Animated.View
          style={[
            styles.ingredientItem,
            isRemoved && styles.removedIngredientItem,
            isSelected && styles.selectedIngredientItem,
            { transform: [{ translateX: pan.x }] }
          ]}
          {...(!isRemoved ? panResponder.panHandlers : {})}
        >
          {isFromProfile && !isRemoved && (
            <TouchableOpacity
              style={styles.selectCheckbox}
              onPress={onToggleSelect}
            >
              <MaterialCommunityIcons
                name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                size={24}
                color={isSelected ? "#4CAF50" : "#999"}
              />
            </TouchableOpacity>
          )}
          
          <View style={styles.ingredientDetails}>
            <Text style={[
              styles.ingredientName,
              isRemoved && styles.removedIngredientText
            ]}>
              {item.name}
              {isRemoved && ' (Have)'}
            </Text>
            
            <View style={styles.measurementRow}>
              <Text style={[
                styles.originalMeasurement,
                isConsolidatedMeasurement && styles.consolidatedMeasurement,
                isRemoved && styles.removedIngredientText
              ]}>
                {item.measurement}
              </Text>
              
              <Text style={[
                styles.packageRecommendation,
                isRemoved && styles.removedIngredientText
              ]}>
                {item.recommendedPackage}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  };

  // Render a single ingredient item
  const renderIngredientItem = ({ item }: { item: Ingredient }) => {
    const isRemoved = isIngredientRemoved(item.name);
    
    return (
      <SwipeableIngredient
        item={item}
        isRemoved={isRemoved}
        onRemove={() => handleRemoveIngredient(item.name)}
        onToggleSelect={() => handleToggleSelectItem(item.name)}
      />
    );
  };
  
  // Render a category section
  const renderCategorySection = (category: string, items: Ingredient[]) => {
    // Only show categories that have active ingredients
    const activeItems = items.filter(item => !isIngredientRemoved(item.name));
    if (activeItems.length === 0 && items.length > 0) {
      // All items in this category are removed
      return (
        <View key={category} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>{category}</Text>
          </View>
          <Text style={styles.allRemovedText}>All items in this category already available</Text>
        </View>
      );
    }
    
    return (
      <View key={category} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{category}</Text>
        </View>
        {items && items.length > 0 ? (
          <View>
            {items.map((item, index) => (
              <View key={`${item.name}-${index}`}>
                {renderIngredientItem({ item })}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyCategory}>No ingredients in this category</Text>
        )}
      </View>
    );
  };
  
  const handleSaveList = async () => {
    try {
      setSavingInProgress(true);
      // Check if user is logged in - if not, show auth prompt
      if (!user) {
        setShowAuthPrompt(true);
        setSavingInProgress(false);
        return;
      }

      // Generate the grocery list from categorized ingredients
      const groceryItems = Object.values(categorizedIngredients)
        .flat()
        .filter(item => !removedIngredients.has(item.name.toLowerCase()))
        .map(item => ({
          name: item.name,
          measurement: item.measurement,
          category: item.category || 'Other',
          isChecked: false,
          recipeId: item.recipeId,
          recipeName: item.recipeName,
          recommendedPackage: item.recommendedPackage
        }));

      // If we're updating an existing list
      if (existingListId) {
        const success = await groceryListService.updateGroceryList(existingListId, {
          name: listName,
          items: groceryItems
        });
        
        setSavingInProgress(false);
        
        if (success) {
          Alert.alert(
            'Success',
            'Your grocery list has been updated!',
            [{ text: 'OK', onPress: () => navigation.navigate('Profile') }]
          );
        } else {
          Alert.alert('Error', 'Failed to update grocery list. Please try again.');
        }
      } else {
        // Create a new list
        const listId = await groceryListService.createGroceryList(
          listName, 
          groceryItems
        );

        setSavingInProgress(false);
        
        if (listId) {
          Alert.alert(
            'Success',
            'Your grocery list has been saved! You can access all your saved lists in your profile.',
            [{ text: 'Go to Profile', onPress: () => navigation.navigate('Profile') }]
          );
        } else {
          Alert.alert('Error', 'Failed to save grocery list. Please try again.');
        }
      }
    } catch (error) {
      setSavingInProgress(false);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('Error saving grocery list:', error);
    }
  };

  // Enhanced auth success handler with data migration
  const handleAuthSuccess = async () => {
    try {
      // Close the modal
      setShowAuthPrompt(false);
      setShowAuthModal(false);
      
      // Show loading indicator
      setSavingInProgress(true);
      
      // Wait for the auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create grocery list items from categorized ingredients
      const groceryItems = Object.values(categorizedIngredients)
        .flat()
        .filter(item => !removedIngredients.has(item.name.toLowerCase()))
        .map(item => ({
          name: item.name,
          measurement: item.measurement,
          category: item.category || 'Other',
          isChecked: false
        }));
      
      // Only save grocery list if there are items and we're not viewing an existing list
      if (groceryItems.length > 0 && !existingListId) {
        console.log(`Creating grocery list with ${groceryItems.length} items`);
        // Save grocery list
        const listId = await groceryListService.createGroceryList(
          'My First Grocery List', 
          groceryItems
        );
      }
      
      // If there are selected recipes, save them
      if (selectedRecipes && selectedRecipes.length > 0) {
        console.log(`Saving ${selectedRecipes.length} selected recipes to profile during onboarding`);
        
        // Save recipes to Firestore, marking them as part of the weekly meal plan
        for (const recipe of selectedRecipes) {
          console.log(`Saving recipe to profile: ${recipe.name} (isWeeklyMealPlan=true)`);
          await firestoreService.saveRecipe({
            name: recipe.name,
            servings: recipe.servings,
            readyInMinutes: parseInt(recipe.prepTime || '0') + parseInt(recipe.cookTime || '0'),
            ingredients: recipe.ingredients.map((ing: { item: string; measurement: string }) => ({
              name: ing.item,
              amount: 1, // Default amount
              unit: ing.measurement,
              originalString: `${ing.measurement} ${ing.item}`
            })),
            instructions: recipe.instructions.map((inst: string, index: number) => ({
              number: index + 1,
              instruction: inst
            })),
            imageUrl: recipe.imageUrl,
            tags: recipe.tags || [],
            isFavorite: true,
            isWeeklyMealPlan: true, // Mark as part of the weekly meal plan
            summary: recipe.description || '',
            sourceUrl: '',
            cuisines: [],
            diets: [],
            dishTypes: []
          });
        }
      }
      
      // Mark onboarding as completed
      setHasCompletedOnboarding(true);
      
      // Hide loading indicator
      setSavingInProgress(false);
      
      // Show success message and navigate to profile
      Alert.alert(
        'Profile Created Successfully!',
        'Your account has been set up and your data has been saved. You can access everything from your profile.',
        [{ 
          text: 'Go to Profile', 
          onPress: () => navigation.navigate('Profile')
        }]
      );
    } catch (error) {
      setSavingInProgress(false);
      console.error('Error in handleAuthSuccess:', error);
      Alert.alert(
        'Profile Created',
        'Your account has been created, but we encountered an issue saving your data. Please try again from your profile.',
        [{ text: 'OK', onPress: () => navigation.navigate('Profile') }]
      );
    }
  };
  
  const handleShareList = async () => {
    try {
      // Create a text representation of the grocery list
      let shareText = "My Grocery List\n\n";
      
      Object.keys(categorizedIngredients).forEach(category => {
        shareText += `${category}:\n`;
        
        categorizedIngredients[category].forEach(item => {
          if (!removedIngredients.has(item.name.toLowerCase())) {
            shareText += `- ${item.measurement} ${item.name}\n`;
          }
        });
        
        shareText += "\n";
      });
      
      // Use the Share API to share the text
      await Share.share({
        message: shareText,
        title: "My Grocery List"
      });
    } catch (error) {
      console.error('Error sharing grocery list:', error);
      Alert.alert('Error', 'Failed to share your grocery list. Please try again.');
    }
  };
  
  // Handle adding selected items to pantry
  const handleAddToPantry = async () => {
    try {
      // Check if there are any selected items
      if (selectedItems.size === 0) {
        Alert.alert('No Items Selected', 'Please select items to add to your pantry.');
        return;
      }

      setSavingInProgress(true);
      
      // Get the selected grocery items
      const selectedGroceryItems = Object.values(categorizedIngredients)
        .flat()
        .filter(item => selectedItems.has(item.name.toLowerCase()))
        .map(item => ({
          name: item.name,
          measurement: item.measurement,
          category: item.category || 'Other'
        }));
      
      // Add the items to the pantry
      const successCount = await pantryService.addGroceryItemsToPantry(selectedGroceryItems);
      
      setSavingInProgress(false);
      
      if (successCount > 0) {
        Alert.alert(
          'Success',
          `${successCount} item${successCount === 1 ? '' : 's'} added to your pantry.`,
          [{ text: 'OK' }]
        );
        
        // Clear the selection
        setSelectedItems(new Set());
      } else {
        Alert.alert('Error', 'Failed to add items to pantry. Please try again.');
      }
    } catch (error) {
      setSavingInProgress(false);
      console.error('Error adding items to pantry:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  // Handle exporting to Notes app (iOS)
  const handleExportToNotes = async () => {
    try {
      // Create a text representation of the grocery list
      let notesText = `${listName}\n\n`;
      
      Object.keys(categorizedIngredients).forEach(category => {
        notesText += `${category}:\n`;
        
        categorizedIngredients[category].forEach(item => {
          if (!removedIngredients.has(item.name.toLowerCase())) {
            notesText += `□ ${item.measurement} ${item.name}\n`;
          }
        });
        
        notesText += "\n";
      });
      
      // Use the Share API to share the text
      await Share.share({
        message: notesText,
        title: listName
      });
    } catch (error) {
      console.error('Error exporting to Notes:', error);
      Alert.alert('Error', 'Failed to export your grocery list. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              const params = route.params;
              // If we navigated from profile and have an existing list, go back to profile
              if (params?.existingListId) {
                navigation.navigate('Profile');
              } else {
                navigation.goBack();
              }
            }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Grocery List</Text>
        </View>
        <ActivityIndicator size="large" color="#4CAF50" />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            const params = route.params;
            // If we navigated from profile and have an existing list, go back to profile
            if (params?.existingListId) {
              navigation.navigate('Profile');
            } else {
              navigation.goBack();
            }
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grocery List</Text>
      </View>
      
      {/* Swipe Tip Banner */}
      <View style={styles.swipeTipContainer}>
        <MaterialCommunityIcons name="gesture-swipe-left" size={20} color="#555" />
        <Text style={styles.swipeTipText}>
          Swipe left on ingredients you already have to remove them from your shopping list
        </Text>
      </View>
      
      {/* Show selection tip when coming from profile */}
      {isFromProfile && (
        <View style={[styles.swipeTipContainer, { backgroundColor: '#E8F5E9' }]}>
          <MaterialCommunityIcons name="checkbox-marked" size={20} color="#4CAF50" />
          <Text style={styles.swipeTipText}>
            Tap on items to select them for adding to your pantry
          </Text>
        </View>
      )}
      
      {/* Package Info Banner */}
      <View style={styles.packageTipContainer}>
        <MaterialCommunityIcons name="information-outline" size={20} color="#555" />
        <Text style={styles.packageTipText}>
          Package sizes listed are suggestions based on common store quantities
        </Text>
      </View>
      
      {/* Information panel */}
      <View style={styles.infoContainer}>
        {removedIngredients.size > 0 && (
          <Text style={styles.removedItemsInfo}>
            {removedIngredients.size} item(s) marked as already available
          </Text>
        )}
        {selectedItems.size > 0 && (
          <Text style={styles.selectedItemsInfo}>
            {selectedItems.size} item(s) selected
          </Text>
        )}
      </View>
      
      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
        ) : Object.keys(categorizedIngredients || {}).length > 0 ? (
          Object.entries(categorizedIngredients || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => renderCategorySection(category, items || []))
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>No ingredients to display.</Text>
            <Text style={styles.emptyStateSubtext}>Select some recipes to create a grocery list.</Text>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.actionsContainer}>
        {isFromProfile ? (
          // Show add to pantry and export to notes buttons when viewing from profile
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.addToPantryButton]}
              onPress={handleAddToPantry}
              disabled={selectedItems.size === 0 || savingInProgress}
            >
              {savingInProgress ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="fridge-outline" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Add to Pantry</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.exportButton]}
              onPress={handleExportToNotes}
            >
              <MaterialCommunityIcons name="export" size={20} color="#FFF" />
              <Text style={styles.actionButtonText}>Export to Notes</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Show save and share buttons when creating a new list
          <>
            <TouchableOpacity
              style={[styles.saveButton, savingInProgress && styles.disabledButton]}
              onPress={handleSaveList}
              disabled={loading || savingInProgress}
            >
              {savingInProgress ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save List</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareList}
            >
              <MaterialCommunityIcons name="share-variant" size={20} color="#FFF" />
              <Text style={styles.shareButtonText}>Share List</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Auth Prompt Modal */}
      <Modal
        visible={showAuthPrompt}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAuthPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="account-plus" size={40} color="#007AFF" style={styles.modalIcon} />
            
            <Text style={styles.modalTitle}>Create a Profile</Text>
            
            <Text style={styles.modalDescription}>
              Sign up to save your meal plan, grocery list, and preferences. Your data will be securely stored and available on any device.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.skipButton}
                onPress={() => {
                  setShowAuthPrompt(false);
                  Alert.alert(
                    'Not Saved',
                    'Your grocery list was created but not saved to your account.',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.signUpButton}
                onPress={() => {
                  setShowAuthPrompt(false);
                  setShowAuthModal(true);
                }}
              >
                <Text style={styles.signUpButtonText}>Create Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Include the AuthModal component */}
      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
      
      {/* Global loading overlay for data saving operations */}
      {savingInProgress && (
        <View style={styles.globalLoadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Saving your data...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    backgroundColor: 'white',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  swipeTipContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#FFF9C4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  swipeTipText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
    flex: 1,
  },
  packageTipContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#E3F2FD', 
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  packageTipText: {
    fontSize: 14,
    color: '#1976D2',
    marginLeft: 8,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  infoContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  removedItemsInfo: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  categorySection: {
    backgroundColor: 'white',
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  swipeableContainer: {
    position: 'relative',
    marginBottom: 2,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  deleteText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  removedIngredientItem: {
    backgroundColor: '#f5f5f5',
  },
  ingredientDetails: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalMeasurement: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginRight: 8,
  },
  packageRecommendation: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  removedIngredientText: {
    color: '#aaa',
    textDecorationLine: 'line-through',
  },
  actionsContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    margin: 16,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  shareButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyCategory: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  allRemovedText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#666',
  },
  loader: {
    marginTop: 20,
  },
  consolidatedMeasurement: {
    fontWeight: '600',
    color: '#4CAF50',
    fontStyle: 'normal',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  skipButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  signUpButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  globalLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  selectedIngredientItem: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  selectCheckbox: {
    marginRight: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    margin: 8,
  },
  addToPantryButton: {
    backgroundColor: '#4CAF50',
  },
  exportButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  selectedItemsInfo: {
    fontSize: 14,
    color: '#4CAF50',
    fontStyle: 'italic',
  },
});

export default GroceryListScreen; 