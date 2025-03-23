/**
 * Firebase Service
 * 
 * This module is the main entry point for Firebase interactions.
 * It uses the Admin SDK for more reliable Firestore access.
 */

// Import the Admin SDK service
const adminFirebaseService = require('./adminFirebaseService');

// Re-export the entire service for direct use
module.exports = adminFirebaseService;

// You can add Firebase-specific helper functions here

/**
 * Gets all users from the users collection
 * @returns {Promise<Array>} Array of user objects
 */
module.exports.getAllUsers = async function() {
  return adminFirebaseService.getAllDocuments('users');
};

/**
 * Gets a user by ID
 * @param {string} userId User ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
module.exports.getUserById = async function(userId) {
  return adminFirebaseService.getDocument('users', userId);
};

/**
 * Creates a new user document
 * @param {string} userId User ID from authentication
 * @param {Object} userData User data
 * @returns {Promise<string>} Document ID
 */
module.exports.createUser = async function(userId, userData) {
  return adminFirebaseService.createDocument('users', {
    uid: userId,
    ...userData
  });
};

/**
 * Updates a user document
 * @param {string} userId User ID
 * @param {Object} userData User data to update
 * @returns {Promise<void>}
 */
module.exports.updateUser = async function(userId, userData) {
  return adminFirebaseService.updateDocument('users', userId, userData);
};

// Add more domain-specific helper functions as needed 