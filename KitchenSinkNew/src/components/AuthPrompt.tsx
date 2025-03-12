import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AuthPromptProps {
  visible: boolean;
  onClose: () => void;
}

const AuthPrompt: React.FC<AuthPromptProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<NavigationProp>();
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const handleLoginPress = () => {
    setShowAuthModal(true);
  };
  
  const handleSkip = () => {
    onClose();
    navigation.navigate('Home');
  };
  
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    onClose();
    navigation.navigate('Profile');
  };
  
  const handleAuthModalClose = () => {
    setShowAuthModal(false);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <MaterialCommunityIcons name="account-circle" size={60} color="#007AFF" style={styles.icon} />
          
          <Text style={styles.title}>Create Your Account</Text>
          
          <Text style={styles.description}>
            Sign up to save your meal plans, grocery lists, and preferences. Your account enables you to:
          </Text>
          
          <ScrollView style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#34C759" />
              <Text style={styles.benefitText}>Save your meal plans and recipe history</Text>
            </View>
            
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#34C759" />
              <Text style={styles.benefitText}>Track your pantry ingredients</Text>
            </View>
            
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#34C759" />
              <Text style={styles.benefitText}>Keep a history of your grocery lists</Text>
            </View>
            
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#34C759" />
              <Text style={styles.benefitText}>Manage your dietary preferences</Text>
            </View>
            
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#34C759" />
              <Text style={styles.benefitText}>Access your data across devices</Text>
            </View>
          </ScrollView>
          
          <TouchableOpacity
            style={styles.createAccountButton}
            onPress={handleLoginPress}
          >
            <Text style={styles.createAccountButtonText}>Create Account</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <AuthModal 
        visible={showAuthModal} 
        onClose={handleAuthModalClose}
        onSuccess={handleAuthSuccess}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxHeight: '80%',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsList: {
    maxHeight: 200,
    width: '100%',
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  createAccountButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  createAccountButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default AuthPrompt; 