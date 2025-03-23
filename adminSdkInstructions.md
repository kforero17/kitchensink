# Firebase Admin SDK Setup Instructions

To use Firebase Admin SDK, you need to create a service account key file. Follow these steps:

## Step 1: Create a Service Account Key

1. Go to your Firebase Console: [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Select your project: `kitchensink-c4872`
3. Click on the ⚙️ (gear icon) near the top left corner to open **Project settings**
4. Go to the **Service accounts** tab
5. In the **Firebase Admin SDK** section, click the **Generate new private key** button
6. Click **Generate key** in the popup
7. Save the downloaded file as `service-account.json` in this project directory

⚠️ **IMPORTANT**: This file contains sensitive credentials. 
- Never commit it to version control 
- Add it to `.gitignore`
- Keep it secure

## Step 2: Run the Admin SDK Test

After saving the `service-account.json` file in this project directory, run:

```
node adminSdkTest.js
```

This will test connecting to Firestore using the Admin SDK. 