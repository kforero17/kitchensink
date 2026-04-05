import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from 'react-native';
import { networkService } from '../utils/networkService';
import { ENV } from '../config/environment';
import * as cryptoWrapper from '../utils/cryptoWrapper';
import * as expoCrypto from 'expo-crypto';
import firestore from '@react-native-firebase/firestore';

const DebugScreen: React.FC = () => {
  const [results, setResults] = useState<Array<{test: string, status: 'success' | 'failure' | 'pending', message: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Run basic connectivity test when the screen loads
  useEffect(() => {
    checkBasicConnectivity();
  }, []);

  const addResult = (test: string, status: 'success' | 'failure' | 'pending', message: string) => {
    setResults(prev => [
      { test, status, message },
      ...prev
    ]);
  };

  const resetResults = () => {
    setResults([]);
  };

  const checkBasicConnectivity = async () => {
    resetResults();
    setIsLoading(true);

    addResult('Basic internet connectivity', 'pending', 'Testing connection to jsonplaceholder.typicode.com...');

    try {
      const isConnected = await networkService.checkConnectivity();

      if (isConnected) {
        addResult('Basic internet connectivity', 'success', 'Successfully connected to the internet.');
      } else {
        addResult('Basic internet connectivity', 'failure', 'Failed to connect to the internet. Check your network connection.');
      }
    } catch (error) {
      addResult('Basic internet connectivity', 'failure', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testFirestoreRecipes = async () => {
    resetResults();
    setIsLoading(true);

     addResult('Firestore access', 'pending', 'Fetching 5 docs from collection "recipes"...');

     try {
       const snapshot = await firestore().collection('recipes').limit(5).get();
       if (snapshot.empty) {
         addResult('Firestore access', 'failure', 'Collection "recipes" returned 0 documents');
       } else {
         const sampleNames = snapshot.docs.map(d => d.get('name') || d.id).join(', ');
         addResult('Firestore access', 'success', `Fetched ${snapshot.size} docs. Sample: ${sampleNames}`);
       }
     } catch (err: any) {
       addResult('Firestore access', 'failure', `Error: ${err.message ?? err.toString()}`);
     } finally {
       setIsLoading(false);
     }
   };

  const checkCryptoModule = async () => {
    resetResults();
    addResult('Crypto Module Check', 'pending', 'Checking crypto module availability...');

    try {
      // Check if the wrapper is loaded
      if (cryptoWrapper && typeof cryptoWrapper.md5 === 'function') {
        addResult('Crypto Module Check', 'success', 'cryptoWrapper is loaded and md5 function is available.');
      } else {
        addResult('Crypto Module Check', 'failure', 'cryptoWrapper or md5 function is not available.');
      }

      // Check for expo-crypto directly
      if (expoCrypto && typeof expoCrypto.digestStringAsync === 'function') {
        addResult('expo-crypto Direct Check', 'success', 'expo-crypto.digestStringAsync is available.');
      } else {
        addResult('expo-crypto Direct Check', 'failure', 'expo-crypto.digestStringAsync is not available.');
      }
    } catch (error) {
      addResult('Crypto Module Check', 'failure', `Error checking crypto module: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const collectEnvironmentInfo = () => {
    addResult('Environment Variables', 'pending', 'Collecting environment information...');

    const envInfo = {
      platform: Platform.OS,
      isDev: __DEV__,
      tastyFunctionUrl: ENV.TASTY_FUNCTION_URL,
    };

    addResult('Environment Variables', 'success',
      `Platform: ${envInfo.platform}\n` +
      `Tasty Function URL: ${envInfo.tastyFunctionUrl}\n` +
      `Development mode: ${envInfo.isDev ? 'Yes' : 'No'}`
    );
  };

  const runComprehensiveDiagnostics = async () => {
    resetResults();
    setIsLoading(true);

    addResult('Comprehensive Diagnostics', 'pending', 'Starting comprehensive diagnostics...');

    // Run tests in sequence for better readability in logs
    await checkBasicConnectivity();
    collectEnvironmentInfo();
    await checkCryptoModule();
    await testFirestoreRecipes();

    addResult('Comprehensive Diagnostics', 'success', 'Completed comprehensive diagnostics');
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Network Diagnostics</Text>
          <Text style={styles.headerSubtitle}>
            Debug network connectivity and Firebase access
          </Text>
        </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={runComprehensiveDiagnostics}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Run Comprehensive Diagnostics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
            onPress={checkBasicConnectivity}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Check Basic Connectivity</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
            onPress={testFirestoreRecipes}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Test Firestore "recipes" Access</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
            onPress={checkCryptoModule}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Check Crypto Module</Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Running tests...</Text>
          </View>
        )}

        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Diagnostic Results</Text>

          {results.length === 0 ? (
            <Text style={styles.noResultsText}>No tests have been run yet</Text>
          ) : (
            results.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>{result.test}</Text>
                  <View style={[
                    styles.statusBadge,
                    result.status === 'success' ? styles.successBadge :
                    result.status === 'failure' ? styles.failureBadge :
                    styles.pendingBadge
                  ]}>
                    <Text style={styles.statusText}>
                      {result.status === 'success' ? 'PASS' :
                       result.status === 'failure' ? 'FAIL' :
                       'RUNNING'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.resultMessage}>{result.message}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.environmentInfo}>
          <Text style={styles.environmentTitle}>Environment Information</Text>
          <Text style={styles.environmentItem}>Platform: {Platform.OS} {Platform.Version}</Text>
          <Text style={styles.environmentItem}>Allow Insecure Connections: {ENV.ALLOW_INSECURE_CONNECTIONS ? 'Yes' : 'No'}</Text>
          <Text style={styles.environmentItem}>API Timeout: {ENV.API_TIMEOUT_MS}ms</Text>
          <Text style={styles.environmentItem}>Tasty Function URL: {ENV.TASTY_FUNCTION_URL}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  buttonContainer: {
    padding: 20,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  button: {
    backgroundColor: '#6c757d',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonPrimary: {
    backgroundColor: '#007bff',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6c757d',
  },
  resultsContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    margin: 20,
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#212529',
  },
  noResultsText: {
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  resultItem: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 15,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  successBadge: {
    backgroundColor: '#d4edda',
  },
  failureBadge: {
    backgroundColor: '#f8d7da',
  },
  pendingBadge: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultMessage: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  environmentInfo: {
    margin: 20,
    padding: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
  },
  environmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#212529',
  },
  environmentItem: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 5,
  },
});

export default DebugScreen;
