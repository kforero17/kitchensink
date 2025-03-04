import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ENV } from '../config/environment';

/**
 * Simple component that makes a direct API call without any complex wrappers
 * Useful for testing if the API connectivity issues are with our code or React Native itself
 */
const DirectApiTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'success' | 'failure' | null>(null);

  const runDirectTest = async () => {
    setIsLoading(true);
    setResult('');
    setStatus(null);

    try {
      // Build URL directly without any helpers
      const apiKey = ENV.SPOONACULAR_API_KEY;
      const baseUrl = ENV.SPOONACULAR_BASE_URL;
      const endpoint = '/food/ingredients/search';
      const url = `${baseUrl}${endpoint}?apiKey=${apiKey}&query=apple&number=1`;

      console.log('Testing direct API call to:', url);

      // Make a direct fetch call with minimal options
      const response = await fetch(url);
      
      if (response.ok) {
        // Try to parse JSON response
        const data = await response.json();
        setResult(`Success!\nStatus: ${response.status}\nData: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
        setStatus('success');
      } else {
        setResult(`API error: ${response.status} ${response.statusText}`);
        setStatus('failure');
      }
    } catch (error: any) {
      setResult(`Error: ${error.message || 'Unknown error'}`);
      setStatus('failure');
      console.error('Direct API test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Direct API Test</Text>
      <Text style={styles.description}>
        This test bypasses all our wrappers and makes a direct fetch call to the API
      </Text>

      <TouchableOpacity 
        style={styles.button} 
        onPress={runDirectTest}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>Run Direct API Test</Text>
      </TouchableOpacity>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Testing API...</Text>
        </View>
      )}

      {result ? (
        <View style={[
          styles.resultContainer, 
          status === 'success' ? styles.successContainer : styles.errorContainer
        ]}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    color: '#6c757d',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#17a2b8',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#6c757d',
  },
  resultContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 4,
  },
  successContainer: {
    backgroundColor: '#d4edda',
  },
  errorContainer: {
    backgroundColor: '#f8d7da',
  },
  resultText: {
    fontSize: 14,
  },
});

export default DirectApiTest; 