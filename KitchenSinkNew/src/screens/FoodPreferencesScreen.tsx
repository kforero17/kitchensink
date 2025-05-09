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
  CUISINE_OPTIONS,
} from '../types/FoodPreferences';
import { getFoodPreferences, saveFoodPreferences } from '../utils/preferences';
import { BackButton } from '../components/BackButton';
import { useRoute } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'FoodPreferences'>;

export const FoodPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const isFromProfile = (route.params && 'fromProfile' in route.params) ? (route.params as any).fromProfile === true : false;
  
  const [preferences, setPreferences] = useState<FoodPreferences>({
    favoriteIngredients: [],
    dislikedIngredients: [],
    preferredCuisines: [],
    allergies: [],
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
      const defaultPreferences: FoodPreferences = {
        favoriteIngredients: [],
        dislikedIngredients: [],
        preferredCuisines: [],
        allergies: [],
      };
      if (savedPreferences) {
        setPreferences({
          ...defaultPreferences,
          ...savedPreferences,
          favoriteIngredients: Array.isArray(savedPreferences.favoriteIngredients) ? savedPreferences.favoriteIngredients : [],
          dislikedIngredients: Array.isArray(savedPreferences.dislikedIngredients) ? savedPreferences.dislikedIngredients : [],
          preferredCuisines: Array.isArray(savedPreferences.preferredCuisines) ? savedPreferences.preferredCuisines : [],
          allergies: Array.isArray(savedPreferences.allergies) ? savedPreferences.allergies : [],
        });
      } else {
        setPreferences(defaultPreferences);
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to load saved preferences.',
        [{ text: 'OK' }]
      );
      setPreferences({
        favoriteIngredients: [],
        dislikedIngredients: [],
        preferredCuisines: [],
        allergies: [],
      });
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

  const toggleCuisine = (cuisineId: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredCuisines: prev.preferredCuisines.includes(cuisineId)
        ? prev.preferredCuisines.filter(id => id !== cuisineId)
        : [...prev.preferredCuisines, cuisineId],
    }));
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
              <Icon name="heart" size={16} color="#007AFF" style={styles.suggestionIcon} />
            )}
            {preferences.dislikedIngredients.includes(suggestion.name) && (
              <Icon name="close-circle" size={16} color="#FF3B30" style={styles.suggestionIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const handleContinue = async () => {
    try {
      const success = await saveFoodPreferences(preferences);
      if (success) {
        if (isFromProfile) {
          navigation.navigate('Profile');
        } else {
          navigation.navigate('CookingHabits', { fromProfile: isFromProfile });
        }
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
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
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <BackButton onPress={isFromProfile ? () => navigation.navigate('Profile') : undefined} />
        </View>

        <Text style={styles.title}>Food Preferences</Text>
        <Text style={styles.subtitle}>
          Tell us about your favorite ingredients and those you'd rather avoid
        </Text>

        {/* Preferred Cuisines Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Cuisines</Text>
          <Text style={styles.sectionDescription}>
            Select the cuisines you enjoy most (optional)
          </Text>
          <View style={styles.cuisineGrid}>
            {CUISINE_OPTIONS.map((cuisine: { id: string; name: string }) => (
              <TouchableOpacity
                key={cuisine.id}
                style={[
                  styles.cuisineChip,
                  preferences.preferredCuisines.includes(cuisine.id) && styles.selectedCuisineChip,
                ]}
                onPress={() => toggleCuisine(cuisine.id)}
              >
                <Text
                  style={[
                    styles.cuisineText,
                    preferences.preferredCuisines.includes(cuisine.id) && styles.selectedCuisineText,
                  ]}
                >
                  {cuisine.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Common Ingredients Section */}
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
                  <Icon name="close" size={16} color="#007AFF" />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={favoriteInput}
                onChangeText={setFavoriteInput}
                placeholder="Add a favorite ingredient..."
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
                  <Icon name="close" size={16} color="#FF3B30" />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={dislikedInput}
                onChangeText={setDislikedInput}
                placeholder="Add an ingredient to avoid..."
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
            colors={['#007AFF', '#0055FF']}
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
    backgroundColor: '#fff',
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
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    fontSize: 14,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteAddButton: {
    backgroundColor: '#007AFF',
  },
  dislikedAddButton: {
    backgroundColor: '#FF3B30',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  favoriteTag: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  dislikedTag: {
    backgroundColor: '#FFE5E5',
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  tagText: {
    marginRight: 4,
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
    backgroundColor: '#f0f0f0',
  },
  activeCategoryTab: {
    backgroundColor: '#007AFF',
  },
  categoryTabText: {
    color: '#666',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
    minWidth: 100,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    marginRight: 4,
  },
  suggestionIcon: {
    marginLeft: 4,
  },
  selectedSuggestionText: {
    color: '#333',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  selectedSection: {
    marginTop: 24,
  },
  selectedCategory: {
    marginBottom: 16,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  mainSection: {
    marginTop: 24,
  },
  mainSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  mainSectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  favoriteSuggestion: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  dislikedSuggestion: {
    backgroundColor: '#FFE5E5',
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 8,
  },
  cuisineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCuisineChip: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  cuisineText: {
    fontSize: 14,
    color: '#333',
  },
  selectedCuisineText: {
    color: '#fff',
  },
} as const); 