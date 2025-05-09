import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('DietaryPreferences');
    }
  };

  const handleGenerateMealPlan = () => {
    navigation.navigate('LoadingMealPlan');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Kitchen Sink</Text>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('GroceryList', { selectedRecipes: [] })}
          >
            <MaterialCommunityIcons name="cart-outline" size={24} color="#333" />
            <Text style={styles.quickActionText}>Grocery List</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <MaterialCommunityIcons name="account-outline" size={24} color="#333" />
            <Text style={styles.quickActionText}>Profile</Text>
          </TouchableOpacity>
        </View>

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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    paddingBottom: 48,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
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
  header: {
    padding: 20,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  quickActionText: {
    marginLeft: 10,
  },
});

export default HomeScreen;