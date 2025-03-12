import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, hasCompletedOnboarding } = useAuth();
  
  // Auto-navigate to Profile if user is logged in
  useEffect(() => {
    if (user) {
      // If user is logged in, show a brief welcome and navigate to Profile
      const timer = setTimeout(() => {
        navigation.navigate('Profile');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, navigation]);
  
  const handleGetStarted = () => {
    console.log('Attempting to navigate to DietaryPreferences');
    navigation.navigate('DietaryPreferences');
    console.log('Navigation called');
  };

  const handleGenerateMealPlan = () => {
    // If user hasn't completed onboarding, start the onboarding flow
    if (!hasCompletedOnboarding) {
      navigation.navigate('DietaryPreferences');
    } else {
      navigation.navigate('LoadingMealPlan');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#ffffff', '#f8f9fa']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>KitchenSink</Text>
            <Text style={styles.tagline}>Simplify your meal planning</Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#007AFF', '#0055FF']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Meal Plan button */}
            <TouchableOpacity
              style={[styles.button, styles.buttonSpacing]}
              onPress={handleGenerateMealPlan}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#9C27B0', '#673AB7']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>Generate Meal Plan</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Pantry button */}
            <TouchableOpacity
              style={[styles.button, styles.buttonSpacing]}
              onPress={() => navigation.navigate('Pantry')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4CAF50', '#8BC34A']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>Manage Pantry</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Profile button */}
            <TouchableOpacity
              style={[styles.button, styles.buttonSpacing]}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF9800', '#FF5722']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>{user ? 'My Profile' : 'Sign In'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Debug button */}
            <TouchableOpacity
              style={[styles.button, styles.buttonSpacing]}
              onPress={() => navigation.navigate('Debug')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#607D8B', '#455A64']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>Network Debug</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Test Picker button */}
            <TouchableOpacity
              style={[styles.button, styles.buttonSpacing]}
              onPress={() => navigation.navigate('TestPicker')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#9C27B0', '#673AB7']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.buttonText}>Test Picker</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: 48,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 20,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '400',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonSpacing: {
    marginTop: 12,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  debugButton: {
    marginTop: 10,
  },
  pantryButton: {
    marginTop: 10,
  },
});