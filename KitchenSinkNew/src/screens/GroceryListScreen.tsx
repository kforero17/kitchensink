import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, Alert, Animated, PanResponder, Dimensions, Share, Modal, ViewStyle, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Recipe } from '../types/Recipe';
import { standardizeGroceryItem } from '../utils/groceryStandardization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { groceryListService } from '../services/groceryListService';
import { firestoreService } from '../services/firebaseService';
import { addGroceryItemsToPantryFirestore } from '../services/pantryService';
import {
  GroceryItem,
  GroceryListDocument,
  PantryItemDocument,
  RecipeIngredient,
  RecipeStep,
  RecipeDocument
} from '../types/FirestoreSchema';
import firestore from '@react-native-firebase/firestore';

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
  
  // Since authentication is now required before reaching this screen, 
  // we can remove the auth prompt logic
  
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
          pan.extractOffset();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx < 0) {
            Animated.event(
              [null, { dx: pan.x }],
              { useNativeDriver: false }
            )(_, gestureState);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < swipeThreshold) {
            Animated.timing(pan, {
              toValue: { x: -1000, y: 0 },
              duration: 250,
              useNativeDriver: false
            }).start(onRemove);
          } else {
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              friction: 5,
              useNativeDriver: false
            }).start();
          }
        }
      })
    ).current;

    const deleteOpacity = pan.x.interpolate({
      inputRange: [-100, -30],
      outputRange: [1, 0],
      extrapolate: 'clamp'
    });

    const cleanMeasurementText = (measurement: string): string => {
      const dupeNumberPattern = /^(\d+)\s+(\d+(?:\/\d+)?)/;
      if (dupeNumberPattern.test(measurement)) {
        return measurement.replace(dupeNumberPattern, '$2');
      }
      return measurement;
    };

    return (
      <View style={styles.swipeableContainer}>
        <Animated.View
          style={[
            styles.deleteBackground,
            { transform: [{ translateX: -100 }], opacity: deleteOpacity }
          ]}
        >
          <Text style={styles.deleteText}>Mark as Available</Text>
        </Animated.View>
        
        <Animated.View
          style={[
            styles.ingredientItem, // This is the main animated view for swipe
            isRemoved && styles.removedIngredientItem,
            isSelected && styles.selectedIngredientItem,
            { transform: [{ translateX: pan.x }] }
          ]}
          {...(!isRemoved ? panResponder.panHandlers : {})}
        >
          <TouchableOpacity 
            style={styles.ingredientTouchable} // Inner touchable for content interactions
            onPress={onToggleSelect} // This press should toggle selection if from profile
            disabled={!isFromProfile && !isRemoved} // Disable if not from profile OR if already removed (swipe handles removal)
          >
            {isFromProfile && (
              <MaterialCommunityIcons
                name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                size={24}
                color={isSelected ? "#D9A15B" : "#7A736A"} // Use theme colors
                style={{ marginRight: 8 }} // Add some spacing for the checkbox
              />
            )}
            <View style={styles.ingredientDetails}>
              <Text style={[
                styles.ingredientName,
                isRemoved ? styles.removedIngredientText : undefined,
                isSelected && isFromProfile ? styles.selectedText : undefined // Apply selectedText only if from profile
              ]}>
                {item.name}
                {isRemoved && ' (Have)'}
              </Text>
              
              <View style={styles.measurementRow}>
                <Text style={[
                  styles.originalMeasurement,
                  isConsolidatedMeasurement && styles.consolidatedMeasurement,
                  isRemoved && styles.removedIngredientText,
                  isSelected && isFromProfile ? styles.selectedText : undefined
                ]}>
                  {cleanMeasurementText(item.measurement)}
                </Text>
                
                {item.recommendedPackage && (
                  <Text style={[
                    styles.packageRecommendation,
                    isRemoved && styles.removedIngredientText,
                    isSelected && isFromProfile ? styles.selectedText : undefined
                  ]}>
                    ({item.recommendedPackage})
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
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
      // Prevent duplicate saves
      if (savingInProgress) {
        console.log('GroceryListScreen: Save already in progress, ignoring duplicate save attempt');
        return;
      }
      
      setSavingInProgress(true);
      console.log('GroceryListScreen: Starting grocery list save process');
      
      if (!user) {
        console.log('GroceryListScreen: User not authenticated, this should not happen.');
        Alert.alert('Error', 'You must be logged in to save grocery lists.');
        setSavingInProgress(false);
        return;
      }

      console.log('GroceryListScreen: User is authenticated, proceeding with normal save');
      
      const groceryItemsToSave: GroceryItem[] = Object.values(categorizedIngredients)
        .flat()
        .filter(item => item.name && !removedIngredients.has(item.name.toLowerCase()))
        .map(item => {
          const parsed = parseMeasurement(item.measurement);
          const qty = parsed.quantity || 1;
          const unitStr = parsed.unit || 'unit';

          // standardizeGroceryItem currently returns: 
          // { ingredient: string; originalMeasurement: string; recommendedPackage: string; }
          // It does NOT return purchaseQuantity or purchaseUnit according to linter.
          const standardizedInfo = standardizeGroceryItem(item.name, item.measurement);

          return {
            name: item.name,
            measurement: item.measurement, 
            quantity: qty, // Use parsed quantity
            unit: unitStr, // Use parsed unit
            category: item.category || 'Other',
            checked: false,
            recipeId: item.recipeId,
            recipeName: item.recipeName,
            recommendedPackage: standardizedInfo.recommendedPackage, // This is available
            // Set purchaseQuantity and purchaseUnit based on parsed values or make them optional if schema allows
            // Assuming GroceryItem might have these as optional or they can default to the main quantity/unit
            purchaseQuantity: qty, // Defaulting to parsed quantity
            purchaseUnit: unitStr,   // Defaulting to parsed unit
          };
        });

      if (existingListId) {
        console.log(`GroceryListScreen: Updating existing list with ID: ${existingListId}`);
        const updateData: Partial<Omit<GroceryListDocument, 'id' | 'createdAt' | 'updatedAt'>> = {
          name: listName,
          items: groceryItemsToSave // Use the correctly typed array
        };
        const success = await groceryListService.updateGroceryList(existingListId, updateData);
        
        setSavingInProgress(false);
        
        if (success) {
          console.log('GroceryListScreen: List updated successfully');
          Alert.alert(
            'Success',
            'Your grocery list has been updated!',
            [{ text: 'OK', onPress: () => navigation.navigate('Profile') }]
          );
        } else {
          console.error('GroceryListScreen: Failed to update grocery list');
          Alert.alert('Error', 'Failed to update grocery list. Please try again.');
        }
      } else {
        console.log('GroceryListScreen: Creating new grocery list using groceryListService.createGroceryList');
        const listId = await groceryListService.createGroceryList(
          listName, 
          groceryItemsToSave // Use the correctly typed array
        );

        setSavingInProgress(false);
        
        if (listId) {
          console.log('GroceryListScreen: Grocery list created successfully with ID:', listId);
          setHasCompletedOnboarding(true);
          Alert.alert(
            'Success',
            'Your grocery list has been saved! You can access all your saved lists in your profile.',
            [{ text: 'Go to Profile', onPress: () => navigation.navigate('Profile') }]
          );
        } else {
          console.error('GroceryListScreen: Failed to create grocery list, listId is null.');
          Alert.alert('Error', 'Grocery list creation may have failed. Please check your profile.');
        }
      }
    } catch (error) {
      console.error('GroceryListScreen: Error saving grocery list:', error);
      setSavingInProgress(false);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  // Removed handleAuthSuccess function since authentication is now required before reaching this screen
  
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
  
  // Add this new handler function after handleExportToNotes
  const handleAddAllToPantry = async () => {
    try {
      // Ensure user is logged in
      if (!user?.uid) {
        Alert.alert('Error', 'You must be logged in to add items to the pantry.');
        return;
      }

      setSavingInProgress(true);
      
      // Get all non-removed items
      const itemsToAdd = Object.values(categorizedIngredients)
        .flat()
        .filter(item => !removedIngredients.has(item.name.toLowerCase()))
        .map(item => ({
          name: item.name,
          measurement: item.measurement,
          category: item.category || 'Other'
        }));

      if (itemsToAdd.length === 0) {
        Alert.alert('No Items', 'There are no items to add to your pantry.');
        setSavingInProgress(false);
        return;
      }
      
      // Use the Firestore-specific function
      const successCount = await addGroceryItemsToPantryFirestore(user.uid, itemsToAdd);
      
      setSavingInProgress(false);
      
      if (successCount > 0) {
        Alert.alert(
          'Success',
          `${successCount} item${successCount === 1 ? '' : 's'} added/updated in your pantry.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to add items to pantry. Please try again.');
      }
    } catch (error) {
      setSavingInProgress(false);
      console.error('Error adding items to pantry:', error);
      Alert.alert('Error', 'Something went wrong while adding items to the pantry.');
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
  
  // Handle adding selected items to pantry
  const handleAddToPantry = async () => {
    try {
      // Ensure user is logged in
      if (!user?.uid) {
        // Should ideally not happen if button is disabled, but good practice
        Alert.alert('Error', 'You must be logged in to add items to the pantry.');
        return;
      }

      if (selectedItems.size === 0) {
        Alert.alert('No Items Selected', 'Please select items to add to your pantry.');
        return;
      }

      setSavingInProgress(true);
      
      const selectedGroceryItems = Object.values(categorizedIngredients)
        .flat()
        .filter(item => selectedItems.has(item.name.toLowerCase()))
        .map(item => ({
          name: item.name,
          measurement: item.measurement, // Pass measurement for parsing in the service
          category: item.category || 'Other' // Pass category
        }));
      
      // Use the new Firestore-specific function
      const successCount = await addGroceryItemsToPantryFirestore(user.uid, selectedGroceryItems);
      
      setSavingInProgress(false);
      
      if (successCount > 0) {
        Alert.alert(
          'Success',
          `${successCount} item${successCount === 1 ? '' : 's'} added/updated in your pantry.`,
          [{ text: 'OK' }]
        );
        setSelectedItems(new Set()); // Clear selection
      } else {
        Alert.alert('Error', 'Failed to add items to pantry. Please check logs or try again.');
      }
    } catch (error) {
      setSavingInProgress(false);
      console.error('Error adding items to pantry:', error);
      Alert.alert('Error', 'Something went wrong while adding items to the pantry.');
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
            <MaterialCommunityIcons name="arrow-left" size={24} color="#4E4E4E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Grocery List</Text>
        </View>
        <ActivityIndicator size="large" color="#D9A15B" />
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
          <MaterialCommunityIcons name="arrow-left" size={24} color="#4E4E4E" />
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
          <ActivityIndicator size="large" color="#D9A15B" style={styles.loader} />
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
          // Show add to pantry, add all to pantry, and export to notes buttons when viewing from profile
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddToPantry}
              disabled={selectedItems.size === 0 || savingInProgress}
            >
              <LinearGradient
                colors={['#D9A15B', '#B57A42']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {savingInProgress && selectedItems.size > 0 ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="fridge-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Add to Pantry</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddAllToPantry}
              disabled={savingInProgress}
            >
              <LinearGradient
                colors={['#C4B5A4', '#A58D78']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {savingInProgress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="fridge-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Add All to Pantry</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleExportToNotes}
            >
              <LinearGradient
                colors={['#C4B5A4', '#A58D78']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <MaterialCommunityIcons name="export" size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Export to Notes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          // Show save list and add all to pantry buttons when creating a new list
          <>
            <TouchableOpacity
              style={[styles.actionButton, savingInProgress && styles.disabledButton]}
              onPress={handleSaveList}
              disabled={loading || savingInProgress}
            >
              <LinearGradient
                colors={['#D9A15B', '#B57A42']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {savingInProgress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Save List</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, savingInProgress && styles.disabledButton]}
              onPress={handleAddAllToPantry}
              disabled={loading || savingInProgress}
            >
              <LinearGradient
                colors={['#C4B5A4', '#A58D78']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {savingInProgress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="fridge-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Add All to Pantry</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Removed auth prompts since authentication is now required before reaching this screen */}
      
      {/* Global loading overlay for data saving operations */}
      {savingInProgress && (
        <View style={styles.globalLoadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D9A15B" />
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
    backgroundColor: '#FAF6F1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4E4E4E',
    flex: 1, // Ensure title takes available space
  },
  swipeTipContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#FDFBF7', // Lighter, warmer tip background
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  swipeTipText: {
    fontSize: 14,
    color: '#7A736A', // Softer text color
    marginLeft: 8,
    flex: 1,
  },
  packageTipContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#F5EFE6', 
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  packageTipText: {
    fontSize: 14,
    color: '#7A736A',
    marginLeft: 8,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  infoContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  removedItemsInfo: {
    fontSize: 14,
    color: '#7A736A',
    fontStyle: 'italic',
  },
  categorySection: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, // Softer shadow
    shadowRadius: 3,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
    paddingBottom: 8,
  },
  categoryTitle: {
    fontSize: 20, // Slightly larger category title
    fontWeight: '600',
    color: '#4E4E4E',
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
    backgroundColor: '#D9A15B', // Use accent color
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8, // Match ingredient item radius
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  ingredientItem: { // Base style for the tappable area
    backgroundColor: '#FFFFFF', 
    borderRadius: 8,
    marginBottom: 2, 
  },
  ingredientTouchable: { // Inner container for content, receives press
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE5', // Lighter separator
  },
  removedIngredientItem: { // Style for the swipeable Animated.View when removed
    backgroundColor: '#F5F5F5', // Keep this distinct but muted
  },
  selectedIngredientItem: { // Style for the swipeable Animated.View when selected
    backgroundColor: '#FFF9F2', // Light accent for selection
    borderLeftWidth: 4,
    borderLeftColor: '#D9A15B',
  },
  ingredientDetails: {
    flex: 1,
    marginLeft: 8, // Add margin if checkbox is present
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4E4E4E',
  },
  removedIngredientText: { // Applied to text within a removed item
    color: '#A09483',
    textDecorationLine: 'line-through',
  },
  selectedText: { // Applied to text within a selected item
    color: '#B57A42', // Darker accent for selected text
    fontWeight: '600',
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  originalMeasurement: {
    fontSize: 14,
    color: '#7A736A',
    marginRight: 8,
  },
  packageRecommendation: {
    fontSize: 14,
    color: '#C4B5A4', // Muted color for package info
    fontWeight: '500',
    fontStyle: 'italic',
    marginLeft: 2,
  },
  actionsContainer: {
    paddingVertical: 12, // Reduced vertical padding
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E6DED3',
    flexDirection: 'row',
    justifyContent: 'center', // Center the single save button
    alignItems: 'center',
  },
  saveButton: { // Wrapper for the gradient
    width: '80%', // Make button wider
    borderRadius: 12,
    overflow: 'hidden', // Important for gradient border radius
  },
  buttonGradient: { // Style for the LinearGradient component
    paddingVertical: 14, // Increased padding for a larger button
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  emptyCategory: {
    fontSize: 16,
    color: '#7A736A',
    textAlign: 'center',
    marginTop: 16,
    paddingVertical: 10, // Add some padding
  },
  allRemovedText: {
    fontSize: 14,
    color: '#A09483',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, // Add padding
  },
  emptyStateText: {
    fontSize: 20, // Larger text
    fontWeight: '600',
    color: '#4E4E4E',
    marginBottom: 12, // Increased margin
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#7A736A',
    textAlign: 'center', // Center align subtext
  },
  loader: {
    marginTop: 30, // More margin for loader
  },
  consolidatedMeasurement: { // Keep for consistency if used
    fontWeight: '600',
    color: '#4CAF50', // Green as in previous example, can be changed to #D9A15B if preferred
    fontStyle: 'normal',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  modalIcon: {
    marginBottom: 16,
    color: '#D9A15B', // Use accent color for modal icon
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4E4E4E',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#7A736A',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24, // Improved line height
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6DED3',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#7A736A',
    fontWeight: '600',
    fontSize: 16,
  },
  signUpButton: { // This refers to the TouchableOpacity wrapper for the gradient
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    overflow: 'hidden', // Ensure gradient is clipped
  },
  // signUpButtonText is part of the gradient, so styled within saveButtonText/buttonGradient logic
  signUpButtonText: { // Text directly inside the gradient button
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center', 
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: { // For the small loading indicator box
    backgroundColor: '#FFFFFF',
    padding: 24, // More padding
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 180, // Slightly smaller width
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4E4E4E',
  },
  selectedItemsInfo: {
    fontSize: 14,
    color: '#B57A42', // Darker accent for selected info
    fontStyle: 'italic',
    marginTop: 4, // Add some space if both infos are shown
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9F2', // Light accent background
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 'auto', // Push to the right
    borderWidth: 1,
    borderColor: '#E6DED3',
  },
  selectAllText: {
    marginLeft: 6,
    color: '#B57A42', // Darker accent for text
    fontWeight: '600',
    fontSize: 14,
  },
  actionButton: { // For Add to Pantry / Export to Notes
    flex: 1,
    borderRadius: 12,
    marginHorizontal: 4, // Reduced margin for tighter packing
    overflow: 'hidden',
  },
  // addToPantryButton and exportButton will now primarily be LinearGradient styled by buttonGradient
  addToPantryButton: { // Minimal style if not using gradient directly
    // backgroundColor: '#D9A15B', // Primary accent
  },
  exportButton: { // Minimal style if not using gradient directly
    // backgroundColor: '#C4B5A4', // Secondary accent or neutral
  },
  actionButtonText: { // Text inside action buttons (if gradient used)
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15, // Slightly smaller for two buttons
    marginLeft: 8,
    textAlign: 'center',
  },
  // Styles for ingredient rows when not using SwipeableIngredient directly
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFF',
  },
  ingredientText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  checkButton: {
    marginLeft: 8,
  },
  checkedItem: {
    backgroundColor: '#F5F5F5',
  },
  checkedText: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
});

export default GroceryListScreen; 