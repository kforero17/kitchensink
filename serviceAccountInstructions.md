# Firestore Testing with Service Account

## Why a Service Account?

Since we're still seeing "NOT_FOUND" errors with our client-side tests, using the Firebase Admin SDK with a service account is generally the most reliable way to connect to Firestore from a Node.js environment. This bypasses the security rules entirely.

## Steps to Get a Service Account:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (kitchensink-c4872)
3. Click on the gear icon (⚙️) near the top left → Project settings
4. Go to the "Service accounts" tab
5. Click "Generate new private key" button
6. Save the JSON file as `service-account.json` in your project directory

## Security Note:
- **NEVER** commit this file to version control
- **NEVER** share this file publicly
- Add `service-account.json` to your `.gitignore` file

## Test Script:

Once you have the service account JSON file, create a `adminSdkTest.js` file with the following content:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// Initialize Firebase Admin with service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
console.log('Firestore Admin SDK initialized');

async function testAdminWrite() {
  try {
    console.log('Attempting to write document with Admin SDK...');
    
    // Add a document to test_collection
    const docRef = await db.collection('test_collection').add({
      message: 'Document created with Admin SDK',
      timestamp: new Date().toISOString(),
      testNumber: Math.floor(Math.random() * 1000)
    });
    
    console.log('✅ Document written successfully with ID:', docRef.id);
    
    // Read back the document
    const docSnap = await docRef.get();
    console.log('Document data:', docSnap.data());
    
    return true;
  } catch (error) {
    console.error('❌ Error with Admin SDK:', error);
    return false;
  }
}

testAdminWrite();
```

## Then Run:
```
node adminSdkTest.js
```

## App Integration:

If this works, you have two options:
1. For backend operations: Use the Admin SDK approach
2. For client-side: Fix your security rules and authentication in your app

Let me know if you need help with either of these approaches! 