import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getDietaryPreferences, saveDietaryPreferences } from '../utils/preferences';
import { DietaryPreferences } from '../types/DietaryPreferences';

type Props = NativeStackScreenProps<RootStackParamList, 'DietaryPreferences'>;

export const DietaryPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const [preferences, setPreferences] = useState<DietaryPreferences>({
    vegan: false,
    vegetarian: false,
    glutenFree: false,
    dairyFree: false,
    nutFree: false,
    lowCarb: false,
    allergies: [],
    restrictions: []
  });
  const [allergyInput, setAllergyInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSavedPreferences();
  }, []);

  const loadSavedPreferences = async () => {
    try {
      const savedPreferences = await getDietaryPreferences();
      if (savedPreferences) {
        setPreferences(savedPreferences);
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

  const togglePreference = (key: keyof Omit<DietaryPreferences, 'allergies' | 'restrictions'>) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const addAllergy = () => {
    if (allergyInput.trim() && !preferences.allergies.includes(allergyInput.trim())) {
      setPreferences(prev => ({
        ...prev,
        allergies: [...prev.allergies, allergyInput.trim()],
      }));
      setAllergyInput('');
    }
  };

  const removeAllergy = (allergy: string) => {
    setPreferences(prev => ({
      ...prev,
      allergies: prev.allergies.filter(a => a !== allergy),
    }));
  };

  const handleContinue = async () => {
    try {
      const success = await saveDietaryPreferences(preferences);
      if (success) {
        navigation.navigate('FoodPreferences');
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save preferences';
      Alert.alert(
        'Error',
        `${errorMessage}. Please try again.`,
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
        <Text style={styles.title}>Dietary Preferences</Text>
        <Text style={styles.subtitle}>
          Help us personalize your recipe recommendations
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
          
          <View style={styles.option}>
            <Text style={styles.optionLabel}>Vegan</Text>
            <Switch
              value={preferences.vegan}
              onValueChange={() => togglePreference('vegan')}
            />
          </View>

          <View style={styles.option}>
            <Text style={styles.optionLabel}>Vegetarian</Text>
            <Switch
              value={preferences.vegetarian}
              onValueChange={() => togglePreference('vegetarian')}
            />
          </View>

          <View style={styles.option}>
            <Text style={styles.optionLabel}>Gluten Free</Text>
            <Switch
              value={preferences.glutenFree}
              onValueChange={() => togglePreference('glutenFree')}
            />
          </View>

          <View style={styles.option}>
            <Text style={styles.optionLabel}>Dairy Free</Text>
            <Switch
              value={preferences.dairyFree}
              onValueChange={() => togglePreference('dairyFree')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies</Text>
          <View style={styles.allergyInput}>
            <TextInput
              style={styles.input}
              value={allergyInput}
              onChangeText={setAllergyInput}
              placeholder="Enter an allergy..."
              onSubmitEditing={addAllergy}
            />
            <TouchableOpacity style={styles.addButton} onPress={addAllergy}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.allergies}>
            {preferences.allergies.map(allergy => (
              <View key={allergy} style={styles.allergyTag}>
                <Text>{allergy}</Text>
                <TouchableOpacity onPress={() => removeAllergy(allergy)}>
                  <Text style={styles.removeIcon}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
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
            <Text style={styles.buttonText}>Continue</Text>
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionLabel: {
    fontSize: 16,
  },
  allergyInput: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  allergies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  allergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
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
  removeIcon: {
    fontSize: 20,
    color: '#666',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
}); 