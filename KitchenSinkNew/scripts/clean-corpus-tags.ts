import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { cleanTags } from '../src/utils/tagSanitizer';

type Recipe = Record<string, any>;

type CorpusShape = 'array' | 'wrapped' | 'keyed';

interface LoadedCorpus {
  shape: CorpusShape;
  recipes: Recipe[];
  keys: string[];
  raw: any;
}

interface CleanReport {
  totalRecipes: number;
  totalTagsBefore: number;
  totalTagsAfter: number;
  droppedFrequency: Map<string, number>;
  underTwoTags: Array<{ id: string; name?: string; cleanedCount: number }>;
}

interface CliArgs {
  input: string;
  output: string;
  limit: number | null;
  applyFirestore: boolean;
}

const DEFAULT_INPUT = path.resolve(__dirname, '../allrecipes_firestore.json');
const DEFAULT_OUTPUT = path.resolve(__dirname, '../allrecipes_firestore.cleaned.json');
const FIRESTORE_BATCH_SIZE = 400;
const TOP_DROPPED_LIMIT = 100;
const UNDER_TWO_SAMPLE_SIZE = 20;
const KNOWN_FLAGS = new Set(['--input', '--output', '--limit', '--apply-firestore']);

function usage(): string {
  return 'Usage: tsx scripts/clean-corpus-tags.ts [--input <path>] [--output <path>] [--limit <N>] [--apply-firestore]';
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    limit: null,
    applyFirestore: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${flag}\n${usage()}`);
    }
    if (!KNOWN_FLAGS.has(flag)) {
      throw new Error(`Unknown flag: ${flag}\n${usage()}`);
    }
    if (flag === '--apply-firestore') {
      args.applyFirestore = true;
      continue;
    }
    const value = argv[++i];
    if (value === undefined) {
      throw new Error(`Flag ${flag} requires a value\n${usage()}`);
    }
    if (flag === '--input') args.input = path.resolve(value);
    else if (flag === '--output') args.output = path.resolve(value);
    else if (flag === '--limit') {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--limit must be a positive integer, got ${value}`);
      }
      args.limit = n;
    }
  }

  return args;
}

function loadCorpus(filePath: string): LoadedCorpus {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (Array.isArray(raw)) {
    return { shape: 'array', recipes: raw, keys: [], raw };
  }
  if (Array.isArray(raw.recipes)) {
    return { shape: 'wrapped', recipes: raw.recipes, keys: [], raw };
  }
  const keys = Object.keys(raw);
  return { shape: 'keyed', recipes: keys.map((k) => raw[k]), keys, raw };
}

function recipeId(recipe: Recipe, fallbackIndex: number): string {
  return String(recipe.id ?? `recipe-${fallbackIndex}`);
}

function cleanCorpus(recipes: Recipe[], limit: number | null): {
  cleanedRecipes: Recipe[];
  report: CleanReport;
} {
  const slice = limit ? recipes.slice(0, limit) : recipes;
  const droppedFrequency = new Map<string, number>();
  const underTwoTags: CleanReport['underTwoTags'] = [];
  let totalTagsBefore = 0;
  let totalTagsAfter = 0;

  const cleanedRecipes = slice.map((recipe, idx) => {
    const before: string[] = Array.isArray(recipe.tags) ? recipe.tags : [];
    const after = cleanTags(before);

    totalTagsBefore += before.length;
    totalTagsAfter += after.length;

    const afterSet = new Set(after);
    for (const tag of before) {
      if (typeof tag !== 'string') continue;
      const norm = tag.trim().toLowerCase();
      if (!norm || afterSet.has(norm)) continue;
      droppedFrequency.set(norm, (droppedFrequency.get(norm) ?? 0) + 1);
    }

    if (after.length < 2) {
      underTwoTags.push({
        id: recipeId(recipe, idx),
        name: recipe.name ?? recipe.title,
        cleanedCount: after.length,
      });
    }

    return { ...recipe, tags: after };
  });

  return {
    cleanedRecipes,
    report: {
      totalRecipes: cleanedRecipes.length,
      totalTagsBefore,
      totalTagsAfter,
      droppedFrequency,
      underTwoTags,
    },
  };
}

