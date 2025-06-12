import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  FoodPreferences,
  IngredientSuggestion,
  IngredientCategory,
  INGREDIENT_SUGGESTIONS,
} from '../types/FoodPreferences';
import { getFoodPreferences, saveFoodPreferences } from '../utils/preferences';
import { BackButton } from '../components/BackButton';
import { useRoute, RouteProp } from '@react-navigation/native';

type FoodPreferencesRouteProp = RouteProp<RootStackParamList, 'FoodPreferences'>;

type Props = NativeStackScreenProps<RootStackParamList, 'FoodPreferences'>;

// Define common cuisines
const COMMON_CUISINES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai',
  'French', 'Spanish', 'Greek', 'Mediterranean', 'Vietnamese', 'Korean'
];

// Extend FoodPreferences type to include favoriteCuisines
interface ExtendedFoodPreferences extends Omit<FoodPreferences, 'preferredCuisines'> {
  favoriteCuisines: string[];
}

export const FoodPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const route = useRoute<FoodPreferencesRouteProp>();
  const isFromProfile = route.params?.fromProfile === true;
  
  const [preferences, setPreferences] = useState<ExtendedFoodPreferences>({
    favoriteIngredients: [],
    dislikedIngredients: [],
    allergies: [],
    favoriteCuisines: [], // Initialize favoriteCuisines
  });
  const [isLoading, setIsLoading] = useState(true);

  const [favoriteInput, setFavoriteInput] = useState('');
  const [dislikedInput, setDislikedInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>('vegetables');

  useEffect(() => {
    loadSavedPreferences();
  }, []);

  const loadSavedPreferences = async () => {
    try {
      const savedPreferences = await getFoodPreferences();
      if (savedPreferences) {
        // Convert saved preferences to extended format
        const extendedPreferences: ExtendedFoodPreferences = {
          ...savedPreferences,
          favoriteCuisines: (savedPreferences as any).favoriteCuisines || [],
        };
        setPreferences(extendedPreferences);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to load saved preferences.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const addFavorite = (ingredient: string) => {
    if (
      ingredient.trim() &&
      !preferences.favoriteIngredients.includes(ingredient.trim()) &&
      !preferences.dislikedIngredients.includes(ingredient.trim())
    ) {
      setPreferences(prev => ({
        ...prev,
        favoriteIngredients: [...prev.favoriteIngredients, ingredient.trim()],
      }));
      setFavoriteInput('');
    }
  };

  const removeFavorite = (ingredient: string) => {
    setPreferences(prev => ({
      ...prev,
      favoriteIngredients: prev.favoriteIngredients.filter(i => i !== ingredient),
    }));
  };

  const addDisliked = (ingredient: string) => {
    if (
      ingredient.trim() &&
      !preferences.dislikedIngredients.includes(ingredient.trim()) &&
      !preferences.favoriteIngredients.includes(ingredient.trim())
    ) {
      setPreferences(prev => ({
        ...prev,
        dislikedIngredients: [...prev.dislikedIngredients, ingredient.trim()],
      }));
      setDislikedInput('');
    }
  };

  const removeDisliked = (ingredient: string) => {
    setPreferences(prev => ({
      ...prev,
      dislikedIngredients: prev.dislikedIngredients.filter(i => i !== ingredient),
    }));
  };

  // Function to toggle favorite cuisines
  const toggleFavoriteCuisine = (cuisine: string) => {
    setPreferences(prev => {
      const currentCuisines = prev.favoriteCuisines || [];
      if (currentCuisines.includes(cuisine)) {
        return {
          ...prev,
          favoriteCuisines: currentCuisines.filter((c: string) => c !== cuisine),
        };
      } else {
        return {
          ...prev,
          favoriteCuisines: [...currentCuisines, cuisine],
        };
      }
    });
  };

  const categories: IngredientCategory[] = [
    'vegetables',
    'fruits',
    'meats',
    'seafood',
    'dairy',
    'grains',
    'herbs',
    'spices',
    'other',
  ];

  const renderCategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryTabs}
    >
      {categories.map(category => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryTab,
            activeCategory === category && styles.activeCategoryTab,
          ]}
          onPress={() => setActiveCategory(category)}
        >
          <Text
            style={[
              styles.categoryTabText,
              activeCategory === category && styles.activeCategoryTabText,
            ]}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSuggestions = () => (
    <View style={styles.suggestionsContainer}>
      <View style={styles.suggestionsGrid}>
        {INGREDIENT_SUGGESTIONS[activeCategory].map(suggestion => (
          <TouchableOpacity
            key={suggestion.id}
            style={[
              styles.suggestionChip,
              preferences.favoriteIngredients.includes(suggestion.name) && styles.favoriteSuggestion,
              preferences.dislikedIngredients.includes(suggestion.name) && styles.dislikedSuggestion,
            ]}
            onPress={() => {
              if (!preferences.favoriteIngredients.includes(suggestion.name) &&
                  !preferences.dislikedIngredients.includes(suggestion.name)) {
                addFavorite(suggestion.name);
              }
            }}
            onLongPress={() => {
              if (!preferences.favoriteIngredients.includes(suggestion.name) &&
                  !preferences.dislikedIngredients.includes(suggestion.name)) {
                addDisliked(suggestion.name);
              }
            }}
          >
            <Text
              style={[
                styles.suggestionText,
                (preferences.favoriteIngredients.includes(suggestion.name) ||
                 preferences.dislikedIngredients.includes(suggestion.name)) && styles.selectedSuggestionText,
              ]}
            >
              {suggestion.name}
            </Text>
            {preferences.favoriteIngredients.includes(suggestion.name) && (
              <Icon name="heart" size={16} color="#D9A15B" style={styles.suggestionIcon} />
            )}
            {preferences.dislikedIngredients.includes(suggestion.name) && (
              <Icon name="close-circle" size={16} color="#B57A42" style={styles.suggestionIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCuisineSelection = () => (
    <View style={styles.cuisineSection}>
      <Text style={styles.cuisineTitle}>Favorite Cuisines</Text>
      <Text style={styles.cuisineDescription}>
        Select the cuisines you enjoy the most.
      </Text>
      <View style={styles.cuisineGrid}>
        {COMMON_CUISINES.map(cuisine => {
          const isSelected = preferences.favoriteCuisines?.includes(cuisine);
          return (
            <TouchableOpacity
              key={cuisine}
              style={[
                styles.cuisineChip,
                isSelected && styles.selectedCuisineChip,
              ]}
              onPress={() => toggleFavoriteCuisine(cuisine)}
            >
              <Text
                style={[
                  styles.cuisineChipText,
                  isSelected && styles.selectedCuisineChipText,
                ]}
              >
                {cuisine}
              </Text>
              {isSelected && <Icon name="checkmark-circle" size={16} color="#fff" style={styles.cuisineIcon} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const handleContinue = async () => {
    // Convert extended preferences back to FoodPreferences format
    const foodPreferences: FoodPreferences = {
      ...preferences,
      preferredCuisines: preferences.favoriteCuisines,
    };
    const success = await saveFoodPreferences(foodPreferences);
    if (success) {
      if (isFromProfile) {
        navigation.goBack();
      } else {
        navigation.navigate('CookingHabits', { fromProfile: false });
      }
    } else {
      Alert.alert(
        'Error',
        'Failed to save preferences. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D9A15B" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <BackButton onPress={isFromProfile ? () => navigation.goBack() : undefined} />
        </View>

        <Text style={styles.title}>Food Preferences</Text>
        <Text style={styles.subtitle}>
          Select your favorite cuisines, ingredients, and those you'd rather avoid.
        </Text>

        {/* Cuisine Selection */}
        {renderCuisineSelection()}

        {/* Ingredient Selection */}
        <View style={styles.mainSection}>
          <Text style={styles.mainSectionTitle}>Common Ingredients</Text>
          <Text style={styles.mainSectionDescription}>
            Tap an ingredient to add to favorites, long press to add to avoided ingredients
          </Text>
          {renderCategoryTabs()}
          {renderSuggestions()}
        </View>

        <View style={styles.selectedSection}>
          <View style={styles.selectedCategory}>
            <Text style={styles.selectedTitle}>Favorite Ingredients</Text>
            <View style={styles.selectedTags}>
              {preferences.favoriteIngredients.map(ingredient => (
                <TouchableOpacity
                  key={ingredient}
                  style={[styles.selectedTag, styles.favoriteTag]}
                  onPress={() => removeFavorite(ingredient)}
                >
                  <Text style={styles.selectedTagText}>{ingredient}</Text>
                  <Icon name="close" size={16} color="#D9A15B" />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={favoriteInput}
                onChangeText={setFavoriteInput}
                placeholder="Add a favorite ingredient..."
                placeholderTextColor="#7A736A"
                onSubmitEditing={() => addFavorite(favoriteInput)}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addButton, styles.favoriteAddButton]}
                onPress={() => addFavorite(favoriteInput)}
              >
                <Icon name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.selectedCategory}>
            <Text style={styles.selectedTitle}>Avoided Ingredients</Text>
            <View style={styles.selectedTags}>
              {preferences.dislikedIngredients.map(ingredient => (
                <TouchableOpacity
                  key={ingredient}
                  style={[styles.selectedTag, styles.dislikedTag]}
                  onPress={() => removeDisliked(ingredient)}
                >
                  <Text style={styles.selectedTagText}>{ingredient}</Text>
                  <Icon name="close" size={16} color="#B57A42" />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={dislikedInput}
                onChangeText={setDislikedInput}
                placeholder="Add an ingredient to avoid..."
                placeholderTextColor="#7A736A"
                onSubmitEditing={() => addDisliked(dislikedInput)}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addButton, styles.dislikedAddButton]}
                onPress={() => addDisliked(dislikedInput)}
              >
                <Icon name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <LinearGradient
            colors={['#D9A15B', '#B57A42']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.buttonText}>{isFromProfile ? 'Save Changes' : 'Continue'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F1',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#4E4E4E',
  },
  subtitle: {
    fontSize: 16,
    color: '#7A736A',
    marginBottom: 24,
  },
  cuisineSection: {
    marginBottom: 24,
    backgroundColor: '#F5EFE6',
    borderRadius: 12,
    padding: 16,
  },
  cuisineTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#4E4E4E',
  },
  cuisineDescription: {
    fontSize: 14,
    color: '#7A736A',
    marginBottom: 16,
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  cuisineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFE7DD',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
  },
  selectedCuisineChip: {
    backgroundColor: '#D9A15B',
  },
  cuisineChipText: {
    fontSize: 14,
    color: '#4E4E4E',
    marginRight: 4,
  },
  selectedCuisineChipText: {
    color: '#fff',
  },
  cuisineIcon: {
    marginLeft: 4,
  },
  mainSection: {
    marginBottom: 24,
    backgroundColor: '#F5EFE6',
    borderRadius: 12,
    padding: 16,
  },
  mainSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#4E4E4E',
  },
  mainSectionDescription: {
    fontSize: 14,
    color: '#7A736A',
    marginBottom: 16,
  },
  categoryTabs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#EFE7DD',
  },
  activeCategoryTab: {
    backgroundColor: '#D9A15B',
  },
  categoryTabText: {
    color: '#7A736A',
  },
  activeCategoryTabText: {
    color: '#fff',
  },
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -4,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFE7DD',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
    minWidth: 100,
  },
  suggestionText: {
    fontSize: 14,
    color: '#4E4E4E',
    marginRight: 4,
  },
  suggestionIcon: {
    marginLeft: 4,
  },
  selectedSuggestionText: {
    color: '#4E4E4E',
  },
  selectedSection: {
    marginTop: 24,
  },
  selectedCategory: {
    marginBottom: 24,
    backgroundColor: '#F5EFE6',
    borderRadius: 12,
    padding: 16,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E4E4E',
    marginBottom: 8,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  selectedTagText: {
    fontSize: 14,
    marginRight: 4,
    color: '#4E4E4E',
  },
  favoriteTag: {
    backgroundColor: '#EFE7DD',
    borderColor: '#D9A15B',
    borderWidth: 1,
  },
  dislikedTag: {
    backgroundColor: '#EFE7DD',
    borderColor: '#B57A42',
    borderWidth: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DED3',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    fontSize: 14,
    color: '#4E4E4E',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteAddButton: {
    backgroundColor: '#D9A15B',
  },
  dislikedAddButton: {
    backgroundColor: '#B57A42',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E6DED3',
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF6F1',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7A736A',
  },
  favoriteSuggestion: {
    backgroundColor: '#EFE7DD',
    borderColor: '#D9A15B',
    borderWidth: 1,
  },
  dislikedSuggestion: {
    backgroundColor: '#EFE7DD',
    borderColor: '#B57A42',
    borderWidth: 1,
  },
} as const); 