import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import PantryIngredientMatch from '../components/PantryIngredientMatch';
import { recipeFeedbackService, RecipeFeedback } from '../services/recipeFeedbackService';
import { LinearGradient } from 'expo-linear-gradient';

type RecipeDetailRouteProp = RouteProp<RootStackParamList, 'RecipeDetail'>;
type RecipeDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RecipeDetail'>;

const RecipeDetailScreen: React.FC = () => {
  const navigation = useNavigation<RecipeDetailNavigationProp>();
  const route = useRoute<RecipeDetailRouteProp>();
  const { recipe } = route.params;

  // Add debugging to inspect recipe structure
  useEffect(() => {
    if (recipe) {
      console.log('Recipe in RecipeDetailScreen:', {
        name: recipe.name,
        instructionsType: recipe.instructions ? typeof recipe.instructions : 'undefined',
        isInstructionsArray: recipe.instructions ? Array.isArray(recipe.instructions) : false,
        firstInstructionType: recipe.instructions?.length > 0 
          ? typeof recipe.instructions[0] 
          : 'none',
        firstInstructionSample: recipe.instructions?.length > 0 
          ? JSON.stringify(recipe.instructions[0]).substring(0, 100) 
          : 'none',
      });
    }
  }, [recipe]);

  // Helper function to convert decimal to fraction
  const decimalToFraction = (decimal: number): string => {
    if (decimal === 0) return '0';
    if (decimal === 1) return '1';
    if (decimal === 0.25) return '1/4';
    if (decimal === 0.33 || decimal === 0.333) return '1/3';
    if (decimal === 0.5) return '1/2';
    if (decimal === 0.66 || decimal === 0.666) return '2/3';
    if (decimal === 0.75) return '3/4';
    if (decimal >= 1) {
      const whole = Math.floor(decimal);
      const fraction = decimalToFraction(decimal - whole);
      return fraction === '0' ? whole.toString() : `${whole} ${fraction}`;
    }
    
    // For other decimals, convert to fraction
    const tolerance = 1.0E-6;
    let numerator = 1;
    let denominator = 1;
    let error = Math.abs(decimal - numerator / denominator);
    
    for (let d = 2; d <= 16; d++) {
      const n = Math.round(decimal * d);
      const newError = Math.abs(decimal - n / d);
      if (newError < error) {
        numerator = n;
        denominator = d;
        error = newError;
      }
    }
    
    if (error < tolerance) {
      return `${numerator}/${denominator}`;
    }
    
    return decimal.toString();
  };

  // Helper function to format measurement
  const formatMeasurement = (measurement: string | undefined | null): string => {
    // If measurement is undefined or null, return an empty string
    if (!measurement) {
      return '';
    }
    
    // Ensure measurement is a string
    const measurementStr = String(measurement);
    
    try {
      // Check if the measurement starts with a number using a safe regex operation
      const match = measurementStr.match(/^(\d*\.?\d+)\s*(.*)$/);
      if (match && match[1]) {
        const number = match[1];
        const unit = match[2] || '';
        const fraction = decimalToFraction(parseFloat(number));
        return `${fraction} ${unit}`.trim();
      }
    } catch (error) {
      console.error('Error formatting measurement:', error);
      // Return the original measurement if any error occurs during formatting
    }
    
    return measurementStr;
  };

  // Add state for feedback
  const [isCooked, setIsCooked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [rating, setRating] = useState(0);

  // Update state to include loading state
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);
  const [feedback, setFeedback] = useState<RecipeFeedback | null>(null);

  // Load feedback when component mounts
  useEffect(() => {
    loadFeedback();
  }, [recipe?.id]);

  const loadFeedback = async () => {
    if (!recipe?.id) return;
    
    setIsLoadingFeedback(true);
    try {
      const savedFeedback = await recipeFeedbackService.getFeedback(recipe.id);
      if (savedFeedback) {
        setFeedback(savedFeedback);
        setIsCooked(savedFeedback.isCooked);
        setIsLiked(savedFeedback.isLiked);
        setIsDisliked(savedFeedback.isDisliked);
        setRating(savedFeedback.rating);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
      Alert.alert('Error', 'Failed to load recipe feedback');
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const saveFeedback = async (updates: Partial<RecipeFeedback>) => {
    if (!recipe?.id) return;

    try {
      const success = await recipeFeedbackService.saveFeedback(recipe.id, {
        isCooked,
        isLiked,
        isDisliked,
        rating,
        ...updates,
      });

      if (!success) {
        Alert.alert('Error', 'Failed to save feedback');
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
      Alert.alert('Error', 'Failed to save feedback');
    }
  };

  // Update the feedback handlers
  const handleCookedToggle = async () => {
    const newIsCooked = !isCooked;
    setIsCooked(newIsCooked);
    await saveFeedback({ isCooked: newIsCooked });
  };

  const handleLikeToggle = async () => {
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    if (newIsLiked) {
      setIsDisliked(false);
    }
    await saveFeedback({ 
      isLiked: newIsLiked,
      isDisliked: newIsLiked ? false : isDisliked
    });
  };

  const handleDislikeToggle = async () => {
    const newIsDisliked = !isDisliked;
    setIsDisliked(newIsDisliked);
    if (newIsDisliked) {
      setIsLiked(false);
    }
    await saveFeedback({ 
      isDisliked: newIsDisliked,
      isLiked: newIsDisliked ? false : isLiked
    });
  };

  const handleRatingChange = async (newRating: number) => {
    setRating(newRating);
    await saveFeedback({ rating: newRating });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipe Details</Text>
      </View>
      
      {recipe ? (
        <ScrollView style={styles.content}>
          {/* Recipe Header */}
          <View style={styles.recipeHeader}>
            {recipe.imageUrl ? (
              <Image 
                source={{ uri: recipe.imageUrl }} 
                style={styles.recipeImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.recipeImage, styles.imagePlaceholder]}>
                <MaterialCommunityIcons 
                  name={(recipe as any)._isPlaceholder ? "alert-circle-outline" : "food"} 
                  size={48} 
                  color={(recipe as any)._isPlaceholder ? "#856404" : "#C4B5A4"} 
                />
              </View>
            )}
            
            <View style={styles.recipeTitleContainer}>
              <Text style={styles.recipeTitle}>{recipe.name || 'Unnamed Recipe'}</Text>
              
              {/* Add warning for placeholder recipes */}
              {(recipe as any)._isPlaceholder && (
                <View style={styles.warningBanner}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#856404" />
                  <Text style={styles.warningText}>
                    Recipe details could not be fully loaded. ID: {recipe.id}
                  </Text>
                </View>
              )}
              
              {/* Recipe Tags */}
              {recipe.tags && recipe.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {recipe.tags.map((tag: any, index: number) => {
                    const tagText = typeof tag === 'string' ? tag : String(tag);
                    return (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tagText}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              
              {/* Recipe Metadata */}
              <View style={styles.metadataContainer}>
                <View style={styles.metadataItem}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#666" />
                  <Text style={styles.metadataText}>
                    {recipe.readyInMinutes || 
                      (parseInt(recipe.prepTime || '0') + parseInt(recipe.cookTime || '0')) || 
                      '?'} min
                  </Text>
                </View>
                
                <View style={styles.metadataItem}>
                  <MaterialCommunityIcons name="account-outline" size={16} color="#666" />
                  <Text style={styles.metadataText}>
                    {recipe.servings || '?'} {recipe.servings === 1 ? 'serving' : 'servings'}
                  </Text>
                </View>
                
                {recipe.estimatedCost !== undefined && (
                  <View style={styles.metadataItem}>
                    <MaterialCommunityIcons name="currency-usd" size={16} color="#666" />
                    <Text style={styles.metadataText}>
                      {recipe.estimatedCost.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          {/* Recipe Description */}
          {recipe.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>
                {typeof recipe.description === 'string' 
                  ? recipe.description
                      .split('.')
                      .filter((sentence: string) => sentence?.trim?.().length > 0)
                      .map((sentence: string, i: number, arr: string[]) => 
                        `${sentence.trim()}${i < arr.length - 1 ? '.' : ''}`
                      )
                      .join(' ')
                  : String(recipe.description)
                }
              </Text>
            </View>
          )}
          
          {/* Pantry Match */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={styles.section}>
              {/* Convert ingredients to the format expected by PantryIngredientMatch */}
              <PantryIngredientMatch 
                ingredients={recipe.ingredients.map((ingredient: any) => {
                  // Handle different data formats and convert to {item, measurement} format
                  if (typeof ingredient === 'string') {
                    return { item: ingredient, measurement: '' };
                  } 
                  if (typeof ingredient === 'object') {
                    if (ingredient.item) {
                      // Already in right format: {item, measurement}
                      return ingredient;
                    } else if (ingredient.name) {
                      // Convert from {name, amount, unit} to {item, measurement}
                      return {
                        item: ingredient.name,
                        measurement: ingredient.unit
                          ? `${ingredient.amount || ''} ${ingredient.unit}`
                          : String(ingredient.amount || '')
                      };
                    }
                  }
                  // Default conversion as needed
                  return { 
                    item: ingredient?.toString?.() || 'Unknown Ingredient', 
                    measurement: '' 
                  };
                })} 
              />
            </View>
          )}
          
          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {recipe.ingredients.map((ingredient: any, index: number) => {
                // Handle different formats of ingredient data
                // Format 1: {item: string, measurement: string}
                // Format 2: {name: string, amount: number, unit: string}
                // Format 3: string
                let itemName = '';
                let itemMeasurement = '';
                
                if (typeof ingredient === 'string') {
                  // If ingredient is a plain string
                  itemName = ingredient;
                } else if (typeof ingredient === 'object') {
                  // If ingredient is an object, determine its format
                  if (ingredient.item) {
                    // Format 1: {item, measurement}
                    itemName = ingredient.item;
                    itemMeasurement = ingredient.measurement;
                  } else if (ingredient.name) {
                    // Format 2: {name, amount, unit}
                    itemName = ingredient.name;
                    itemMeasurement = ingredient.unit 
                      ? `${ingredient.amount || ''} ${ingredient.unit}` 
                      : String(ingredient.amount || '');
                  } else {
                    // Unknown format - convert to string
                    itemName = JSON.stringify(ingredient);
                  }
                }
                
                return (
                  <View key={index} style={styles.ingredientItem}>
                    <MaterialCommunityIcons name="circle-small" size={20} color="#666" />
                    <Text style={styles.ingredientText}>
                      {formatMeasurement(itemMeasurement)} {itemName}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          
          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {recipe.instructions.map((instruction: any, index: number) => {
                // Handle instructions that could be strings or objects with {instruction, number} properties
                const instructionText = typeof instruction === 'string' 
                  ? instruction 
                  : instruction?.instruction || '';
                
                // Get step number (from object or use index+1)
                const stepNumber = typeof instruction === 'object' && instruction?.number
                  ? instruction.number
                  : index + 1;
                
                return (
                  <View key={index} style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>{stepNumber}</Text>
                    </View>
                    <Text style={styles.instructionText}>{instructionText || ''}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#dc3545" />
          <Text style={styles.errorText}>Recipe data is missing or invalid.</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['#D9A15B', '#B57A42']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 12, paddingHorizontal: 24 }}
            >
              <Text style={styles.errorButtonText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Recipe Feedback Section */}
      {recipe && (
        <View style={styles.feedbackContainer}>
          <View style={styles.feedbackBar}>
            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={handleCookedToggle}
              disabled={isLoadingFeedback}
            >
              <MaterialCommunityIcons 
                name={isCooked ? "silverware-variant" : "silverware-fork-knife"} 
                size={24} 
                color={isCooked ? "#4CAF50" : "#4CAF50"}
              />
              <Text style={[styles.feedbackText, { 
                color: '#4CAF50',
                fontWeight: isCooked ? '600' : '500'
              }]}>Cooked</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={handleLikeToggle}
              disabled={isLoadingFeedback}
            >
              <MaterialCommunityIcons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={24} 
                color={isLiked ? "#FF4081" : "#FF4081"}
              />
              <Text style={[styles.feedbackText, { 
                color: '#FF4081',
                fontWeight: isLiked ? '600' : '500'
              }]}>Liked</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={handleDislikeToggle}
              disabled={isLoadingFeedback}
            >
              <MaterialCommunityIcons 
                name={isDisliked ? "thumb-down" : "thumb-down-outline"} 
                size={24} 
                color={isDisliked ? "#9E9E9E" : "#9E9E9E"}
              />
              <Text style={[styles.feedbackText, { 
                color: '#9E9E9E',
                fontWeight: isDisliked ? '600' : '500'
              }]}>Dislike</Text>
            </TouchableOpacity>
          </View>

          {/* Rating Section */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>Rate this recipe</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRatingChange(star)}
                  disabled={isLoadingFeedback}
                >
                  <MaterialCommunityIcons 
                    name={star <= rating ? "star" : "star-outline"} 
                    size={32} 
                    color="#FFC107"
                    style={styles.starIcon}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4E4E4E',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  recipeHeader: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  recipeImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E6DED3',
  },
  recipeTitleContainer: {
    padding: 16,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#4E4E4E',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#E6DED3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#4E4E4E',
    fontSize: 14,
    fontWeight: '500',
  },
  metadataContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
    backgroundColor: '#FAF7F2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  metadataText: {
    color: '#4E4E4E',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4E4E4E',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#4E4E4E',
    lineHeight: 24,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FAF7F2',
    padding: 12,
    borderRadius: 8,
  },
  ingredientText: {
    fontSize: 16,
    color: '#4E4E4E',
    flex: 1,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#C4B5A4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  instructionText: {
    fontSize: 16,
    color: '#4E4E4E',
    lineHeight: 24,
    flex: 1,
  },
  feedbackContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E6DED3',
  },
  feedbackBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DED3',
  },
  feedbackButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FAF7F2',
    minWidth: 80,
  },
  feedbackText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
    color: '#4E4E4E',
  },
  ratingSection: {
    paddingTop: 16,
    alignItems: 'center',
  },
  ratingLabel: {
    color: '#4E4E4E',
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    padding: 12,
    borderRadius: 12,
  },
  starIcon: {
    marginHorizontal: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FAF7F2',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 16,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#C4B5A4',
    borderRadius: 12,
    overflow: 'hidden',
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  warningBanner: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default RecipeDetailScreen; 