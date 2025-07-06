import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  StatusBar,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, hasCompletedOnboarding } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      if (hasCompletedOnboarding) {
        navigation.navigate('Profile');
      } else {
        navigation.navigate('DietaryPreferences');
      }
    } else {
      navigation.navigate('Auth');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ImageBackground
        source={require('../../assets/salad-bg.png')}
        style={styles.image}
        resizeMode="cover"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>KitchenSink</Text>
            <Text style={styles.tagline}>Simplify your meal planning</Text>
          </View>

          <TouchableOpacity
            onPress={handleGetStarted}
            activeOpacity={0.85}
            style={styles.buttonWrapper}
          >
            <View style={styles.button}>
              <Text style={styles.buttonText}>Get Started</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    alignItems: 'center',
    marginTop: '52%',
  },
  title: {
    fontSize: 42,
    fontWeight: '600',
    color: '#2C2C2C',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 20,
    color: '#454545',
    fontWeight: '400',
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: Platform.OS === 'ios' ? 8 : 16,
    paddingHorizontal: 16,
  },
  button: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 32,
    backgroundColor: '#C4B5A4',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
  },
});

export default HomeScreen;