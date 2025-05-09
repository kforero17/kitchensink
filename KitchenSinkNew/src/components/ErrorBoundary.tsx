import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// import { resilientStorage } from '../utils/ResilientAsyncStorage';
import logger from '../utils/logger';

// Create a local, safe, in-memory mock for resilientStorage
const resilientStorageMock = {
  addErrorListener: (callback: (error: Error) => void) => {
    logger.debug('[ErrorBoundary] Mock resilientStorage.addErrorListener called');
    // Return a dummy unsubscribe function
    return () => {
      logger.debug('[ErrorBoundary] Mock resilientStorage.unsubscribe called');
    };
  },
  preloadKey: async (key: string): Promise<void> => {
    logger.debug(`[ErrorBoundary] Mock resilientStorage.preloadKey called for key: ${key}`);
    // Do nothing, or simulate success
    return Promise.resolve();
  },
  resetErrorCount: (): void => {
    logger.debug('[ErrorBoundary] Mock resilientStorage.resetErrorCount called');
    // Do nothing
  },
  // Add any other methods ErrorBoundary might call on resilientStorage, even if just no-ops
  getItem: async (key: string) => { logger.debug(`[ErrorBoundary] Mock resilientStorage.getItem for ${key}`); return null; },
  setItem: async (key: string, value: string) => { logger.debug(`[ErrorBoundary] Mock resilientStorage.setItem for ${key}`); },
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  storageKeys?: string[]; // Keys to preload when resetting boundary
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  key: number; // Used to force remount
}

/**
 * Error boundary component that catches errors in its child component tree.
 * Special handling for AsyncStorage-related errors.
 */
class ErrorBoundary extends React.Component<Props, State> {
  private storageErrorUnsubscribe: (() => void) | null = null;
  private preloadedKeys = new Set<string>();
  
