import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { pantryService } from '../services/pantryService';
import { theme } from '../styles/theme';

interface Ingredient {
  item: string;
  measurement: string;
}

interface PantryIngredientMatchProps {
  ingredients: Ingredient[];
  compact?: boolean;
}

/**
 * Component to display which recipe ingredients are available in the user's pantry
 */
const PantryIngredientMatch: React.FC<PantryIngredientMatchProps> = ({
  ingredients,
  compact = false
}) => {
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPantryIngredients = async () => {
      setLoading(true);
      
      const availableItems: string[] = [];
      
      // Check each ingredient against the pantry
      for (const ingredient of ingredients) {
        const isAvailable = await pantryService.isIngredientInPantry(ingredient.item);
        if (isAvailable) {
          availableItems.push(ingredient.item);
        }
      }
      
      setAvailableIngredients(availableItems);
      setLoading(false);
    };
    
    checkPantryIngredients();
  }, [ingredients]);
  
  const percentAvailable = Math.round((availableIngredients.length / ingredients.length) * 100);
  
  if (loading) {
    return compact ? (
      <Text style={styles.loadingCompact}>Checking pantry...</Text>
    ) : (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Checking pantry ingredients...</Text>
      </View>
    );
  }
  
  if (availableIngredients.length === 0) {
    return compact ? (
      <Text style={styles.noneCompact}>
        <MaterialCommunityIcons name="food-off" size={14} /> No ingredients in pantry
      </Text>
    ) : (
      <View style={styles.container}>
        <Text style={styles.noIngredientsText}>
          <MaterialCommunityIcons name="food-off" size={16} /> No ingredients available in your pantry
        </Text>
      </View>
    );
  }
  
  if (compact) {
    return (
      <Text style={styles.availableCompact}>
        <MaterialCommunityIcons name="food-variant" size={14} color={theme.colors.success} /> 
        {availableIngredients.length} of {ingredients.length} ingredients in pantry ({percentAvailable}%)
      </Text>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="food-variant" size={18} color={theme.colors.success} />
        <Text style={styles.headerText}>
          Pantry Match: {availableIngredients.length} of {ingredients.length} ingredients available ({percentAvailable}%)
        </Text>
      </View>
      
      <View style={styles.ingredientList}>
        {availableIngredients.length > 0 && (
          <>
            <Text style={styles.subheader}>Available in your pantry:</Text>
            <View style={styles.availableIngredients}>
              {availableIngredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.success} />
                  <Text style={styles.ingredientText}>{ingredient}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        
        {availableIngredients.length < ingredients.length && (
          <>
            <Text style={styles.subheader}>Missing from your pantry:</Text>
            <View style={styles.missingIngredients}>
              {ingredients
                .filter(ingredient => !availableIngredients.includes(ingredient.item))
                .map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.error} />
                    <Text style={styles.ingredientText}>{ingredient.item}</Text>
                  </View>
                ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
    color: theme.colors.text,
  },
  subheader: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    color: theme.colors.textSecondary,
  },
  ingredientList: {
    marginTop: 4,
  },
  availableIngredients: {
    marginBottom: 8,
  },
  missingIngredients: {},
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  ingredientText: {
    marginLeft: 6,
    fontSize: 14,
    color: theme.colors.text,
  },
  loadingContainer: {
    marginVertical: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  noIngredientsText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingCompact: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  availableCompact: {
    fontSize: 12,
    color: theme.colors.success,
  },
  noneCompact: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});

export default PantryIngredientMatch; 