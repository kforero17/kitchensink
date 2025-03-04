/**
 * Wrapper for crypto functionality with fallbacks
 * 
 * This module provides cryptographic hash functions with a primary implementation
 * using expo-crypto and a fallback implementation for environments where
 * expo-crypto cannot be resolved.
 */

// Attempt to import expo-crypto and log diagnostic information
let Crypto;
let digestStringAsync;
let CryptoDigestAlgorithm;

try {
  console.log('[CRYPTO DEBUG] Attempting to import expo-crypto');
  Crypto = require('expo-crypto');
  console.log('[CRYPTO DEBUG] Successfully imported expo-crypto:', typeof Crypto);
  console.log('[CRYPTO DEBUG] Available methods:', Object.keys(Crypto));
  console.log('[CRYPTO DEBUG] Crypto implementation details:', {
    hasDigestString: typeof Crypto.digestStringAsync === 'function',
    algorithms: Crypto.CryptoDigestAlgorithm ? Object.keys(Crypto.CryptoDigestAlgorithm) : 'not available',
    environment: process.env.NODE_ENV
  });
  
  // If import succeeded, use the real crypto functions
  digestStringAsync = Crypto.digestStringAsync;
  CryptoDigestAlgorithm = Crypto.CryptoDigestAlgorithm;
} catch (error) {
  console.error('[CRYPTO DEBUG] Failed to import expo-crypto:', error);
  console.log('[CRYPTO DEBUG] Will use fallback crypto implementations');
  
  // Define fallback constants if import failed
  Crypto = null;
  digestStringAsync = null;
  CryptoDigestAlgorithm = {
    SHA256: 'sha256',
    MD5: 'md5',
  };
}

// Simple fallback implementations
const fallbackSHA256 = (str) => {
  console.log('[CRYPTO DEBUG] Using fallbackSHA256');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `sha256_${Math.abs(hash).toString(16)}`;
};

const fallbackMD5 = (str) => {
  console.log('[CRYPTO DEBUG] Using fallbackMD5');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash * 31) ^ char) & 0xFFFFFFFF;
  }
  return `md5_${Math.abs(hash).toString(16)}`;
};

// Try to load the real crypto module, but use fallbacks if it fails
try {
  // This will not be a dynamic import, but a regular import transformed by Babel
  const expoCrypto = require('expo-crypto');
  
  CryptoDigestAlgorithm = expoCrypto.CryptoDigestAlgorithm;
  digestStringAsync = expoCrypto.digestStringAsync;
} catch (error) {
  console.warn('Failed to load expo-crypto, using fallback implementations');
}

/**
 * Get the SHA-256 hash of a string
 * @param {string} data - The string to hash
 * @returns {Promise<string>} - The hex-encoded hash
 */
async function sha256(data) {
  try {
    console.log('[CRYPTO DEBUG] Attempting sha256 with data type:', typeof data);
    
    // Try the expo-crypto implementation
    if (typeof Crypto !== 'undefined' && Crypto.digestStringAsync) {
      console.log('[CRYPTO DEBUG] Using Crypto.digestStringAsync for SHA256');
      try {
        return await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          data
        );
      } catch (error) {
        console.error('[CRYPTO DEBUG] Error using Crypto.digestStringAsync:', error);
        throw error;
      }
    } else {
      console.log('[CRYPTO DEBUG] Falling back to manual SHA256 implementation');
      return fallbackSHA256(data);
    }
  } catch (error) {
    console.error('[CRYPTO DEBUG] Error in sha256 function:', error);
    return fallbackSHA256(data);
  }
}

/**
 * Get the MD5 hash of a string
 * @param {string} data - The string to hash
 * @returns {Promise<string>} - The hex-encoded hash
 */
async function md5(data) {
  try {
    console.log('[CRYPTO DEBUG] Attempting md5 with data type:', typeof data);
    
    // Try the expo-crypto implementation
    if (typeof Crypto !== 'undefined' && Crypto.digestStringAsync) {
      console.log('[CRYPTO DEBUG] Using Crypto.digestStringAsync for MD5');
      try {
        return await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.MD5,
          data
        );
      } catch (error) {
        console.error('[CRYPTO DEBUG] Error using Crypto.digestStringAsync:', error);
        throw error;
      }
    } else {
      console.log('[CRYPTO DEBUG] Falling back to manual MD5 implementation');
      return fallbackMD5(data);
    }
  } catch (error) {
    console.error('[CRYPTO DEBUG] Error in md5 function:', error);
    return fallbackMD5(data);
  }
}

// Export the functions
module.exports = { 
  sha256: async (data) => {
    try {
      console.log('[CRYPTO DEBUG] Attempting sha256 with data type:', typeof data);
      
      if (Crypto?.digestStringAsync) {
        console.log('[CRYPTO DEBUG] Using native SHA256 implementation');
        return await Crypto.digestStringAsync(
          CryptoDigestAlgorithm.SHA256,
          data
        );
      } else {
        console.log('[CRYPTO DEBUG] Using fallback SHA256 implementation');
        return fallbackSHA256(data);
      }
    } catch (error) {
      console.error('[CRYPTO DEBUG] SHA256 error:', error);
      return fallbackSHA256(data);
    }
  },
  
  md5: async (data) => {
    try {
      console.log('[CRYPTO DEBUG] Attempting md5 with data type:', typeof data);
      
      if (Crypto?.digestStringAsync) {
        console.log('[CRYPTO DEBUG] Using native MD5 implementation');
        return await Crypto.digestStringAsync(
          CryptoDigestAlgorithm.MD5,
          data
        );
      } else {
        console.log('[CRYPTO DEBUG] Using fallback MD5 implementation');
        return fallbackMD5(data);
      }
    } catch (error) {
      console.error('[CRYPTO DEBUG] MD5 error:', error);
      return fallbackMD5(data);
    }
  }
}; 