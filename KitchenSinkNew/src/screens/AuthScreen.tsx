import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AuthPrompt from '../components/AuthPrompt';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const [showPrompt, setShowPrompt] = useState(true);

  const handlePromptClose = () => {
    setShowPrompt(false);
    navigation.goBack();
  };

  return (
    <AuthPrompt
      visible={showPrompt}
      onClose={handlePromptClose}
    />
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: '#2C2C2C',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#454545',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  benefitsSection: {
    marginBottom: 40,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  benefitText: {
    fontSize: 16,
    color: '#4E4E4E',
    marginLeft: 16,
    fontWeight: '500',
  },
  buttonsSection: {
    gap: 16,
  },
  primaryButtonWrapper: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  primaryButton: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 32,
    backgroundColor: '#C4B5A4',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
  },
});

export default AuthScreen; 