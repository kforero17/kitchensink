/**
 * Environment utilities for safe access to environment variables
 */

import Constants from 'expo-constants';

// Add development flag
export const IS_DEVELOPMENT = __DEV__;

// Add app version
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

const envUtils = {
  IS_DEVELOPMENT,
  APP_VERSION,
};

export default envUtils;
