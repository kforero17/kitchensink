import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { BackButton } from '../components/BackButton';
import { useRoute, RouteProp } from '@react-navigation/native';
import {
  CookingPreferences,
  PreferenceOption,
  COOKING_FREQUENCY_OPTIONS,
  COOKING_DURATION_OPTIONS,
  COOKING_SKILL_OPTIONS,
  MEAL_TYPE_OPTIONS,
  CookingFrequency,
  CookingDuration,
  CookingSkillLevel,
  MealType,
} from '../types/CookingPreferences';
import { saveCookingPreferences, getCookingPreferences } from '../utils/preferences';

type Props = NativeStackScreenProps<RootStackParamList, 'CookingHabits'>;
type CookingHabitsRouteProp = RouteProp<RootStackParamList, 'CookingHabits'>;

export const CookingHabitsScreen: React.FC<Props> = ({ navigation }: Props) => {
  const route = useRoute<CookingHabitsRouteProp>();
  const isFromProfile = route.params?.fromProfile === true;
  const [isLoading, setIsLoading] = useState(true);
  
  const [preferences, setPreferences] = useState<CookingPreferences>({
    cookingFrequency: 'few_times_week',
    preferredCookingDuration: 'under_30_min',
    skillLevel: 'intermediate',
    mealTypes: ['dinner'],
    servingSizePreference: 2,
    weeklyMealPrepCount: 3,
    householdSize: 2,
  });

  // Load existing preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedPrefs = await getCookingPreferences();
      if (savedPrefs) {
        setPreferences(savedPrefs);
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

  const handleOptionSelect = <T extends string>(
    key: keyof CookingPreferences,
    value: T
  ) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleMealTypeToggle = (mealType: MealType) => {
    setPreferences(prev => ({
      ...prev,
      mealTypes: prev.mealTypes.includes(mealType)
        ? prev.mealTypes.filter(type => type !== mealType)
        : [...prev.mealTypes, mealType],
    }));
  };

  const renderPreferenceOptions = <T extends string>(
    options: PreferenceOption<T>[],
    selectedValue: T,
    onSelect: (value: T) => void
  ) => {
    return options.map(option => (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.optionCard,
          selectedValue === option.value && styles.selectedOption,
        ]}
        onPress={() => onSelect(option.value)}
      >
        <Icon
          name={option.icon || 'checkmark'}
          size={24}
          color={selectedValue === option.value ? '#D9A15B' : '#7A736A'}
        />
        <View style={styles.optionTextContainer}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
      </TouchableOpacity>
    ));
  };

  const renderMealTypeOptions = () => {
    return MEAL_TYPE_OPTIONS.map(option => (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.optionCard,
          preferences.mealTypes.includes(option.value) && styles.selectedOption,
        ]}
        onPress={() => handleMealTypeToggle(option.value)}
      >
        <Icon
          name={option.icon || 'checkmark'}
          size={24}
          color={preferences.mealTypes.includes(option.value) ? '#D9A15B' : '#7A736A'}
        />
        <View style={styles.optionTextContainer}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
      </TouchableOpacity>
    ));
  };

  const handleContinue = async () => {
    try {
      const success = await saveCookingPreferences(preferences);
      if (success) {
        if (isFromProfile) {
          navigation.goBack();
        } else {
          navigation.navigate('BudgetPreferences', { fromProfile: isFromProfile });
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
        <Text style={styles.title}>Cooking Habits</Text>
        <Text style={styles.subtitle}>
          Tell us about your cooking style and preferences
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How often do you cook?</Text>
          {renderPreferenceOptions(
            COOKING_FREQUENCY_OPTIONS,
            preferences.cookingFrequency,
            value => handleOptionSelect('cookingFrequency', value)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred cooking duration</Text>
          {renderPreferenceOptions(
            COOKING_DURATION_OPTIONS,
            preferences.preferredCookingDuration,
            value => handleOptionSelect('preferredCookingDuration', value)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooking skill level</Text>
          {renderPreferenceOptions(
            COOKING_SKILL_OPTIONS,
            preferences.skillLevel,
            value => handleOptionSelect('skillLevel', value)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Which meals do you want to cook?</Text>
          <Text style={styles.sectionSubtitle}>Select all that apply</Text>
          {renderMealTypeOptions()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Household size</Text>
          <Text style={styles.sectionSubtitle}>How many people are you cooking for?</Text>
          <View style={styles.numberInput}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  householdSize: Math.max(1, prev.householdSize - 1),
                }))
              }
            >
              <Icon name="remove" size={24} color="#D9A15B" />
            </TouchableOpacity>
            <Text style={styles.numberValue}>
              {preferences.householdSize} {preferences.householdSize === 1 ? 'person' : 'people'}
            </Text>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  householdSize: prev.householdSize + 1,
                }))
              }
            >
              <Icon name="add" size={24} color="#D9A15B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serving size preference</Text>
          <Text style={styles.sectionSubtitle}>Servings per recipe</Text>
          <View style={styles.numberInput}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  servingSizePreference: Math.max(1, prev.servingSizePreference - 1),
                }))
              }
            >
              <Icon name="remove" size={24} color="#D9A15B" />
            </TouchableOpacity>
            <Text style={styles.numberValue}>
              {preferences.servingSizePreference} servings
            </Text>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  servingSizePreference: prev.servingSizePreference + 1,
                }))
              }
            >
              <Icon name="add" size={24} color="#D9A15B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly meal prep count</Text>
          <Text style={styles.sectionSubtitle}>How many meals do you want to prep weekly?</Text>
          <View style={styles.numberInput}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  weeklyMealPrepCount: Math.max(0, prev.weeklyMealPrepCount - 1),
                }))
              }
            >
              <Icon name="remove" size={24} color="#D9A15B" />
            </TouchableOpacity>
            <Text style={styles.numberValue}>
              {preferences.weeklyMealPrepCount} meals
            </Text>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  weeklyMealPrepCount: prev.weeklyMealPrepCount + 1,
                }))
              }
            >
              <Icon name="add" size={24} color="#D9A15B" />
            </TouchableOpacity>
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
    padding: 16,
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
  section: {
    marginBottom: 24,
    backgroundColor: '#F5EFE6',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#4E4E4E',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#7A736A',
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#EFE7DD',
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#D9A15B',
  },
  optionTextContainer: {
    marginLeft: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#4E4E4E',
  },
  optionDescription: {
    fontSize: 14,
    color: '#7A736A',
  },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE7DD',
    borderRadius: 12,
    padding: 8,
  },
  numberButton: {
    padding: 8,
  },
  numberValue: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    color: '#4E4E4E',
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
}); 