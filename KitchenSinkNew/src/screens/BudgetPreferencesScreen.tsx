import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useRoute, RouteProp } from '@react-navigation/native';
import {
  BudgetPreferences,
  PreferenceOption,
  BUDGET_FREQUENCY_OPTIONS,
  BudgetFrequency,
} from '../types/BudgetPreferences';
import { saveBudgetPreferences, getBudgetPreferences } from '../utils/preferences';
import { BackButton } from '../components/BackButton';

type Props = NativeStackScreenProps<RootStackParamList, 'BudgetPreferences'>;
type BudgetPreferencesRouteProp = RouteProp<RootStackParamList, 'BudgetPreferences'>;

export const BudgetPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const route = useRoute<BudgetPreferencesRouteProp>();
  const isFromProfile = route.params?.fromProfile === true;
  const [isLoading, setIsLoading] = useState(true);
  
  const [preferences, setPreferences] = useState<BudgetPreferences>({
    amount: 0,
    frequency: 'weekly',
  });

  // Load existing preferences
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedPrefs = await getBudgetPreferences();
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

  const handleFrequencySelect = (frequency: BudgetFrequency) => {
    setPreferences(prev => ({
      ...prev,
      frequency,
    }));
  };

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setPreferences(prev => ({
      ...prev,
      amount: numValue,
    }));
  };

  const renderFrequencyOptions = () => {
    return BUDGET_FREQUENCY_OPTIONS.map(option => (
      <TouchableOpacity
        key={option.value}
        style={[
          styles.optionCard,
          preferences.frequency === option.value && styles.selectedOption,
        ]}
        onPress={() => handleFrequencySelect(option.value)}
      >
        <Icon
          name={option.icon || 'checkmark'}
          size={24}
          color={preferences.frequency === option.value ? '#D9A15B' : '#7A736A'}
        />
        <View style={styles.optionTextContainer}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
      </TouchableOpacity>
    ));
  };

  const handleContinue = async () => {
    if (preferences.amount <= 0) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }

    try {
      const success = await saveBudgetPreferences(preferences);
      if (success) {
        if (isFromProfile) {
          navigation.goBack();
        } else {
          // This is the last step in the onboarding process
          navigation.navigate('LoadingMealPlan');
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

        <Text style={styles.title}>Budget Preferences</Text>
        <Text style={styles.subtitle}>
          Set your meal budget to help us plan affordable recipes
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Frequency</Text>
          {renderFrequencyOptions()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Amount</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.input}
              value={preferences.amount.toString()}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              placeholderTextColor="#7A736A"
              keyboardType="decimal-pad"
            />
          </View>
          <Text style={styles.helper}>
            Enter your {preferences.frequency} budget for meal planning
          </Text>
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
            <Text style={styles.buttonText}>
              {isFromProfile ? 'Save Changes' : 'Generate Meal Plan'}
            </Text>
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
  helper: {
    fontSize: 14,
    color: '#7A736A',
    marginTop: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6DED3',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#7A736A',
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#4E4E4E',
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