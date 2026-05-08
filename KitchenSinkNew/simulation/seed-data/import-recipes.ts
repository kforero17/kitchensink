import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { cleanTags } from '../../src/utils/tagSanitizer';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = admin.initializeApp({ projectId: 'kitchensink-sim' });
const db = app.firestore();

async function importRecipes(): Promise<void> {
  const filePath = process.argv[2] || path.resolve(__dirname, '../../allrecipes_firestore.json');

  if (!fs.existsSync(filePath)) {
    console.error(`Recipe file not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading recipes from ${filePath}...`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  const recipes: Record<string, any>[] = Array.isArray(data)
    ? data
    : data.recipes || Object.values(data);

  console.log(`Found ${recipes.length} recipes. Importing...`);

  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const recipe of recipes) {
    const id = recipe.id || `recipe-${count}`;
    const ref = db.collection('recipes').doc(String(id));
    const cleaned = { ...recipe, tags: cleanTags(recipe.tags) };
    batch.set(ref, cleaned);
    count++;
    batchCount++;

    if (batchCount === 500) {
      await batch.commit();
      console.log(`  Imported ${count} recipes...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Done. Imported ${count} recipes to emulator Firestore.`);
  process.exit(0);
}

importRecipes().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
