import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

/**
 * Tests Firestore permissions for the recipe_feedback collection
 * This can be used to diagnose permission issues
 */
export const testFeedbackPermissions = async (): Promise<{success: boolean; message: string}> => {
  try {
    // Check if user is authenticated
    const user = auth().currentUser;
    if (!user) {
      return {
        success: false,
        message: 'No authenticated user found. Please sign in to test permissions.'
      };
    }

    console.log(`Testing Firestore permissions for user: ${user.uid}`);
    
    // Try to read the collection
    console.log('Testing read permissions...');
    const readResult = await firestore()
      .collection('recipe_feedback')
      .limit(1)
      .get();
    
    console.log(`Read test ${readResult !== null ? 'succeeded' : 'failed'}`);
    
    // Try to write to the collection using a test document
    console.log('Testing write permissions...');
    const testDocId = `test_${user.uid}_${Date.now()}`;
    const testData = {
      userId: user.uid,
      testField: 'Testing permissions',
      timestamp: firestore.FieldValue.serverTimestamp()
    };
    
    // Try to write
    await firestore()
      .collection('recipe_feedback')
      .doc(testDocId)
      .set(testData);
    
    console.log('Write test succeeded');
    
    // Try to delete the test document
    await firestore()
      .collection('recipe_feedback')
      .doc(testDocId)
      .delete();
    
    console.log('Delete test succeeded');
    
    return {
      success: true,
      message: 'All permission tests passed! You have read/write access to the recipe_feedback collection.'
    };
  } catch (error) {
    console.error('Permission test failed:', error);
    
    // Provide helpful error message
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Add more specific guidance based on error message
      if (errorMessage.includes('permission-denied')) {
        errorMessage += '\n\nYou need to update your Firestore security rules. Check the firestore.rules file for the correct rules.';
      }
    }
    
    return {
      success: false,
      message: `Permission test failed: ${errorMessage}`
    };
  }
};

/**
 * Gets the current Firestore security rules configuration
 * This can be used to help diagnose permission issues
 * Note: This requires Firebase Admin SDK access which may not be available on client
 */
export const checkFirestoreRules = async (): Promise<{exists: boolean; message: string}> => {
  try {
    // This is a stub function that would normally use Firebase Admin SDK
    // In a client app, we can't directly access the security rules
    return {
      exists: false,
      message: 'Cannot directly check Firestore rules from client app. Please deploy the rules in firestore.rules file to your Firebase project.'
    };
  } catch (error) {
    console.error('Error checking Firestore rules:', error);
    return {
      exists: false,
      message: 'Error checking Firestore rules. Please deploy the rules in firestore.rules file to your Firebase project.'
    };
  }
}; 