function rebuildCorpus(loaded: LoadedCorpus, cleanedRecipes: Recipe[]): unknown {
  if (loaded.shape === 'array') return cleanedRecipes;
  if (loaded.shape === 'wrapped') return { ...loaded.raw, recipes: cleanedRecipes };
  const out: Record<string, Recipe> = {};
  cleanedRecipes.forEach((recipe, idx) => {
    out[loaded.keys[idx]] = recipe;
  });
  return out;
}

function writeCorpus(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function topDropped(frequency: Map<string, number>, n: number): Array<[string, number]> {
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

function printReport(report: CleanReport, outputPath: string): void {
  console.log('=== Tag Cleaning Report ===');
  console.log(`Total recipes processed: ${report.totalRecipes}`);
  console.log(`Total tags before:       ${report.totalTagsBefore}`);
  console.log(`Total tags after:        ${report.totalTagsAfter}`);
  console.log(`Tags dropped:            ${report.totalTagsBefore - report.totalTagsAfter}`);
  console.log(`Unique dropped tags:     ${report.droppedFrequency.size}`);
  console.log(`Output written to:       ${outputPath}`);

  console.log(`\n--- Top ${TOP_DROPPED_LIMIT} dropped tags (count\\ttag) ---`);
  for (const [tag, count] of topDropped(report.droppedFrequency, TOP_DROPPED_LIMIT)) {
    console.log(`${count}\t${tag}`);
  }

  console.log(`\n--- Recipes with < 2 cleaned tags: ${report.underTwoTags.length} ---`);
  const sample = report.underTwoTags.slice(0, UNDER_TWO_SAMPLE_SIZE);
  for (const entry of sample) {
    const name = entry.name ? ` — ${entry.name}` : '';
    console.log(`  [${entry.cleanedCount}] ${entry.id}${name}`);
  }
  if (report.underTwoTags.length > sample.length) {
    console.log(`  ... and ${report.underTwoTags.length - sample.length} more`);
  }
}

function initFirestore(): admin.firestore.Firestore {
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (usingEmulator) {
    console.log(`Firestore mode: emulator (${process.env.FIRESTORE_EMULATOR_HOST})`);
    const app = admin.initializeApp({ projectId: 'kitchensink-sim' });
    return app.firestore();
  }
  console.log('Firestore mode: production (applicationDefault credentials)');
  const app = admin.initializeApp({ credential: admin.credential.applicationDefault() });
  return app.firestore();
}

async function applyFirestoreUpdate(cleanedRecipes: Recipe[]): Promise<void> {
  const db = initFirestore();
  const collection = db.collection('recipes');
  let batch = db.batch();
  let inBatch = 0;
  let written = 0;

  for (let i = 0; i < cleanedRecipes.length; i++) {
    const recipe = cleanedRecipes[i];
    const id = recipeId(recipe, i);
    batch.update(collection.doc(id), { tags: recipe.tags });
    inBatch++;

    if (inBatch === FIRESTORE_BATCH_SIZE) {
      await batch.commit();
      written += inBatch;
      console.log(`  Updated ${written} recipes...`);
      batch = db.batch();
      inBatch = 0;
    }
  }

  if (inBatch > 0) {
    await batch.commit();
    written += inBatch;
  }

  console.log(`Firestore: updated tags on ${written} recipe documents.`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Reading corpus from ${args.input}`);
  const loaded = loadCorpus(args.input);
  console.log(`Loaded ${loaded.recipes.length} recipes (shape: ${loaded.shape})`);

  const { cleanedRecipes, report } = cleanCorpus(loaded.recipes, args.limit);

  const sliceForOutput =
    args.limit && loaded.shape === 'keyed'
      ? { ...loaded, keys: loaded.keys.slice(0, args.limit) }
      : loaded;
  const payload = rebuildCorpus(sliceForOutput, cleanedRecipes);
  writeCorpus(args.output, payload);
  printReport(report, args.output);

  if (args.applyFirestore) {
    console.log('\n--- Applying tag updates to Firestore ---');
    await applyFirestoreUpdate(cleanedRecipes);
  } else {
    console.log('\n(Dry run: pass --apply-firestore to write tag updates to Firestore.)');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
