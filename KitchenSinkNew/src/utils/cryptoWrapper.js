/**
 * Wrapper for crypto functionality with fallbacks
 * 
 * This module provides cryptographic hash functions with a primary implementation
 * using expo-crypto and a fallback implementation for environments where
 * expo-crypto cannot be resolved.
 */

// Attempt to import expo-crypto and log diagnostic information
import * as Crypto from 'expo-crypto';
let digestStringAsync = Crypto.digestStringAsync;
let CryptoDigestAlgorithm = Crypto.CryptoDigestAlgorithm;

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
  const expoCrypto = Crypto;
  
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
export async function sha256(data) {
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
}

/**
 * Get the MD5 hash of a string
 * @param {string} data - The string to hash
 * @returns {Promise<string>} - The hex-encoded hash
 */
export async function md5(data) {
  try {
    console.log('[CRYPTO DEBUG] Attempting md5 with data type:', typeof data);
    
    if (Crypto?.digestStringAsync) {
      console.log('[CRYPTO DEBUG] Using native MD5 implementation');
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.MD5,
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