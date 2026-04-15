import * as admin from 'firebase-admin';

let app: admin.app.App | null = null;

export function initializeEmulatorApp(): admin.app.App {
  if (app) return app;

  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  app = admin.initializeApp({ projectId: 'kitchensink-sim' });
  return app;
}

export function getFirestore(appInstance?: admin.app.App): admin.firestore.Firestore {
  const a = appInstance ?? initializeEmulatorApp();
  return a.firestore();
}

export function getAuth(appInstance?: admin.app.App): admin.auth.Auth {
  const a = appInstance ?? initializeEmulatorApp();
  return a.auth();
}

export async function verifyEmulatorConnection(): Promise<void> {
  const db = getFirestore();
  try {
    await db.collection('healthcheck').limit(1).get();
  } catch (err) {
    throw new Error(
      `Cannot reach Firebase Emulator at localhost:8080. ` +
      `Make sure the emulator is running: npm run emulator:start\n` +
      `Original error: ${err}`
    );
  }
}

export async function verifyRecipeData(): Promise<number> {
  const db = getFirestore();
  const snapshot = await db.collection('recipes').limit(1).get();
  if (snapshot.empty) {
    throw new Error('No recipes found in emulator Firestore. Run: npm run seed');
  }
  const countSnap = await db.collection('recipes').count().get();
  return countSnap.data().count;
}
