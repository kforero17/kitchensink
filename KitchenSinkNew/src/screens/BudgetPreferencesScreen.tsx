import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  BudgetPreferences,
  PreferenceOption,
  BUDGET_FREQUENCY_OPTIONS,
  BudgetFrequency,
} from '../types/BudgetPreferences';
import { saveBudgetPreferences } from '../utils/preferences';
import { BackButton } from '../components/BackButton';

type Props = NativeStackScreenProps<RootStackParamList, 'BudgetPreferences'>;

export const BudgetPreferencesScreen: React.FC<Props> = ({ navigation }) => {
  const [preferences, setPreferences] = useState<BudgetPreferences>({
    amount: 0,
    frequency: 'weekly',
  });

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
          color={preferences.frequency === option.value ? '#007AFF' : '#666'}
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
      await saveBudgetPreferences(preferences);
      navigation.navigate('LoadingMealPlan');
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to save preferences. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <BackButton />
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
            colors={['#007AFF', '#0055FF']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.buttonText}>Generate Meal Plan</Text>
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  helper: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    color: '#666',
    marginRight: 4,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: '#e3f2fd',
  },
  optionTextContainer: {
    marginLeft: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
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
}); 