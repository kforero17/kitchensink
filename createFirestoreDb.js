/**
 * Firebase Firestore Database Check and Creation Guide
 * 
 * This script checks if a Firestore database exists in your project
 * and guides you through creating one if needed.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if service account file exists
const serviceAccountPath = path.join(__dirname, 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file not found at:', serviceAccountPath);
  console.log('\nPlease follow these steps:');
  console.log('1. Go to Firebase Console → Project settings → Service accounts');
  console.log('2. Click "Generate new private key"');
  console.log('3. Save the file as "service-account.json" in this directory');
  process.exit(1);
}

// Read service account info
const serviceAccount = require(serviceAccountPath);
console.log('\n📄 Service Account Details:');
console.log(`Project ID: ${serviceAccount.project_id}`);
console.log(`Client Email: ${serviceAccount.client_email}`);

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  process.exit(1);
}

// Check if Firestore database exists
async function checkFirestore() {
  console.log('\n🔍 Checking for Firestore database...');
  
  try {
    // Try to access Firestore
    const db = admin.firestore();
    
    // Try a simple operation
    try {
      await db.collection('test_collection').get();
      console.log('✅ Firestore database exists and is accessible!');
      return true;
    } catch (error) {
      if (error.code === 5 || error.message.includes('NOT_FOUND')) {
        console.log('❌ Firestore database does not exist or is not properly initialized.');
        return false;
      } else {
        console.error('❌ Error accessing Firestore:', error.message);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error initializing Firestore:', error.message);
    return false;
  }
}

// Display detailed instructions for creating a Firestore database
function showCreationInstructions() {
  console.log('\n📋 HOW TO CREATE A FIRESTORE DATABASE:');
  console.log('\n1. Go to Firebase Console: https://console.firebase.google.com/');
  console.log(`2. Select your project: "${serviceAccount.project_id}"`);
  console.log('3. In the left sidebar, click "Firestore Database"');
  console.log('4. Click "Create database" button');
  console.log('5. Select "Start in production mode" (you can adjust security rules later)');
  console.log('6. Choose a database location closest to your users (e.g., "us-central")');
  console.log('7. Click "Create"');
  console.log('\nIMPORTANT: Use the DEFAULT database ID. Do not customize the database name.');
  console.log('\nAfter creating the database:');
  console.log('1. Wait a few minutes for the database to fully initialize');
  console.log('2. Run "node adminSdkTest.js" again to test the connection');
  
  // Try to open the Firebase Console
  console.log('\n🌎 Attempting to open Firebase Console in your browser...');
  try {
    const url = `https://console.firebase.google.com/project/${serviceAccount.project_id}/firestore`;
    
    // Different commands for different operating systems
    switch (process.platform) {
      case 'darwin': // macOS
        execSync(`open "${url}"`);
        break;
      case 'win32': // Windows
        execSync(`start "${url}"`);
        break;
      case 'linux': // Linux
        execSync(`xdg-open "${url}"`);
        break;
      default:
        console.log(`Please open this URL in your browser: ${url}`);
    }
    
    console.log('✅ Browser opened to Firebase Console');
  } catch (error) {
    console.log(`Please open this URL in your browser:`);
    console.log(`https://console.firebase.google.com/project/${serviceAccount.project_id}/firestore`);
  }
}

// Check and provide guidance
async function main() {
  const firestoreExists = await checkFirestore();
  
  if (!firestoreExists) {
    showCreationInstructions();
  } else {
    console.log('\n✅ Your Firestore database is set up correctly!');
    console.log('You can now use the Admin SDK to interact with your database.');
    console.log('\nExample code:');
    console.log(`
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// Now you can use db to interact with Firestore
    `);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 