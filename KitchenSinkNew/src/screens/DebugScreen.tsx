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
  Alert
} from 'react-native';
import { networkService } from '../utils/networkService';
import { ENV } from '../config/environment';
import { SPOONACULAR_CONFIG, createSpoonacularUrl } from '../config/spoonacular';
import DirectApiTest from '../components/DirectApiTest';
import { testSpoonacularWithCertificateBypass } from '../utils/certificateHelper';
import { isProxyAvailable, getProxiedUrl } from '../utils/proxyConfig';

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

  const testSpoonacularConnectivity = async () => {
    resetResults();
    setIsLoading(true);
    
    // Test 1: Basic connectivity
    addResult('Internet connectivity', 'pending', 'Testing basic internet connectivity...');
    try {
      const isConnected = await networkService.checkConnectivity();
      addResult(
        'Internet connectivity', 
        isConnected ? 'success' : 'failure',
        isConnected ? 'Internet is available' : 'No internet connection detected'
      );
    } catch (error) {
      addResult('Internet connectivity', 'failure', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test 2: API key check
    addResult('API Key check', 'pending', 'Checking if API key is configured...');
    if (SPOONACULAR_CONFIG.API_KEY) {
      const maskedKey = SPOONACULAR_CONFIG.API_KEY.substring(0, 4) + '...' + 
                        SPOONACULAR_CONFIG.API_KEY.substring(SPOONACULAR_CONFIG.API_KEY.length - 4);
      addResult('API Key check', 'success', `API key is configured (${maskedKey})`);
    } else {
      addResult('API Key check', 'failure', 'No API key found');
    }
    
    // Test 3: Spoonacular ping
    addResult('Spoonacular ping', 'pending', 'Testing connection to Spoonacular API...');
    try {
      // Simple ping to API (just to check connectivity)
      const pingUrl = createSpoonacularUrl('/food/ingredients/search', { query: 'apple', number: '1' });
      const response = await networkService.get(pingUrl, { 
        timeout: 10000,
        allowInsecure: true  // Enable insecure connections for testing
      });
      
      if (response.error) {
        addResult('Spoonacular ping', 'failure', `API responded with error: ${response.error}`);
      } else {
        addResult('Spoonacular ping', 'success', `Successfully connected to Spoonacular API (HTTP ${response.status})`);
      }
    } catch (error) {
      addResult('Spoonacular ping', 'failure', `Error connecting to Spoonacular: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test 4: Platform-specific configuration
    const platformInfo = `Platform: ${Platform.OS} (${Platform.Version})`;
    const secureConnections = ENV.ALLOW_INSECURE_CONNECTIONS ? 'Insecure connections allowed' : 'Only secure connections';
    
    addResult('Platform', 'success', `${platformInfo}, ${secureConnections}`);
    
    // iOS specific checks
    if (Platform.OS === 'ios') {
      addResult('iOS NSAllowsArbitraryLoads', 'pending', 'Checking Info.plist configuration...');
      
      // We can't directly check the Info.plist, but we can provide guidance
      addResult(
        'iOS NSAllowsArbitraryLoads', 
        'success', 
        'Ensure "NSAllowsArbitraryLoads" is set to true in Info.plist for development'
      );
    }
    
    setIsLoading(false);
  };

  const checkSSLConnection = async () => {
    resetResults();
    setIsLoading(true);
    
    // Check SSL connection to spoonacular
    addResult('SSL Connection Test', 'pending', 'Testing SSL connection to Spoonacular API...');
    
    try {
      // Create a simple URL - we'll just do a HEAD request to test connectivity
      const apiUrl = SPOONACULAR_CONFIG.BASE_URL;
      
      // First try with a direct fetch without our service to check basic connectivity
      try {
        const response = await fetch(apiUrl, { 
          method: 'HEAD',
          headers: { 'Accept': 'application/json' }
        });
        
        addResult(
          'Basic SSL Test', 
          'success', 
          `Direct fetch successful with status ${response.status}`
        );
      } catch (error: any) {
        addResult(
          'Basic SSL Test', 
          'failure', 
          `Direct fetch failed: ${error.message}`
        );
      }
      
      // Test with our network service
      const response = await networkService.fetch(apiUrl, { 
        method: 'HEAD', 
        allowInsecure: true 
      });
      
      if (response.error) {
        addResult(
          'SSL Connection Test', 
          'failure', 
          `SSL connection failed: ${response.error}`
        );
      } else {
        addResult(
          'SSL Connection Test', 
          'success', 
          `SSL connection successful with status: ${response.status}`
        );
      }
      
      // Show iOS-specific info
      if (Platform.OS === 'ios') {
        addResult(
          'iOS SSL Settings',
          'success',
          `NSAllowsArbitraryLoads should be set to TRUE in Info.plist.\nDomain exception for api.spoonacular.com should be configured.`
        );
        
        // Check if we can create a URL properly
        try {
          const url = createSpoonacularUrl('/ping');
          addResult(
            'URL Creation Test',
            'success',
            `URL successfully created: ${url}`
          );
        } catch (error: any) {
          addResult(
            'URL Creation Test',
            'failure',
            `URL creation failed: ${error.message}`
          );
        }
      }
    } catch (error: any) {
      addResult(
        'SSL Connection Test',
        'failure',
        `Unhandled error: ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const testCertificateBypass = async () => {
    resetResults();
    setIsLoading(true);
    
    addResult('Certificate Bypass Test', 'pending', 'Testing connection to Spoonacular API with certificate bypass...');
    
    try {
      const isConnected = await testSpoonacularWithCertificateBypass(SPOONACULAR_CONFIG.API_KEY);
      
      if (isConnected) {
        addResult('Certificate Bypass Test', 'success', 'Successfully connected using certificate bypass.');
      } else {
        addResult('Certificate Bypass Test', 'failure', 'Failed to connect even with certificate bypass. Check your network or API key.');
      }
    } catch (error) {
      addResult('Certificate Bypass Test', 'failure', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testProxyServer = async () => {
    resetResults();
    setIsLoading(true);
    
    addResult('Proxy Server Test', 'pending', 'Checking if proxy server is available...');
    
    try {
      const isAvailable = await isProxyAvailable();
      
      if (isAvailable) {
        addResult('Proxy Server Test', 'success', 'Proxy server is running and available!');
        
        // Test a simple API request through the proxy
        addResult('Proxy API Request', 'pending', 'Testing API request through proxy...');
        
        try {
          const originalUrl = `https://api.spoonacular.com/food/ingredients/search?apiKey=${SPOONACULAR_CONFIG.API_KEY}&query=apple&number=1`;
          const proxiedUrl = getProxiedUrl(originalUrl);
          
          const response = await fetch(proxiedUrl);
          
          if (response.ok) {
            const data = await response.json();
            addResult('Proxy API Request', 'success', 
              `Successfully retrieved data through proxy! Got ${data.results?.length || 0} results.`
            );
          } else {
            addResult('Proxy API Request', 'failure', 
              `Proxy request failed with status: ${response.status}`
            );
          }
        } catch (apiError: any) {
          addResult('Proxy API Request', 'failure', 
            `Error making proxy request: ${apiError.message}`
          );
        }
      } else {
        addResult('Proxy Server Test', 'failure', 
          'Proxy server is not available. Make sure to run "node proxy-server/server.js" first.'
        );
      }
    } catch (error) {
      addResult('Proxy Server Test', 'failure', 
        `Error checking proxy availability: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const testVpnCertificateInstall = async () => {
    resetResults();
    setIsLoading(true);
    
    addResult('VPN Certificate Test', 'pending', 'Testing if the corporate VPN certificate is properly installed...');
    
    try {
      // Try a direct fetch to a known HTTPS site
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      
      if (response.ok) {
        addResult('VPN Certificate Test', 'success', 
          'Basic HTTPS connection works correctly. VPN certificates may be properly installed.'
        );
      } else {
        addResult('VPN Certificate Test', 'failure', 
          `HTTPS connection failed with status: ${response.status}`
        );
      }
      
      // Try Spoonacular API directly with a simple query
      addResult('Spoonacular Direct Test', 'pending', 'Testing direct connection to Spoonacular API...');
      try {
        const url = `https://api.spoonacular.com/food/ingredients/search?apiKey=${SPOONACULAR_CONFIG.API_KEY}&query=apple&number=1`;
        const response = await fetch(url);
        
        if (response.ok) {
          addResult('Spoonacular Direct Test', 'success', 'Direct connection to Spoonacular API works!');
        } else {
          addResult('Spoonacular Direct Test', 'failure', 
            `Direct connection failed with status: ${response.status}`
          );
        }
      } catch (apiError: any) {
        addResult('Spoonacular Direct Test', 'failure', 
          `Direct connection error: ${apiError.message}`
        );
      }
    } catch (error) {
      addResult('VPN Certificate Test', 'failure', 
        `Error testing VPN certificate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const checkCryptoModule = async () => {
    addResult('Crypto Module Diagnostics', 'pending', 'Checking crypto module availability...');
    
    try {
      // Dynamically import the module to avoid load-time errors
      const cryptoWrapper = require('../utils/cryptoWrapper');
      
      // Test basic hashing functionality
      const testHash = await cryptoWrapper.md5('test-string');
      
      addResult('Crypto Module Diagnostics', 'success', 
        `Crypto module loaded successfully. Test hash: ${testHash.substring(0, 8)}...`);
      
      // Check if we're using the native module or fallback
      if (typeof require('expo-crypto').digestStringAsync === 'function') {
        addResult('Native Crypto Module', 'success', 'Using native expo-crypto implementation');
      } else {
        addResult('Native Crypto Module', 'failure', 'Using fallback crypto implementation');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addResult('Crypto Module Diagnostics', 'failure', 
        `Failed to load crypto module: ${errorMessage}`);
    }
  };

  const collectEnvironmentInfo = () => {
    addResult('Environment Variables', 'pending', 'Collecting environment information...');
    
    const envInfo = {
      platform: Platform.OS,
      apiKeyIsSet: !!ENV.SPOONACULAR_API_KEY,
      apiKeyPrefix: ENV.SPOONACULAR_API_KEY ? ENV.SPOONACULAR_API_KEY.substring(0, 3) + '...' : 'not set',
      baseUrl: ENV.SPOONACULAR_BASE_URL,
      isDev: __DEV__,
      apiEndpoint: ENV.SPOONACULAR_RECIPES_ENDPOINT
    };
    
    addResult('Environment Variables', 'success', 
      `Platform: ${envInfo.platform}\n` +
      `API key set: ${envInfo.apiKeyIsSet ? 'Yes' : 'No'}\n` +
      `Base URL: ${envInfo.baseUrl}\n` +
      `API Endpoint: ${envInfo.apiEndpoint}\n` +
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
    await checkSSLConnection();
    
    // Test proxy server if available
    await testProxyServer();
    
    // Test VPN certificate installation
    await testVpnCertificateInstall();
    
    // Try regular API test 
    await testSpoonacularConnectivity();
    
    // If the regular test failed, try with certificate bypass
    const regularTestFailed = results.some(result => 
      result.test.includes('Spoonacular API') && result.status === 'failure'
    );
    
    if (regularTestFailed) {
      addResult('Failover Test', 'pending', 'Regular API connection failed, trying certificate bypass...');
      await testCertificateBypass();
    }
    
    addResult('Comprehensive Diagnostics', 'success', 'Completed comprehensive diagnostics');
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Network Diagnostics</Text>
          <Text style={styles.headerSubtitle}>
            Debug network connectivity issues with the Spoonacular API
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
            onPress={testSpoonacularConnectivity}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Test API Connectivity</Text>
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
            onPress={checkSSLConnection}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Test SSL Connection</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
            onPress={testCertificateBypass}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Test Certificate Bypass</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
            onPress={testProxyServer}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Test Proxy Server</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.button} 
            onPress={testVpnCertificateInstall}
          disabled={isLoading}
        >
            <Text style={styles.buttonText}>Test VPN Certificate</Text>
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
        
        {/* Direct API Test Component */}
        <View style={styles.directTestContainer}>
          <DirectApiTest />
        </View>
        
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
          <Text style={styles.environmentItem}>API Base URL: {SPOONACULAR_CONFIG.BASE_URL}</Text>
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
  directTestContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 20,
  },
});

export default DebugScreen; 