  constructor(props: Props) {
    super(props);
    console.log("DEBUG: [ErrorBoundary] Constructor");
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      key: 0,
    };
  }
  
  componentDidMount() {
    console.log("DEBUG: [ErrorBoundary] Component mounted");
    // Subscribe to storage errors
    this.storageErrorUnsubscribe = resilientStorageMock.addErrorListener(this.handleStorageError);
    
    // Preload storage keys if specified
    try {
      console.log("DEBUG: [ErrorBoundary] Preloading storage keys...");
      this.preloadStorageKeys().catch(error => {
        console.log("DEBUG: [ErrorBoundary] Error in preloadStorageKeys:", error);
      });
    } catch (error) {
      console.log("DEBUG: [ErrorBoundary] Error in componentDidMount:", error);
    }
  }
  
  componentWillUnmount() {
    console.log("DEBUG: [ErrorBoundary] Component will unmount");
    // Unsubscribe from storage errors
    if (this.storageErrorUnsubscribe) {
      this.storageErrorUnsubscribe();
      this.storageErrorUnsubscribe = null;
    }
    
    // Clear preloaded keys tracking
    this.preloadedKeys.clear();
  }
  
  /**
   * Preload storage keys passed as props
   */
  preloadStorageKeys = async (): Promise<void> => {
    try {
      if (this.props.storageKeys && this.props.storageKeys.length > 0) {
        logger.debug('[ErrorBoundary] Preloading storage keys...');
        console.log("DEBUG: [ErrorBoundary] Storage keys to preload:", this.props.storageKeys);
        
        const preloadPromises: Promise<void>[] = [];
        
        for (const key of this.props.storageKeys) {
          if (!key) {
            console.log("DEBUG: [ErrorBoundary] Skipping undefined storage key");
            logger.warn('[ErrorBoundary] Skipping undefined or null storage key');
            continue;
          }
          
          try {
            console.log(`DEBUG: [ErrorBoundary] Preloading key: ${key}`);
            
            // Use a promise that won't throw
            const preloadPromise = resilientStorageMock.preloadKey(key)
              .then(() => {
                logger.debug(`[ErrorBoundary] Preloaded key: ${key}`);
                console.log(`DEBUG: [ErrorBoundary] Successfully preloaded key: ${key}`);
                this.preloadedKeys.add(key);
              })
              .catch(keyError => {
                console.log(`DEBUG: [ErrorBoundary] Failed to preload key ${key}:`, keyError);
                logger.warn(`[ErrorBoundary] Failed to preload key ${key}:`, keyError);
                // Don't re-throw, just log
              });
            
            preloadPromises.push(preloadPromise);
          } catch (keyError) {
            console.log(`DEBUG: [ErrorBoundary] Failed to preload key ${key}:`, keyError);
            logger.warn(`[ErrorBoundary] Failed to preload key ${key}:`, keyError);
            // Continue with other keys instead of failing the entire process
          }
        }
        
        // Wait for all preloads to complete, but don't throw
        await Promise.allSettled(preloadPromises);
      } else {
        console.log("DEBUG: [ErrorBoundary] No storage keys to preload");
      }
    } catch (error) {
      console.log("DEBUG: [ErrorBoundary] Error preloading keys:", error);
      logger.error('[ErrorBoundary] Error preloading keys:', error);
      // Don't throw, just log the error to prevent component crashes
    }
  };
  
  /**
   * Check if a specific key has been preloaded successfully
   */
  isKeyPreloaded = (key: string): boolean => {
    return this.preloadedKeys.has(key);
  };
  
  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    console.log("DEBUG: [ErrorBoundary] getDerivedStateFromError:", error.message);
    logger.error('[ErrorBoundary] Caught React error:', error);
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to our logging service
    console.log("DEBUG: [ErrorBoundary] componentDidCatch:", error.message);
    logger.error('[ErrorBoundary] Component stack trace:', errorInfo.componentStack);
    
    this.setState({ errorInfo });
    
    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Check if this is a storage-related error
    this.checkForStorageError(error);
  }
  
  /**
   * Handle errors from the resilient storage system
   */
  handleStorageError = (error: Error) => {
    console.log("DEBUG: [ErrorBoundary] Storage error reported:", error.message);
    logger.error('[ErrorBoundary] Storage error reported:', error);
    
    // Only set error state if this is a critical storage error that affects rendering
    if (error.message.includes('AsyncStorage') || 
        error.message.includes('storage') ||
        error.message.includes('undefined') ||
        error.message.includes('getItem') ||
        error.message.includes('null')) {
      console.log("DEBUG: [ErrorBoundary] Critical storage error detected, setting error state");
      this.setState({
        hasError: true,
        error,
      });
    }
  };
  
  /**
   * Check if an error is related to AsyncStorage
   */
  checkForStorageError(error: Error) {
    const errorString = error.toString().toLowerCase();
    const stack = error.stack ? error.stack.toLowerCase() : '';
    
    const isStorageError = 
      errorString.includes('asyncstorage') ||
      errorString.includes('cannot read property') ||
      errorString.includes('undefined') ||
      errorString.includes('null') ||
      errorString.includes('getitem') ||
      stack.includes('asyncstorage') ||
      stack.includes('storage');
    
    if (isStorageError) {
      console.log("DEBUG: [ErrorBoundary] Identified AsyncStorage-related error");
      logger.debug('[ErrorBoundary] Identified AsyncStorage-related error');
      
      // Reset the storage instance to force fresh initialization
      console.log("DEBUG: [ErrorBoundary] Resetting storage error count");
      resilientStorageMock.resetErrorCount();
    }
  }
  
  /**
   * Reset the error state and remount the component tree
   */
  resetErrorBoundary = async () => {
    console.log("DEBUG: [ErrorBoundary] Resetting error boundary");
    logger.debug('[ErrorBoundary] Resetting error boundary');
    
    try {
      // Reset resilient storage error count
      console.log("DEBUG: [ErrorBoundary] Resetting error count");
      resilientStorageMock.resetErrorCount();
      
      // Preload storage keys if specified
      console.log("DEBUG: [ErrorBoundary] Preloading keys after reset");
      await this.preloadStorageKeys();
      
      // Increment key to force component remount
      console.log("DEBUG: [ErrorBoundary] Forcing remount by updating key");
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        key: this.state.key + 1,
      });
    } catch (e) {
      console.log("DEBUG: [ErrorBoundary] Error during reset:", e);
      logger.error('[ErrorBoundary] Error during reset:', e);
    }
  };
  
  render() {
    console.log(`DEBUG: [ErrorBoundary] Rendering with hasError=${this.state.hasError}, key=${this.state.key}`);
    
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        console.log("DEBUG: [ErrorBoundary] Rendering custom fallback");
        return this.props.fallback;
      }
      
      // Otherwise, show the default error UI
      console.log("DEBUG: [ErrorBoundary] Rendering default error UI");
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            We're having trouble accessing your data storage.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.resetErrorBoundary}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Error Details:</Text>
            <Text style={styles.debugText}>{this.state.error?.toString()}</Text>
            {this.state.errorInfo && (
              <Text style={styles.debugText}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </View>
        </View>
      );
    }
    
    // No error, render children with the key to force remount when needed
    console.log("DEBUG: [ErrorBoundary] Rendering children");
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#343a40',
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    color: '#6c757d',
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    width: '100%',
    maxHeight: 300,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#343a40',
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#dc3545',
  },
});

export default ErrorBoundary; 