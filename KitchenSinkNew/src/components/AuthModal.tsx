import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle, forgotPassword } = useAuth();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      await signIn(email, password);
      resetForm();
      onSuccess();
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password);
      resetForm();
      onSuccess();
    } catch (error: any) {
      Alert.alert('Registration Error', error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(email);
      Alert.alert('Success', 'Password reset email sent. Please check your inbox.');
      setMode('signin');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      resetForm();
      onSuccess();
    } catch (error: any) {
      Alert.alert('Google Sign-In Error', error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.centeredView}
        >
          <View style={styles.modalView}>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </Text>
            
            <Text style={styles.subtitle}>
              {mode === 'signin' 
                ? 'Sign in to save your grocery lists and meal plans!' 
                : mode === 'signup' 
                  ? 'Create an account to save your preferences and meal plans' 
                  : 'Enter your email to receive a password reset link'}
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            
            {mode !== 'forgot' && (
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            )}
            
            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}
            
            {loading ? (
              <ActivityIndicator size="large" color="#0E7AFE" style={styles.loading} />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={
                    mode === 'signin'
                      ? handleSignIn
                      : mode === 'signup'
                      ? handleSignUp
                      : handleForgotPassword
                  }
                >
                  <Text style={styles.buttonText}>
                    {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
                  </Text>
                </TouchableOpacity>
                
                {mode !== 'forgot' && (
                  <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </TouchableOpacity>
                )}
                
                {mode === 'signin' && (
                  <View style={styles.optionsContainer}>
                    <TouchableOpacity onPress={() => setMode('signup')}>
                      <Text style={styles.linkText}>Create Account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setMode('forgot')}>
                      <Text style={styles.linkText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {mode === 'signup' && (
                  <TouchableOpacity onPress={() => setMode('signin')}>
                    <Text style={styles.linkText}>Already have an account? Sign In</Text>
                  </TouchableOpacity>
                )}
                
                {mode === 'forgot' && (
                  <TouchableOpacity onPress={() => setMode('signin')}>
                    <Text style={styles.linkText}>Back to Sign In</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity style={styles.skipButton} onPress={handleClose}>
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  primaryButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#0E7AFE',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButton: {
    width: '100%',
    height: 50,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  optionsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  linkText: {
    color: '#0E7AFE',
    fontSize: 16,
    marginTop: 20,
  },
  skipButton: {
    marginTop: 30,
  },
  skipButtonText: {
    color: 'gray',
    fontSize: 16,
  },
  loading: {
    marginVertical: 20,
  },
});

export default AuthModal; 