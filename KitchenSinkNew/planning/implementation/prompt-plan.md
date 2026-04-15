# Implementation Prompt Plan

## Checklist
- [ ] Prompt 1: Project scaffolding, package.json, tsconfig, emulator config
- [ ] Prompt 2: Emulator connection and SimAuth data layer
- [ ] Prompt 3: SimFirestore data layer
- [ ] Prompt 4: Profile types, pantry templates, and archetype profiles
- [ ] Prompt 5: Random profile generator
- [ ] Prompt 6: Pure computation bridge verification and shimming
- [ ] Prompt 7: Action executor interface, MealPlanAction, and CookRecipeAction
- [ ] Prompt 8: FeedbackAction, PantryAction, GroceryRestockAction
- [ ] Prompt 9: SwapRecipeAction, InsightsAction, and ActionRegistry
- [ ] Prompt 10: ActionScheduler and DaySimulator engine
- [ ] Prompt 11: Invariant checkers (Dietary, Repetition, Instrument)
- [ ] Prompt 12: Quality trackers (Diversity, PantryUtilization, ExpiryTracker)
- [ ] Prompt 13: Quality trackers (FeedbackLoop, SeasonalRelevance) and QualityTracker orchestrator
- [ ] Prompt 14: Report generators (RawDataExporter, SummaryReportGenerator)
- [ ] Prompt 15: SimulationRunner, CLI entry point, npm scripts, and smoke test

---

## Prompts

### Prompt 1: Project scaffolding, package.json, tsconfig, emulator config

**Objective:** Set up the simulation sub-project as a standalone Node.js package inside `KitchenSinkNew/simulation/`. This creates the foundation that every subsequent prompt depends on: dependency management, TypeScript compilation with `@app/*` path aliases, Firebase Emulator configuration, and the output directory structure.

**Files to create:**
- `KitchenSinkNew/simulation/package.json`
- `KitchenSinkNew/simulation/tsconfig.json`
- `KitchenSinkNew/simulation/firebase.json`
- `KitchenSinkNew/simulation/.firebaserc`
- `KitchenSinkNew/simulation/.gitignore`
- `KitchenSinkNew/simulation/seed-data/import-recipes.ts`

**Implementation guidance:**

1. Create `package.json` with these dependencies and scripts:
   ```json
   {
     "name": "kitchensink-simulation",
     "version": "1.0.0",
     "private": true,
     "scripts": {
       "simulate": "tsx index.ts",
       "simulate:test": "tsx index.ts --profiles 1 --days 7",
       "emulator:start": "firebase emulators:start --import=seed-data/export",
       "emulator:export": "firebase emulators:export seed-data/export",
       "seed": "tsx seed-data/import-recipes.ts",
       "test": "jest --config jest.config.js"
     },
     "dependencies": {
       "firebase-admin": "^12.0.0",
       "seed-random": "^2.2.0",
       "csv-stringify": "^6.0.0",
       "chalk": "^5.0.0",
       "ora": "^7.0.0",
       "yargs": "^17.0.0"
     },
     "devDependencies": {
       "typescript": "^5.0.0",
       "tsx": "^4.0.0",
       "@types/node": "^20.0.0",
       "@types/yargs": "^17.0.0",
       "jest": "^29.0.0",
       "ts-jest": "^29.0.0",
       "@types/jest": "^29.0.0"
     }
   }
   ```

2. Create `tsconfig.json` that targets Node.js ES2022 with `@app/*` path alias pointing to `../src/*`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "Node16",
       "moduleResolution": "Node16",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "outDir": "dist",
       "rootDir": ".",
       "baseUrl": ".",
       "paths": {
         "@app/*": ["../src/*"]
       },
       "resolveJsonModule": true,
       "declaration": false,
       "sourceMap": true
     },
     "include": ["*.ts", "**/*.ts"],
     "exclude": ["node_modules", "dist", "output"]
   }
   ```

3. Create `jest.config.js` for simulation tests:
   ```js
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     roots: ['<rootDir>'],
     testMatch: ['**/__tests__/**/*.test.ts'],
     moduleNameMapper: {
       '^@app/(.*)$': '<rootDir>/../src/$1',
     },
     transform: {
       '^.+\\.tsx?$': 'ts-jest',
     },
   };
   ```

4. Create `firebase.json` configuring emulators on the correct ports:
   - Firestore on port 8080
   - Auth on port 9099
   - UI on port 4000
   - Set `"singleProjectMode": true`

5. Create `.firebaserc` with project alias `kitchensink-sim`.

6. Create `.gitignore` that ignores `node_modules/`, `dist/`, `output/`, and `seed-data/export/`.

7. Create a stub `seed-data/import-recipes.ts` that:
   - Initializes a `firebase-admin` app connected to the emulator
   - Reads a JSON file of exported recipes (path passed as CLI arg or default `../../allrecipes_firestore.json`)
   - Writes each recipe document to the `recipes` collection in the emulator Firestore
   - Logs progress with chalk

8. Add simulation npm scripts to the root `KitchenSinkNew/package.json`:
   ```json
   "simulate": "cd simulation && npx tsx index.ts",
   "simulate:test": "cd simulation && npx tsx index.ts --profiles 1 --days 7",
   "simulate:emulator": "cd simulation && firebase emulators:start --import=seed-data/export"
   ```

**Test requirements:**
- No automated tests for this prompt (infrastructure only).
- Manual verification: run `cd simulation && npm install` successfully, `npx tsc --noEmit` passes with no errors on an empty `index.ts` stub.

**Integration with previous work:**
- This is the foundation prompt. All subsequent prompts depend on the `@app/*` path alias, the `firebase-admin` dependency, and the emulator config created here.

---

### Prompt 2: Emulator connection and SimAuth data layer

**Objective:** Create the Firebase Emulator connection initializer and the SimAuth class that manages synthetic user accounts. These are the first runtime components and must work against the actual emulator.

**Files to create:**
- `KitchenSinkNew/simulation/data/emulatorConnection.ts`
- `KitchenSinkNew/simulation/data/SimAuth.ts`

**Implementation guidance:**

1. Create `emulatorConnection.ts`:
   ```typescript
   import * as admin from 'firebase-admin';

   let app: admin.app.App | null = null;

   export function initializeEmulatorApp(): admin.app.App {
     if (app) return app;

     // MUST set env vars BEFORE initializeApp
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

   /**
    * Pre-flight check: verifies the emulator is reachable.
    * Attempts a Firestore list operation. Throws with a clear message if unreachable.
    */
   export async function verifyEmulatorConnection(): Promise<void> {
     const db = getFirestore();
     try {
       await db.collection('__healthcheck__').limit(1).get();
     } catch (err) {
       throw new Error(
         `Cannot reach Firebase Emulator at localhost:8080. ` +
         `Make sure the emulator is running: npm run emulator:start\n` +
         `Original error: ${err}`
       );
     }
   }

   /**
    * Pre-flight check: verifies recipe data exists in the emulator.
    */
   export async function verifyRecipeData(): Promise<number> {
     const db = getFirestore();
     const snapshot = await db.collection('recipes').limit(1).get();
     if (snapshot.empty) {
       throw new Error(
         'No recipes found in emulator Firestore. Run: npm run seed'
       );
     }
     const countSnap = await db.collection('recipes').count().get();
     return countSnap.data().count;
   }
   ```

2. Create `SimAuth.ts`:
   ```typescript
   import * as admin from 'firebase-admin';
   import { getAuth } from './emulatorConnection';

   // Forward reference -- full type defined in profiles/types.ts (Prompt 4)
   interface SimulationProfileRef {
     id: string;
     name: string;
   }

   export class SimAuth {
     private auth: admin.auth.Auth;

     constructor(app: admin.app.App) {
       this.auth = app.auth();
     }

     async createUser(profile: SimulationProfileRef): Promise<string> {
       const userRecord = await this.auth.createUser({
         displayName: profile.name,
         email: `${profile.id}@simulation.local`,
         password: 'sim-password-123',
       });
       return userRecord.uid;
     }

     async deleteUser(uid: string): Promise<void> {
       try {
         await this.auth.deleteUser(uid);
       } catch (err: any) {
         if (err.code !== 'auth/user-not-found') throw err;
       }
     }

     async deleteAllUsers(): Promise<void> {
       const listResult = await this.auth.listUsers(1000);
       const uids = listResult.users.map(u => u.uid);
       if (uids.length > 0) {
         await this.auth.deleteUsers(uids);
       }
     }
   }
   ```

**Test requirements:**
- No unit tests for this prompt (requires emulator running). These are integration-level components.
- Create a manual verification script or note: start the emulator, run `verifyEmulatorConnection()` and `verifyRecipeData()` to confirm they work.

**Integration with previous work:**
- Uses `firebase-admin` from Prompt 1's `package.json`.
- `emulatorConnection.ts` is imported by every data layer component and by `SimulationRunner`.

---

### Prompt 3: SimFirestore data layer

**Objective:** Build the `SimFirestore` class that provides all Firestore read/write operations the simulation needs. This replaces the React Native Firebase calls the app normally uses, using `firebase-admin` SDK instead. It is the single data access point for all action executors.

**Files to create:**
- `KitchenSinkNew/simulation/data/SimFirestore.ts`

**Implementation guidance:**

1. Create the `SimFirestore` class implementing every method from the design doc. The class wraps `admin.firestore.Firestore` and operates on these Firestore collections:
   - `recipes` (global, read-only by simulation)
   - `users/{uid}/preferences` (document)
   - `users/{uid}/pantryItems` (subcollection)
   - `users/{uid}/leftovers` (subcollection)
   - `users/{uid}/recipes` (subcollection -- saved/meal plan recipes)
   - `users/{uid}/groceryLists` (subcollection)
   - `users/{uid}/history` (subcollection -- replaces AsyncStorage)
   - `recipe_feedback` (top-level collection, filtered by userId)
   - `weekly_rankings` (top-level collection)

2. Implement these methods with the following signatures (reference the design doc Section 4a):

   ```typescript
   import * as admin from 'firebase-admin';
   import { UnifiedRecipe, Ingredient } from '@app/shared/interfaces';
   import { UserPreferences } from '@app/types/FirestoreSchema';
   import { PantryItem } from '@app/types/PantryItem';
   import { Leftover } from '@app/types/Leftover';
   import { RecipeFeedback } from '@app/services/recipeFeedbackService';
   import { RecipeHistoryItem } from '@app/utils/recipeHistory';

   export class SimFirestore {
     private db: admin.firestore.Firestore;
     private recipeCache: UnifiedRecipe[] | null = null;

     constructor(app: admin.app.App) {
       this.db = app.firestore();
     }

     // --- Recipes (global, cached after first load) ---
     async getAllRecipes(): Promise<UnifiedRecipe[]>;
     async getRecipeById(id: string): Promise<UnifiedRecipe | null>;
     async getRecipesByTags(tags: string[]): Promise<UnifiedRecipe[]>;

     // --- User Preferences ---
     async setPreferences(uid: string, prefs: UserPreferences): Promise<void>;
     async getPreferences(uid: string): Promise<UserPreferences>;

     // --- Pantry ---
     async addPantryItem(uid: string, item: PantryItem): Promise<string>;
     async getPantryItems(uid: string): Promise<PantryItem[]>;
     async updatePantryItem(uid: string, id: string, update: Partial<PantryItem>): Promise<void>;
     async removePantryItem(uid: string, id: string): Promise<void>;

     // --- Leftovers ---
     async addLeftover(uid: string, leftover: Leftover): Promise<string>;
     async getLeftovers(uid: string): Promise<Leftover[]>;
     async updateLeftover(uid: string, id: string, update: Partial<Leftover>): Promise<void>;

     // --- Feedback ---
     async saveFeedback(recipeId: string, uid: string, fb: RecipeFeedback): Promise<void>;
     async getUserFeedback(uid: string): Promise<RecipeFeedback[]>;

     // --- Saved Recipes ---
     async saveRecipe(uid: string, recipe: any): Promise<string>;
     async getUserRecipes(uid: string): Promise<any[]>;
     async resetWeeklyMealPlanFlags(uid: string): Promise<void>;

     // --- Grocery Lists ---
     async saveGroceryList(uid: string, list: any): Promise<string>;

     // --- Weekly Rankings ---
     async saveWeeklyRanking(weekOf: string, data: any): Promise<void>;

     // --- Recipe History (replaces AsyncStorage) ---
     async addHistoryItem(uid: string, item: RecipeHistoryItem): Promise<void>;
     async getHistory(uid: string): Promise<RecipeHistoryItem[]>;

     // --- Utility ---
     async clearUserData(uid: string): Promise<void>;
   }
   ```

3. Key implementation details:
   - `getAllRecipes()` should cache results after the first call since recipes are read-only during simulation. Convert Firestore documents to `UnifiedRecipe` objects, ensuring the `id` field is set from the document ID.
   - `getRecipesByTags()` uses `array-contains-any` with a limit of 10 tags (Firestore limit), then filters in-memory for full tag match.
   - `clearUserData()` deletes all subcollections for a user (used in cleanup between profiles).
   - All date fields stored as ISO strings (not Firestore Timestamps) for portability.
   - Use `FieldValue.serverTimestamp()` for `createdAt`/`updatedAt` metadata fields.
   - The `saveFeedback` method stores in `recipe_feedback` collection with a compound doc ID: `{uid}_{recipeId}`.

**Test requirements:**
- No unit tests (requires emulator). Integration tests come in Prompt 15.

**Integration with previous work:**
- Imports `emulatorConnection.ts` from Prompt 2.
- Uses types from `@app/*` -- the path alias set up in Prompt 1.
- Every action executor (Prompts 7-9) injects `SimFirestore` via `ActionContext`.

---

### Prompt 4: Profile types, pantry templates, and archetype profiles

**Objective:** Define the simulation's core data types (`SimulationProfile`, `EngagementTier`, `DayState`, `DaySnapshot`, etc.) and implement the 10 hand-crafted archetype profiles from the design doc's table. Also create pantry item templates that provide realistic starting inventories keyed by cuisine and dietary preference.

**Files to create:**
- `KitchenSinkNew/simulation/profiles/types.ts`
- `KitchenSinkNew/simulation/profiles/pantryTemplates.ts`
- `KitchenSinkNew/simulation/profiles/archetypeProfiles.ts`
- `KitchenSinkNew/simulation/__tests__/profiles.test.ts`

**Implementation guidance:**

1. Create `profiles/types.ts` with all simulation data models from design doc Section 5:

   ```typescript
   import { UserPreferences } from '@app/types/FirestoreSchema';
   import { PantryItem } from '@app/types/PantryItem';
   import { Leftover } from '@app/types/Leftover';
   import { RecipeFeedback } from '@app/services/recipeFeedbackService';
   import { RecipeHistoryItem } from '@app/utils/recipeHistory';
   import { UnifiedRecipe } from '@app/shared/interfaces';
   import { Season } from '@app/ranking/seasonalSignal';

   export type EngagementTier = 'high' | 'medium' | 'low';

   export interface SimulationProfile {
     id: string;                          // e.g. "archetype-01" or "random-07"
     name: string;
     uid: string;                         // Firebase Auth uid (assigned at runtime)
     preferences: UserPreferences;
     engagementTier: EngagementTier;
     startingPantry: PantryItem[];
     simulationStartDate: string;         // ISO date
     seed: number;                        // PRNG seed for reproducibility
   }

   export interface ProfileDefinition {
     name: string;
     preferences: UserPreferences;
     engagementTier: EngagementTier;
     startingPantry: PantryItem[];
     simulationStartDate: string;
   }

   export interface DayState {
     pantryItems: PantryItem[];
     leftovers: Leftover[];
     currentMealPlan: UnifiedRecipe[];
     recipeHistory: RecipeHistoryItem[];
     feedbackHistory: RecipeFeedback[];
     cookedToday: string[];
   }

   export interface DaySnapshot {
     profileId: string;
     dayIndex: number;
     date: string;
     season: Season;
     actionsExecuted: ActionResult[];
     stateAfter: DayState;
     violations: InvariantViolation[];
     mealPlanGenerated: boolean;
     recipesCooked: number;
   }

   export interface SimulationResult {
     profile: SimulationProfile;
     days: DaySnapshot[];
     qualityMetrics: QualityMetrics;
     totalViolations: InvariantViolation[];
     durationMs: number;
   }

   export type ActionType =
     | 'generate_meal_plan'
     | 'cook_recipe'
     | 'log_leftover'
     | 'give_feedback'
     | 'update_pantry'
     | 'grocery_restock'
     | 'swap_recipe'
     | 'check_insights';

   export interface ActionResult {
     type: ActionType;
     success: boolean;
     data?: any;
     error?: string;
   }

   export interface InvariantViolation {
     profileId: string;
     dayIndex: number;
     date: string;
     type: 'dietary' | 'repetition' | 'instrument';
     recipeId: string;
     recipeTitle: string;
     detail: string;
     severity: 'critical' | 'warning';
   }

   export interface QualityMetrics {
     diversity: {
       mean: number;
       min: number;
       max: number;
       perWindow: number[];
     };
     pantryUtilization: {
       mean: number;
       trend: number;
       perPlan: number[];
     };
     feedbackLoop: {
       positiveCorrelation: number;
       negativeCorrelation: number;
       netEffectiveness: number;
     };
     seasonalRelevance: {
       meanMatchRate: number;
       perSeason: Record<Season, number>;
     };
     expiryDriven: {
       rescueRate: number;
       totalExpiring: number;
       totalRescued: number;
     };
   }
   ```

2. Create `profiles/pantryTemplates.ts`:
   - Define `PANTRY_TEMPLATES` as a record keyed by cuisine/diet combos.
   - Each template is an array of `PantryItem` objects (without `id` -- IDs are assigned at runtime).
   - Include templates for: vegan, vegetarian, gluten-free, dairy-free, Mediterranean, Asian, Mexican, Indian, American, generic/default.
   - Items should have realistic `name`, `quantity`, `unit`, `category` values.
   - Expiration dates are relative -- provide a helper `offsetDate(baseDate: string, daysOffset: number): string` that the profile generator uses to compute absolute dates from the simulation start date.
   - Include 8-15 items per template.

3. Create `profiles/archetypeProfiles.ts`:
   - Export `function generateArchetypeProfiles(): ProfileDefinition[]` that returns exactly 10 profiles matching the design doc table (Section 4b).
   - For each archetype, construct a full `UserPreferences` object with `dietary`, `food`, `cooking`, and `budget` sub-objects using the types from `@app/types/*`.
   - Use `pantryTemplates.ts` to assign a starting pantry appropriate to each archetype's cuisine/dietary combination.
   - Each archetype must have its `simulationStartDate` set as specified in the design doc table (use the year corresponding to a recent non-leap year, e.g., 2025).
   - Pay close attention to the "Edge Case Tested" column -- archetype #10 (Raw Vegan Minimalist) has `kitchenInstruments: []` (empty array), archetype #2 has `householdSize: 6`, etc.

4. The 10 archetypes with their key distinguishing properties:
   | # | ID | Dietary flags | Cuisines | Skill | Instruments | Tier | Start |
   |---|---|---|---|---|---|---|---|
   | 1 | archetype-01 | vegan=true | Thai, Mexican, Indian | beginner | microwave, stove_top | medium | 2025-01-15 |
   | 2 | archetype-02 | none | Mediterranean, Greek, Italian | advanced | stove_top, oven, grill, slow_cooker | high | 2025-03-01 |
   | 3 | archetype-03 | glutenFree=true, nutFree=true; allergies=[peanut, tree nuts, shellfish] | Japanese, Korean, American | intermediate | microwave, pressure_cooker, stove_top | low | 2025-06-01 |
   | 4 | archetype-04 | lowCarb=true | American, Mediterranean | intermediate | grill, air_fryer, oven, stove_top | high | 2025-09-01 |
   | 5 | archetype-05 | vegetarian=true; allergies=[mushroom] | Indian, Middle Eastern | advanced | stove_top, oven, pressure_cooker | medium | 2025-12-01 |
   | 6 | archetype-06 | dairyFree=true | Mexican, Caribbean, Chinese | beginner | stove_top, microwave, slow_cooker | high | 2025-04-15 |
   | 7 | archetype-07 | glutenFree=true | Italian, French, Spanish | advanced | oven, stove_top, grill, toaster_oven, air_fryer | low | 2025-07-01 |
   | 8 | archetype-08 | none | Vietnamese, Thai, Korean | intermediate | stove_top, pressure_cooker, microwave | high | 2025-10-15 |
   | 9 | archetype-09 | allergies=[soy]; restrictions=[no_red_meat, no_poultry] | Japanese, Mediterranean, French | intermediate | stove_top, oven, grill | medium | 2025-02-01 |
   | 10 | archetype-10 | vegan=true; restrictions=[no_cooked_food] | American, Thai, Caribbean | beginner | [] (none) | low | 2025-08-01 |

**Test requirements:**
- `profiles.test.ts` must include:
  - `generateArchetypeProfiles()` returns exactly 10 profiles.
  - Each profile has a valid non-empty `name` and `id`.
  - Each profile's `preferences.dietary` contains no contradictions (e.g., not both `vegan` and `lowCarb` on the same profile).
  - All engagement tiers are represented (at least 1 high, 1 medium, 1 low).
  - Start dates span all 4 seasons (at least 1 per season: winter=Dec/Jan/Feb, spring=Mar/Apr/May, summer=Jun/Jul/Aug, fall=Sep/Oct/Nov).
  - Each profile's `startingPantry` has at least 1 item.
  - Archetype #10 has empty `kitchenInstruments`.
  - Archetype #2 has `householdSize` equal to 6.
  - Archetype #3 has `allergies` containing 'peanut', 'tree nuts', and 'shellfish'.

**Integration with previous work:**
- Imports types from `@app/*` (path alias from Prompt 1).
- `SimulationProfile` is used by every subsequent prompt.
- `pantryTemplates.ts` is also used by the random profile generator (Prompt 5).

---

### Prompt 5: Random profile generator

**Objective:** Implement the random profile generator that creates 10 (or N) additional synthetic profiles using a seeded PRNG for full reproducibility. This ensures the simulation covers a wider range of preference combinations than the hand-crafted archetypes alone.

**Files to create:**
- `KitchenSinkNew/simulation/profiles/randomProfiles.ts`
- Add tests to `KitchenSinkNew/simulation/__tests__/profiles.test.ts`

**Implementation guidance:**

1. Install and use `seed-random` for deterministic random number generation:
   ```typescript
   import seedRandom from 'seed-random';

   export function generateRandomProfiles(count: number, seed: number = 42): ProfileDefinition[] {
     const rng = seedRandom(String(seed));
     const profiles: ProfileDefinition[] = [];
     for (let i = 0; i < count; i++) {
       profiles.push(generateOneRandomProfile(rng, i));
     }
     return profiles;
   }
   ```

2. `generateOneRandomProfile(rng, index)` constructs a `ProfileDefinition` by randomly selecting:
   - **Dietary flags:** 0-3 flags from `[vegetarian, vegan, glutenFree, dairyFree, nutFree, lowCarb]`. Apply contradiction rules:
     - If `vegan` is set, also set `vegetarian` and `dairyFree`.
     - Never set both `vegan` and `lowCarb` simultaneously.
   - **Allergies:** 0-2 random allergies from `[peanut, tree nuts, shellfish, soy, mushroom, sesame, wheat, fish]`.
   - **Restrictions:** 0-1 random restrictions from `[no_red_meat, no_poultry, no_cooked_food]`.
   - **Cuisines:** 1-4 random cuisines from the 15 options in `FoodPreferences.CUISINE_OPTIONS`.
   - **Favorite ingredients:** 3-8 random from `INGREDIENT_SUGGESTIONS`.
   - **Disliked ingredients:** 0-3 random (ensuring no overlap with favorites).
   - **Skill level:** uniform random from `[beginner, intermediate, advanced]`.
   - **Cooking frequency:** random from `[daily, few_times_week, weekends_only, rarely]`.
   - **Cooking duration:** random from `[under_30_min, 30_to_60_min, over_60_min]`.
   - **Kitchen instruments:** 2-5 random from the 8 instrument types.
   - **Household size:** 1-5.
   - **Serving size preference:** 1-6 (correlated with household size).
   - **Meal types:** 2-4 random from `[breakfast, lunch, dinner, snacks, dessert]`, always including dinner.
   - **Weekly meal prep count:** 3-14.
   - **Budget:** random amount $20-$150/week.
   - **Engagement tier:** weighted random (40% medium, 30% high, 30% low).
   - **Start date:** distribute across months Jan-Oct so all seasons are covered.
   - **Starting pantry:** use `pantryTemplates.ts`, selecting the template closest to the generated dietary/cuisine profile, with random subset of 5-15 items.

3. Helper function `pickRandom<T>(arr: T[], rng: () => number): T` and `pickMultiple<T>(arr: T[], min: number, max: number, rng: () => number): T[]` for readable random selection.

**Test requirements:**
- Add to `profiles.test.ts`:
  - `generateRandomProfiles(10)` returns exactly 10 profiles.
  - Same seed produces identical profiles (call twice, deep-equal).
  - Different seeds produce different profiles.
  - No profile has contradictory dietary flags (vegan + lowCarb).
  - If vegan is set, vegetarian and dairyFree are also set.
  - All profiles have 1-4 cuisines selected.
  - All profiles have at least 1 pantry item.
  - Over 100 generated profiles, all 3 engagement tiers appear (statistical, allow tolerance).
  - Every profile has a valid `simulationStartDate` in ISO format.

**Integration with previous work:**
- Imports `ProfileDefinition` from Prompt 4's `profiles/types.ts`.
- Imports `pantryTemplates` from Prompt 4's `pantryTemplates.ts`.
- Used by `SimulationRunner` (Prompt 15) to generate the full 20-profile set.

---

### Prompt 6: Pure computation bridge verification and shimming

**Objective:** Verify that all app modules imported via `@app/*` can actually be loaded in a Node.js context (without React Native). Create thin shim/adapter layers where needed to handle any React Native-specific imports that would fail at runtime. This is a critical gating step before building action executors.

**Files to create:**
- `KitchenSinkNew/simulation/bridge/appImports.ts`
- `KitchenSinkNew/simulation/bridge/shimLogger.ts`
- `KitchenSinkNew/simulation/__tests__/bridge.test.ts`

**Implementation guidance:**

1. Create `bridge/appImports.ts` as the single re-export point for all app modules used by the simulation. This isolates import issues to one file:

   ```typescript
   // Ranking modules (pure computation -- should import cleanly)
   export { rankRecipes, RankRecipesOptions, ScoredRecipe } from '@app/ranking/rankRecipes';
   export { computeFeatures, FeatureContext, FeatureVector } from '@app/ranking/featureEngineering';
   export { buildTemporalProfile, computeTemporalFit, TemporalProfile } from '@app/ranking/temporalPatterns';
   export { buildSeasonalProfile, computeSeasonalFit, getSeason, Season, SeasonalProfile } from '@app/ranking/seasonalSignal';
   export { buildFeedbackMap, FeedbackSignal } from '@app/ranking/feedbackSignal';

   // Utility modules
   export { ingredientsMatch, calculateIngredientSimilarity } from '@app/utils/ingredientMatching';
   export { computeStatus } from '@app/utils/pantryStatus';

   // Types re-exports
   export type { UnifiedRecipe, Ingredient } from '@app/shared/interfaces';
   export type { UserPreferences } from '@app/types/FirestoreSchema';
   export type { PantryItem, PantryItemStatus } from '@app/types/PantryItem';
   export type { Leftover } from '@app/types/Leftover';
   export type { RecipeFeedback } from '@app/services/recipeFeedbackService';
   export type { RecipeHistoryItem } from '@app/utils/recipeHistory';
   export type { DietaryPreferences } from '@app/types/DietaryPreferences';
   export type { FoodPreferences } from '@app/types/FoodPreferences';
   export type { CookingPreferences, KitchenInstrument } from '@app/types/CookingPreferences';
   export type { BudgetPreferences } from '@app/types/BudgetPreferences';
   ```

2. Identify problematic imports. The following app modules have React Native dependencies that will fail in Node.js:
   - `@app/utils/mealPlanSelector` -- imports `@react-native-firebase/firestore`, `@react-native-async-storage/async-storage`, `recipeHistory` (which uses AsyncStorage)
   - `@app/utils/smartGroceryList` -- imports `@app/utils/pantryStatus` (OK) and `@app/utils/ingredientMatching` (OK), but check transitive deps
   - `@app/services/recipeFeedbackService` -- imports `@react-native-firebase/firestore` and `@react-native-firebase/auth`
   - `@app/utils/recipeHistory` -- imports `@react-native-async-storage/async-storage`

3. For modules with React Native deps, create local simulation-compatible reimplementations in `bridge/`:
   - `bridge/shimLogger.ts` -- a simple console-based logger that replaces `@app/utils/logger` if it uses React Native specific APIs.
   - For `generateMealPlan` -- since it calls `getRecipeHistory()` (AsyncStorage) internally, the simulation should NOT import it directly. Instead, action executors will re-implement the meal plan generation flow using `rankRecipes()` + their own logic, reading history from `SimFirestore`. Document this decision clearly.
   - For `buildSmartGroceryList` -- check if it can be imported. If it only depends on `ingredientMatching` and `pantryStatus` (which are pure), it should work. If it has transitive RN deps, create a local shim.

4. The `bridge/appImports.ts` file should have JSDoc comments explaining which modules are imported directly vs. shimmed, and why.

5. Configure `jest.config.js` `moduleNameMapper` to redirect any problematic transitive imports (e.g., map `@react-native-firebase/(.*)` to a mock that throws with a helpful message).

**Test requirements:**
- `bridge.test.ts` must verify that every export from `bridge/appImports.ts` is defined (not undefined):
  - `rankRecipes` is a function.
  - `computeFeatures` is a function.
  - `buildTemporalProfile` is a function.
  - `buildSeasonalProfile` is a function.
  - `buildFeedbackMap` is a function.
  - `ingredientsMatch` is a function.
  - `computeStatus` is a function.
  - `getSeason` returns a valid season for a sample date.
  - `rankRecipes` executes without error on a minimal input (empty recipe array, minimal context).
  - `computeStatus` returns correct values: `'expired'` for past date, `'expiring'` for date 2 days out, `'fresh'` for date 30 days out.

**Integration with previous work:**
- Depends on `@app/*` path alias from Prompt 1's `tsconfig.json`.
- All action executors (Prompts 7-9) import from `bridge/appImports.ts`, never directly from `@app/*`.
- If shimming is needed, it is transparent to downstream consumers.

---

### Prompt 7: Action executor interface, MealPlanAction, and CookRecipeAction

**Objective:** Define the `ActionExecutor` interface and `ActionContext` type, then implement the two most critical action executors: `MealPlanAction` (generates weekly meal plans using the ranking pipeline) and `CookRecipeAction` (simulates cooking a recipe from the current plan). These are the core simulation actions that drive all state changes.

**Files to create:**
- `KitchenSinkNew/simulation/actions/ActionExecutor.ts`
- `KitchenSinkNew/simulation/actions/MealPlanAction.ts`
- `KitchenSinkNew/simulation/actions/CookRecipeAction.ts`
- `KitchenSinkNew/simulation/__tests__/actions.test.ts` (initial tests for these two)

**Implementation guidance:**

1. Create `actions/ActionExecutor.ts` with the core interface:
   ```typescript
   import { SimFirestore } from '../data/SimFirestore';
   import { SimulationProfile, ActionType, ActionResult, DayState } from '../profiles/types';

   export interface ActionContext {
     profile: SimulationProfile;
     uid: string;
     currentDate: Date;
     dayIndex: number;
     firestore: SimFirestore;
     currentState: DayState;
     rng: () => number;   // seeded PRNG
   }

   export interface ActionExecutor {
     readonly type: ActionType;
     execute(ctx: ActionContext): Promise<ActionResult>;
   }
   ```

2. Create `actions/MealPlanAction.ts`:
   - Import `rankRecipes`, `computeFeatures`, `buildTemporalProfile`, `buildSeasonalProfile`, `buildFeedbackMap`, `getSeason` from `bridge/appImports`.
   - The `execute` method:
     1. Load all recipes via `ctx.firestore.getAllRecipes()`.
     2. Load user history via `ctx.firestore.getHistory(ctx.uid)`.
     3. Load user feedback via `ctx.firestore.getUserFeedback(ctx.uid)`.
     4. Build `FeatureContext`:
        - `userTokens`: flatten `preferences.food.favoriteIngredients` + `preferences.food.preferredCuisines`.
        - `pantryIngredients`: map `currentState.pantryItems` to their `name` field.
        - `pantryItems`: map to `PantryIngredientInfo` format with `name` and `expirationDate`.
        - `seenRecipeIds`: from history.
        - `feedbackMap`: via `buildFeedbackMap(feedback, ctx.currentDate)`.
        - `temporalProfile`: via `buildTemporalProfile(history)`.
        - `seasonalProfile`: via `buildSeasonalProfile(history, recipeTagLookup)` -- build `recipeTagLookup` from loaded recipes.
        - `currentSeason`: via `getSeason(ctx.currentDate)`.
        - `activeLeftovers`: from `currentState.leftovers` filtered to `status === 'available'`.
        - `targetDay`: `ctx.currentDate.getDay()`.
     5. Call `rankRecipes(recipes, featureContext)` to get scored recipes.
     6. Apply dietary filtering: remove recipes that violate the user's dietary constraints (pre-filter before selection). This is a safety net on top of ranking.
     7. Select top N recipes based on meal counts from cooking preferences:
        - Determine meal counts from `preferences.cooking.mealTypes` and `preferences.cooking.weeklyMealPrepCount`.
        - Default: 7 dinners if no specific breakdown is available.
     8. Reset previous meal plan flags via `ctx.firestore.resetWeeklyMealPlanFlags(ctx.uid)`.
     9. Save each selected recipe as a user recipe with `isWeeklyMealPlan: true`.
     10. Return the plan in `ActionResult.data`.

3. Create `actions/CookRecipeAction.ts`:
   - The `execute` method:
     1. Get current meal plan from `currentState.currentMealPlan`.
     2. Get already-cooked recipe IDs from `currentState.cookedToday` and history for this week.
     3. Pick an uncooked recipe from the plan (prefer the first uncooked one; use `rng` for tie-breaking).
     4. If no uncooked recipes remain, return `{ success: false, error: 'No uncooked recipes in plan' }`.
     5. Add a `RecipeHistoryItem` via `ctx.firestore.addHistoryItem()` with today's date and a meal type derived from the recipe's tags or defaulting to 'dinner'.
     6. Return the cooked recipe in `ActionResult.data`.

**Test requirements:**
- `actions.test.ts` with mocked `SimFirestore`:
  - `MealPlanAction`:
    - Given a set of mock recipes and a vegan profile, the returned plan contains only vegan-tagged recipes.
    - Given empty recipe list, returns `success: false`.
    - Result includes the correct action type `'generate_meal_plan'`.
  - `CookRecipeAction`:
    - Given a meal plan with 3 recipes and 0 cooked, picks one and returns it.
    - Given a meal plan where all are cooked, returns `success: false`.
    - Result adds a history item (verify firestore mock was called).

**Integration with previous work:**
- Imports `SimFirestore` from Prompt 3.
- Imports bridge exports from Prompt 6.
- Imports types from Prompt 4.
- These actions are registered in the `ActionRegistry` (Prompt 9) and invoked by `DaySimulator` (Prompt 10).

---

### Prompt 8: FeedbackAction, PantryAction, GroceryRestockAction

**Objective:** Implement three more action executors that handle the feedback loop, pantry lifecycle, and grocery restocking. These actions create the "living" simulation where user state evolves over time, enabling meaningful quality metrics.

**Files to create:**
- `KitchenSinkNew/simulation/actions/FeedbackAction.ts`
- `KitchenSinkNew/simulation/actions/PantryAction.ts`
- `KitchenSinkNew/simulation/actions/GroceryRestockAction.ts`
- Add tests to `KitchenSinkNew/simulation/__tests__/actions.test.ts`

**Implementation guidance:**

1. Create `actions/FeedbackAction.ts`:
   - `execute` method:
     1. Get the most recently cooked recipe from `currentState.cookedToday` (last element). If empty, return `success: false`.
     2. Look up the recipe in `currentState.currentMealPlan` to access its tags/ingredients.
     3. Generate a feedback rating based on profile alignment:
        - Check if recipe matches dietary preferences (all flags satisfied): bias positive.
        - Check if recipe contains any disliked ingredients (from `preferences.food.dislikedIngredients`): bias negative.
        - Use `ctx.rng()` to generate stochastic feedback:
          - Aligned recipe: `isLiked = rng() < 0.8`, rating = 3 + Math.floor(rng() * 3) (range 3-5).
          - Misaligned recipe: `isDisliked = rng() < 0.7`, rating = 1 + Math.floor(rng() * 2) (range 1-2).
          - Neutral: rating = 2 + Math.floor(rng() * 3) (range 2-4).
     4. Construct `RecipeFeedback` object with `feedbackDate: ctx.currentDate`, `isCooked: true`.
     5. Save via `ctx.firestore.saveFeedback()`.

2. Create `actions/PantryAction.ts`:
   - `execute` method:
     1. Import `computeStatus` from bridge.
     2. Get current pantry items from `currentState.pantryItems`.
     3. For each item, recompute status using `computeStatus(item.expirationDate)` relative to `ctx.currentDate`. **Important:** `computeStatus` uses `new Date()` internally -- we may need to pass the simulated date. If `computeStatus` cannot accept a custom "now" date, compute days-until-expiry manually in the action and set status directly.
     4. Remove expired items with probability 0.8 (use `ctx.rng()`): call `ctx.firestore.removePantryItem()`.
     5. If any recipes were cooked today (`currentState.cookedToday`), reduce quantities of matching pantry ingredients:
        - For each cooked recipe, look up its ingredients.
        - For each ingredient, find a matching pantry item using token overlap (simple string matching).
        - Reduce quantity by 1 (or the recipe's ingredient amount). If quantity reaches 0, remove the item.
     6. Update changed items via `ctx.firestore.updatePantryItem()`.

3. Create `actions/GroceryRestockAction.ts`:
   - `execute` method:
     1. Try to import `buildSmartGroceryList` from bridge. If it is not available (shimmed out), implement a simpler restock logic.
     2. Get current pantry and current meal plan.
     3. Identify needed ingredients: recipe ingredients from the current meal plan that are NOT in the pantry.
     4. Generate a grocery list of those items.
     5. "Purchase" the items -- add them to pantry via `ctx.firestore.addPantryItem()` with:
        - Realistic expiration dates based on category:
          - Produce: 5-10 days from `ctx.currentDate` (use `rng` for variance).
          - Dairy: 7-14 days.
          - Meat/Seafood: 3-5 days.
          - Pantry staples (grains, spices, oils): 60-180 days.
          - Frozen: 30-90 days.
        - Use `categorizeIngredient(name: string): string` helper that maps ingredient names to categories using keyword matching.
     6. Save the grocery list document via `ctx.firestore.saveGroceryList()`.

**Test requirements:**
- Add to `actions.test.ts`:
  - `FeedbackAction`:
    - With a cooked recipe matching dietary prefs, feedback is biased positive (run 100 times, >60% liked).
    - With a cooked recipe containing disliked ingredients, feedback is biased negative.
    - With no cooked recipes today, returns `success: false`.
  - `PantryAction`:
    - Expired items are removed (given a pantry with 1 expired item, it gets removed).
    - Items used in cooking have reduced quantity.
    - Zero-quantity items are removed.
  - `GroceryRestockAction`:
    - After restock, pantry contains new items from the grocery list.
    - Expiration dates are within expected ranges per category.
    - Each new item has a valid `category` field.

**Integration with previous work:**
- Uses `SimFirestore` from Prompt 3.
- Uses bridge imports from Prompt 6 (`computeStatus`, `ingredientsMatch`, optionally `buildSmartGroceryList`).
- `FeedbackAction` feeds data that the `FeedbackLoopTracker` (Prompt 13) analyzes.
- `PantryAction` state changes are tracked by `PantryUtilizationTracker` (Prompt 12) and `ExpiryTracker` (Prompt 12).
- `GroceryRestockAction` replenishes the pantry, keeping the simulation from stalling on empty-pantry states.

---

### Prompt 9: SwapRecipeAction, InsightsAction, and ActionRegistry

**Objective:** Implement the remaining two action executors and create the `ActionRegistry` that maps `ActionType` to `ActionExecutor` instances. This completes the action layer.

**Files to create:**
- `KitchenSinkNew/simulation/actions/SwapRecipeAction.ts`
- `KitchenSinkNew/simulation/actions/InsightsAction.ts`
- `KitchenSinkNew/simulation/actions/ActionRegistry.ts`
- Add tests to `KitchenSinkNew/simulation/__tests__/actions.test.ts`

**Implementation guidance:**

1. Create `actions/SwapRecipeAction.ts`:
   - `execute` method:
     1. Get current meal plan from `currentState.currentMealPlan`.
     2. If plan is empty or has fewer than 2 recipes, return `success: false`.
     3. Pick a random recipe index using `ctx.rng()`.
     4. Load all recipes, re-rank excluding current plan recipes.
     5. Select the top-ranked replacement.
     6. Replace the selected recipe in the user's saved recipes:
        - Remove old recipe's `isWeeklyMealPlan` flag.
        - Save new recipe with `isWeeklyMealPlan: true`.
     7. Return both old and new recipe IDs in `ActionResult.data`.

2. Create `actions/InsightsAction.ts`:
   - `execute` method (read-only, no side effects on user state):
     1. Compute weekly stats from `currentState`:
        - `recipesCooked`: count of history items in the last 7 days.
        - `pantryUtilization`: `pantryItems.length > 0 ? usedItems / pantryItems.length : 0`.
        - `uniqueRecipes`: count of unique recipe IDs cooked this week.
        - `cuisineVariety`: count of unique cuisines from cooked recipes.
     2. Return insights data in `ActionResult.data`.
     3. This is used for quality tracking purposes only.

3. Create `actions/ActionRegistry.ts`:
   ```typescript
   import { ActionExecutor } from './ActionExecutor';
   import { ActionType } from '../profiles/types';
   import { MealPlanAction } from './MealPlanAction';
   import { CookRecipeAction } from './CookRecipeAction';
   import { FeedbackAction } from './FeedbackAction';
   import { PantryAction } from './PantryAction';
   import { GroceryRestockAction } from './GroceryRestockAction';
   import { SwapRecipeAction } from './SwapRecipeAction';
   import { InsightsAction } from './InsightsAction';

   export class ActionRegistry {
     private executors: Map<ActionType, ActionExecutor>;

     constructor() {
       this.executors = new Map();
       this.register(new MealPlanAction());
       this.register(new CookRecipeAction());
       this.register(new FeedbackAction());
       this.register(new PantryAction());
       this.register(new GroceryRestockAction());
       this.register(new SwapRecipeAction());
       this.register(new InsightsAction());
     }

     private register(executor: ActionExecutor): void {
       this.executors.set(executor.type, executor);
     }

     get(type: ActionType): ActionExecutor {
       const executor = this.executors.get(type);
       if (!executor) throw new Error(`No executor registered for action type: ${type}`);
       return executor;
     }

     // Note: 'log_leftover' is handled inline by CookRecipeAction
     // (leftover creation is a sub-step of cooking, not a separate executor)
   }
   ```

   Design decision note: The `log_leftover` action type from the scheduler does not have its own executor. Instead, the `DaySimulator` (Prompt 10) handles leftover logging as a post-cook step inline, creating a `Leftover` document when the `log_leftover` action fires after a `cook_recipe`. This avoids an unnecessary indirection since leftover data comes directly from the just-cooked recipe.

**Test requirements:**
- Add to `actions.test.ts`:
  - `SwapRecipeAction`:
    - Given a meal plan with 5 recipes, one gets swapped and the new one is different.
    - Given an empty meal plan, returns `success: false`.
  - `InsightsAction`:
    - Returns computed stats with non-negative values.
    - Is read-only: no `SimFirestore` write methods called.
  - `ActionRegistry`:
    - `get('generate_meal_plan')` returns a `MealPlanAction` instance.
    - `get('cook_recipe')` returns a `CookRecipeAction` instance.
    - All 7 registered action types are retrievable.
    - `get('unknown_type')` throws an error.

**Integration with previous work:**
- Imports all action executors from Prompts 7-8.
- `ActionRegistry` is injected into `DaySimulator` (Prompt 10).
- `InsightsAction` data feeds quality trackers.

---

### Prompt 10: ActionScheduler and DaySimulator engine

**Objective:** Build the `ActionScheduler` (determines which actions occur on a given day based on engagement tier and probabilities) and the `DaySimulator` (executes a single simulated day by running scheduled actions, checking invariants, and recording quality data). Together these form the simulation engine's inner loop.

**Files to create:**
- `KitchenSinkNew/simulation/engine/ActionScheduler.ts`
- `KitchenSinkNew/simulation/engine/DaySimulator.ts`
- `KitchenSinkNew/simulation/__tests__/actionScheduler.test.ts`

**Implementation guidance:**

1. Create `engine/ActionScheduler.ts`:

   ```typescript
   import { EngagementTier, ActionType, DayState } from '../profiles/types';

   export interface ScheduledAction {
     type: ActionType;
     probability: number;
     params?: Record<string, any>;
   }

   // Probability tables from design doc Section 4c
   const ACTION_PROBABILITIES: Record<EngagementTier, Record<ActionType, number>> = {
     high: {
       generate_meal_plan: 1.0,
       cook_recipe: 0.85,
       log_leftover: 0.70,
       give_feedback: 0.80,
       update_pantry: 0.90,
       grocery_restock: 0.95,
       swap_recipe: 0.20,
       check_insights: 0.70,
     },
     medium: {
       generate_meal_plan: 1.0,
       cook_recipe: 0.55,
       log_leftover: 0.25,
       give_feedback: 0.30,
       update_pantry: 0.40,
       grocery_restock: 0.60,
       swap_recipe: 0.05,
       check_insights: 0.10,
     },
     low: {
       generate_meal_plan: 0.5,
       cook_recipe: 0.25,
       log_leftover: 0.05,
       give_feedback: 0.05,
       update_pantry: 0.10,
       grocery_restock: 0.20,
       swap_recipe: 0.0,
       check_insights: 0.0,
     },
   };
   ```

   The `scheduleActions` function:
   - Accepts `tier`, `dayIndex`, `currentState`, and `rng: () => number`.
   - Determines which actions are eligible:
     - `generate_meal_plan`: only on `dayIndex % 7 === 0`. For Low tier, only on `dayIndex % 14 === 0` with 50% chance.
     - `cook_recipe`: any day (can fire multiple times if probability allows -- but cap at 1 per day for simplicity).
     - `log_leftover`: only if a recipe was cooked (depends on cook_recipe firing).
     - `give_feedback`: only if a recipe was cooked.
     - `update_pantry`: any day.
     - `grocery_restock`: only on `dayIndex % 7 === 0` (weekly).
     - `swap_recipe`: any day, but only if a meal plan exists.
     - `check_insights`: any day.
   - For each eligible action, compare `rng()` against the probability. If `rng() < probability`, include the action.
   - Return actions in execution order: `generate_meal_plan` first, then `cook_recipe`, then `log_leftover`, then `give_feedback`, then `update_pantry`, then `grocery_restock`, then `swap_recipe`, then `check_insights`.

2. Create `engine/DaySimulator.ts`:

   ```typescript
   import { SimFirestore } from '../data/SimFirestore';
   import { ActionRegistry } from '../actions/ActionRegistry';
   import { InvariantChecker } from '../invariants/InvariantChecker';
   import { QualityTracker } from '../quality/QualityTracker';
   import { SimulationProfile, DaySnapshot, DayState, ActionResult } from '../profiles/types';
   import { ActionContext } from '../actions/ActionExecutor';
   import { scheduleActions } from './ActionScheduler';
   import { getSeason } from '../bridge/appImports';

   export class DaySimulator {
     constructor(
       private firestore: SimFirestore,
       private actions: ActionRegistry,
       private invariantChecker: InvariantChecker,
       private qualityTracker: QualityTracker,
     ) {}

     async simulateDay(
       profile: SimulationProfile,
       dayIndex: number,
       currentDate: Date,
       rng: () => number,
     ): Promise<DaySnapshot> { ... }
   }
   ```

   The `simulateDay` method:
   1. Load current state from Firestore into a `DayState` object:
      - `pantryItems` from `firestore.getPantryItems()`
      - `leftovers` from `firestore.getLeftovers()`
      - `currentMealPlan` from `firestore.getUserRecipes()` filtered to `isWeeklyMealPlan === true`
      - `recipeHistory` from `firestore.getHistory()`
      - `feedbackHistory` from `firestore.getUserFeedback()`
      - `cookedToday: []` (empty at start of day)
   2. Call `scheduleActions(profile.engagementTier, dayIndex, currentState, rng)`.
   3. Build `ActionContext` from profile, uid, currentDate, dayIndex, firestore, currentState, rng.
   4. Execute each scheduled action sequentially via `this.actions.get(action.type).execute(ctx)`:
      - Wrap in try/catch. On error, create `ActionResult` with `success: false` and `error` message. Never abort the day.
      - After `cook_recipe` succeeds, update `currentState.cookedToday` with the cooked recipe ID.
      - After `log_leftover`, if a recipe was cooked, create a `Leftover` entry in Firestore with `remainingServings = recipe.servings - 1`, `estimatedExpiryDate = currentDate + 3 days`.
   5. After all actions, if a meal plan was generated this day, run `invariantChecker.check(plan, profile, currentDate)`.
   6. Record the day snapshot via `qualityTracker.record(snapshot)`.
   7. Build and return the `DaySnapshot`.

**Test requirements:**
- `actionScheduler.test.ts`:
  - High tier, day 0: includes `generate_meal_plan` (probability 1.0 on meal plan day).
  - Low tier, day 3: does NOT include `generate_meal_plan` (not a plan day).
  - Low tier, day 0: may or may not include `generate_meal_plan` (50% on every-other-week).
  - Actions are returned in correct execution order.
  - With `rng` always returning 0.0 (everything fires), all eligible actions are included.
  - With `rng` always returning 0.99 (nothing fires except probability=1.0), only guaranteed actions appear.
  - Monte Carlo: run 1000 iterations for Medium tier day 0. Verify `cook_recipe` fires approximately 55% of the time (tolerance +/-10%).

**Integration with previous work:**
- Uses `ActionRegistry` from Prompt 9.
- Uses `InvariantChecker` from Prompt 11 (will be passed in; can use a no-op stub during initial testing).
- Uses `QualityTracker` from Prompt 12-13 (same -- stub initially).
- `DaySimulator` is called by `SimulationRunner` (Prompt 15) in the 90-day loop.

---

### Prompt 11: Invariant checkers (Dietary, Repetition, Instrument)

**Objective:** Implement the three invariant checker rules and the `InvariantChecker` orchestrator. These run after every meal plan generation to detect correctness violations -- the primary signal for whether the recommendation engine is working properly.

**Files to create:**
- `KitchenSinkNew/simulation/invariants/InvariantChecker.ts`
- `KitchenSinkNew/simulation/invariants/DietaryInvariant.ts`
- `KitchenSinkNew/simulation/invariants/RepetitionInvariant.ts`
- `KitchenSinkNew/simulation/invariants/InstrumentInvariant.ts`
- `KitchenSinkNew/simulation/__tests__/invariants.test.ts`

**Implementation guidance:**

1. Define the `InvariantRule` interface in `InvariantChecker.ts`:
   ```typescript
   import { UnifiedRecipe } from '../bridge/appImports';
   import { SimulationProfile, InvariantViolation } from '../profiles/types';

   export interface InvariantRule {
     name: string;
     check(
       plan: UnifiedRecipe[],
       profile: SimulationProfile,
       dayIndex: number,
       date: string,
     ): InvariantViolation[];
   }

   export class InvariantChecker {
     private rules: InvariantRule[];

     constructor() {
       this.rules = [
         new DietaryInvariant(),
         new RepetitionInvariant(),
         new InstrumentInvariant(),
       ];
     }

     check(
       plan: UnifiedRecipe[],
       profile: SimulationProfile,
       dayIndex: number,
       date: Date,
     ): InvariantViolation[] {
       const dateStr = date.toISOString().split('T')[0];
       return this.rules.flatMap(rule => rule.check(plan, profile, dayIndex, dateStr));
     }
   }
   ```

2. Create `DietaryInvariant.ts`:
   - Import `ingredientsMatch` from bridge.
   - For each recipe in the plan, check against the profile's dietary preferences:
     - `vegan`: recipe must have a `vegan` tag (case-insensitive search in `recipe.tags`).
     - `vegetarian`: recipe must have a `vegetarian` tag.
     - `glutenFree`: recipe must have a `gluten-free` or `gluten free` tag.
     - `dairyFree`: recipe must have a `dairy-free` or `dairy free` tag.
     - `nutFree`: recipe must have a `nut-free` or `nut free` tag.
     - `lowCarb`: recipe must have a `low-carb`, `low carb`, or `keto` tag.
   - For each allergy in `preferences.dietary.allergies`:
     - Check each recipe ingredient name using `ingredientsMatch(ingredientName, allergyName)`.
     - Also check recipe title for the allergen keyword.
   - For each restriction in `preferences.dietary.restrictions`:
     - Check recipe tags and ingredient names for violation (e.g., `no_red_meat` should flag recipes with beef, lamb, pork ingredients).
   - All dietary violations have `severity: 'critical'`.

3. Create `RepetitionInvariant.ts`:
   - Check for duplicate `recipe.id` values within the plan.
   - Use a `Set` to track seen IDs. If a duplicate is found, create a violation.
   - `severity: 'warning'`.

4. Create `InstrumentInvariant.ts`:
   - Define `INSTRUMENT_KEYWORDS` mapping instrument names to regex patterns:
     ```typescript
     const INSTRUMENT_KEYWORDS: Record<string, RegExp> = {
       oven: /\b(bak(e|ed|ing)|roast(ed|ing)?|oven)\b/i,
       grill: /\b(grill(ed|ing)?|bbq|barbecue)\b/i,
       air_fryer: /\b(air[- ]?fr(y|ied|yer|ying))\b/i,
       slow_cooker: /\b(slow[- ]?cook(er|ed|ing)?|crock[- ]?pot)\b/i,
       pressure_cooker: /\b(pressure[- ]?cook(er|ed|ing)?|instant[- ]?pot)\b/i,
       microwave: /\b(microwave[d]?)\b/i,
       stove_top: /\b(saut[eé](ed|ing)?|stir[- ]?fr(y|ied|ying)|pan[- ]?fr(y|ied|ying)|boil(ed|ing)?|simmer(ed|ing)?|stove)\b/i,
       toaster_oven: /\b(toast(er|ed|ing)?[- ]?oven)\b/i,
     };
     ```
   - For each recipe: extract required instruments by testing the recipe `title` and `tags` (joined) against each regex.
   - Compare against `profile.preferences.cooking.kitchenInstruments`.
   - If a recipe requires an instrument the user lacks, create a violation with `severity: 'warning'`.
   - Recipes with no detected instruments always pass (they may be no-cook recipes).

**Test requirements:**
- `invariants.test.ts`:
  - **DietaryInvariant:**
    - Vegan profile + all-vegan plan: 0 violations.
    - Vegan profile + plan containing one recipe without 'vegan' tag: 1 violation with `severity: 'critical'`.
    - Profile with peanut allergy + recipe with "peanut butter" ingredient: 1 violation.
    - Profile with peanut allergy + recipe with no peanut ingredients: 0 violations.
    - `glutenFree` profile + recipe with 'gluten-free' tag: 0 violations.
    - `glutenFree` profile + recipe without gluten-free tag: 1 violation.
  - **RepetitionInvariant:**
    - Plan with 7 unique recipe IDs: 0 violations.
    - Plan with 1 duplicate ID: 1 violation with `severity: 'warning'`.
    - Plan with same title but different IDs: 0 violations (titles can repeat).
  - **InstrumentInvariant:**
    - Recipe titled "Grilled Chicken" + profile with `['grill']`: 0 violations.
    - Recipe titled "Grilled Chicken" + profile with `['oven', 'stove_top']` (no grill): 1 violation.
    - Recipe titled "Fresh Salad" (no instrument keywords): 0 violations for any profile.
    - Profile with empty `kitchenInstruments` + recipe requiring oven: 1 violation.
  - **InvariantChecker (orchestrator):**
    - Runs all 3 rules and aggregates results.

**Integration with previous work:**
- Uses `ingredientsMatch` from Prompt 6's bridge.
- `InvariantChecker` is injected into `DaySimulator` (Prompt 10).
- Violations are stored in `DaySnapshot` and aggregated in `SimulationResult` for the report (Prompt 14).

---

### Prompt 12: Quality trackers (Diversity, PantryUtilization, ExpiryTracker)

**Objective:** Implement three of the five quality metric trackers. These passively observe each day's snapshot and compute running statistics about recommendation quality, pantry usage efficiency, and expiry-driven suggestions.

**Files to create:**
- `KitchenSinkNew/simulation/quality/MetricTracker.ts` (interface)
- `KitchenSinkNew/simulation/quality/DiversityTracker.ts`
- `KitchenSinkNew/simulation/quality/PantryUtilizationTracker.ts`
- `KitchenSinkNew/simulation/quality/ExpiryTracker.ts`
- `KitchenSinkNew/simulation/__tests__/qualityTrackers.test.ts` (initial)

**Implementation guidance:**

1. Define the `MetricTracker` interface in `quality/MetricTracker.ts`:
   ```typescript
   import { DaySnapshot } from '../profiles/types';

   export interface MetricTracker {
     name: string;
     record(snapshot: DaySnapshot): void;
     finalize(): Record<string, any>;
     reset(): void;
   }
   ```

2. Create `quality/DiversityTracker.ts`:
   - Tracks recipe diversity over sliding 2-week (14-day) windows.
   - Internal state: array of `{ dayIndex: number, recipeIds: string[], cuisines: string[] }` for each day where recipes were recommended.
   - `record(snapshot)`: if `snapshot.mealPlanGenerated`, extract recipe IDs and cuisines from `stateAfter.currentMealPlan` and store.
   - `finalize()`: compute sliding windows of 14 days. For each window:
     - `recipeDiversity = uniqueRecipeIds.size / totalRecommended`
     - `cuisineDiversity = uniqueCuisines.size / totalRecommended`
   - Return `{ mean, min, max, perWindow }` across all windows.

3. Create `quality/PantryUtilizationTracker.ts`:
   - Tracks what fraction of pantry items are used in each meal plan.
   - Internal state: array of `{ dayIndex: number, utilization: number }` for each meal plan generation.
   - `record(snapshot)`: if `snapshot.mealPlanGenerated`:
     - Get pantry items from `snapshot.stateAfter.pantryItems`.
     - Get recipe ingredients from `snapshot.stateAfter.currentMealPlan`.
     - Count pantry items whose name token-overlaps with any recipe ingredient.
     - `utilization = matchedPantryItems / totalPantryItems` (0 if pantry empty).
   - `finalize()`: compute `mean`, `trend` (linear regression slope over the `perPlan` array -- positive slope means improving utilization over time).

4. Create `quality/ExpiryTracker.ts`:
   - Tracks whether expiring pantry items appear in the current meal plan (rescue rate).
   - Internal state: counters for `totalExpiring` and `totalRescued`.
   - `record(snapshot)`:
     - Identify pantry items with `status === 'expiring'` (or compute from `expirationDate` if status is not set).
     - For each expiring item, check if any recipe in `currentMealPlan` uses an ingredient matching that item (token overlap).
     - Increment counters.
   - `finalize()`: return `{ rescueRate: totalRescued / totalExpiring, totalExpiring, totalRescued }`. Handle division by zero (0 expiring -> rescue rate = 1.0).

**Test requirements:**
- `qualityTrackers.test.ts`:
  - **DiversityTracker:**
    - Feed 2 snapshots with identical 7-recipe plans: diversity < 1.0 (since same recipes repeated).
    - Feed 2 snapshots with completely unique recipe sets: diversity = 1.0.
    - Empty plan (no meal plan generated): no data recorded.
  - **PantryUtilizationTracker:**
    - Pantry with 10 items, 5 used in plan: utilization = 0.5.
    - Empty pantry: utilization = 0.
    - Three data points [0.3, 0.5, 0.7]: positive trend slope.
    - Three data points [0.7, 0.5, 0.3]: negative trend slope.
  - **ExpiryTracker:**
    - 1 expiring item, recipe uses it: rescue rate = 1.0.
    - 2 expiring items, 0 rescued: rescue rate = 0.0.
    - 0 expiring items: rescue rate = 1.0 (no items to rescue).

**Integration with previous work:**
- Uses `DaySnapshot` from Prompt 4's types.
- These trackers are aggregated by `QualityTracker` (Prompt 13).
- Results feed into `QualityMetrics` which is part of `SimulationResult` for reporting (Prompt 14).

---

### Prompt 13: Quality trackers (FeedbackLoop, SeasonalRelevance) and QualityTracker orchestrator

**Objective:** Implement the two remaining quality trackers (feedback loop effectiveness and seasonal relevance) and the `QualityTracker` orchestrator that combines all five trackers. This completes the quality measurement layer.

**Files to create:**
- `KitchenSinkNew/simulation/quality/FeedbackLoopTracker.ts`
- `KitchenSinkNew/simulation/quality/SeasonalRelevanceTracker.ts`
- `KitchenSinkNew/simulation/quality/QualityTracker.ts`
- Add tests to `KitchenSinkNew/simulation/__tests__/qualityTrackers.test.ts`

**Implementation guidance:**

1. Create `quality/FeedbackLoopTracker.ts`:
   - Tracks whether user feedback (likes/dislikes) influences future meal plans.
   - Internal state:
     - `feedbackEvents: Array<{ dayIndex: number, recipeId: string, score: number }>` -- records when user rates a recipe.
     - `planEvents: Array<{ dayIndex: number, recipeIds: string[] }>` -- records generated meal plans.
   - `record(snapshot)`:
     - Extract feedback actions from `snapshot.actionsExecuted` where type is `give_feedback`.
     - If a meal plan was generated, record the recipe IDs.
   - `finalize()`:
     - For each feedback event, look at the next 2 meal plans generated after that event.
     - Compute how often liked recipes (score > 0) appear in subsequent plans (positive correlation).
     - Compute how often disliked recipes (score < 0) appear in subsequent plans (negative correlation -- lower appearance = better).
     - Use Spearman rank correlation if enough data, otherwise simple frequency ratios.
     - `netEffectiveness = positiveCorrelation - negativeCorrelation`.

2. Create `quality/SeasonalRelevanceTracker.ts`:
   - Tracks how well meal plans match the current season.
   - Define seasonal tag sets:
     ```typescript
     const SEASONAL_TAGS: Record<Season, string[]> = {
       winter: ['soup', 'stew', 'comfort', 'warm', 'roast', 'roasted', 'baked', 'braised'],
       summer: ['salad', 'grill', 'grilled', 'fresh', 'cold', 'light', 'bbq', 'raw'],
       spring: ['fresh', 'light', 'herb', 'green', 'salad'],
       fall: ['harvest', 'squash', 'pumpkin', 'apple', 'warm', 'roast', 'roasted', 'comfort'],
     };
     ```
   - Internal state: `perSeason: Record<Season, { matched: number, total: number }>`.
   - `record(snapshot)`:
     - If a meal plan was generated, determine `snapshot.season`.
     - For each recipe in the plan, check if any of its tags match the current season's tag set.
     - Increment matched/total counters for that season.
   - `finalize()`: return `{ meanMatchRate, perSeason }` where per-season values are `matched / total`.

3. Create `quality/QualityTracker.ts`:
   ```typescript
   import { MetricTracker } from './MetricTracker';
   import { DiversityTracker } from './DiversityTracker';
   import { PantryUtilizationTracker } from './PantryUtilizationTracker';
   import { FeedbackLoopTracker } from './FeedbackLoopTracker';
   import { SeasonalRelevanceTracker } from './SeasonalRelevanceTracker';
   import { ExpiryTracker } from './ExpiryTracker';
   import { DaySnapshot, QualityMetrics } from '../profiles/types';

   export class QualityTracker {
     private trackers: MetricTracker[];

     constructor() {
       this.trackers = [
         new DiversityTracker(),
         new PantryUtilizationTracker(),
         new FeedbackLoopTracker(),
         new SeasonalRelevanceTracker(),
         new ExpiryTracker(),
       ];
     }

     record(snapshot: DaySnapshot): void {
       for (const tracker of this.trackers) {
         tracker.record(snapshot);
       }
     }

     finalize(): QualityMetrics {
       // Assemble QualityMetrics from each tracker's finalize() output
       const [diversity, pantry, feedback, seasonal, expiry] = this.trackers.map(t => t.finalize());
       return {
         diversity: diversity as QualityMetrics['diversity'],
         pantryUtilization: pantry as QualityMetrics['pantryUtilization'],
         feedbackLoop: feedback as QualityMetrics['feedbackLoop'],
         seasonalRelevance: seasonal as QualityMetrics['seasonalRelevance'],
         expiryDriven: expiry as QualityMetrics['expiryDriven'],
       };
     }

     reset(): void {
       for (const tracker of this.trackers) {
         tracker.reset();
       }
     }
   }
   ```

**Test requirements:**
- Add to `qualityTrackers.test.ts`:
  - **FeedbackLoopTracker:**
    - User likes recipe A on day 3. Plan on day 7 includes A: positive correlation > 0.
    - User dislikes recipe B on day 3. Plan on day 7 includes B: negative correlation > 0 (bad).
    - User dislikes recipe B on day 3. Plan on day 7 excludes B: negative correlation = 0 (good).
    - No feedback events: all correlations = 0.
  - **SeasonalRelevanceTracker:**
    - Winter plan with all 'soup'/'stew' tagged recipes: match rate = 1.0.
    - Summer plan with all 'soup' tagged recipes: match rate = 0.0.
    - Mixed plan: match rate between 0 and 1.
  - **QualityTracker (orchestrator):**
    - `record()` delegates to all 5 trackers (verify no errors).
    - `finalize()` returns a complete `QualityMetrics` object with all 5 sections populated.
    - `reset()` clears all tracker state.

**Integration with previous work:**
- Uses `DiversityTracker`, `PantryUtilizationTracker`, `ExpiryTracker` from Prompt 12.
- `QualityTracker` is injected into `DaySimulator` (Prompt 10).
- `QualityMetrics` is stored in `SimulationResult` and rendered by the report generator (Prompt 14).

---

### Prompt 14: Report generators (RawDataExporter, SummaryReportGenerator)

**Objective:** Build the report generation layer that transforms simulation results into actionable output: raw JSON/CSV files per profile for detailed analysis, and a Markdown summary report with tables, violation logs, and quality metric trends.

**Files to create:**
- `KitchenSinkNew/simulation/reports/RawDataExporter.ts`
- `KitchenSinkNew/simulation/reports/SummaryReportGenerator.ts`

**Implementation guidance:**

1. Create `reports/RawDataExporter.ts`:
   ```typescript
   import { SimulationResult, DaySnapshot } from '../profiles/types';
   import { stringify } from 'csv-stringify/sync';
   import * as fs from 'fs';
   import * as path from 'path';

   export class RawDataExporter {
     private outputDir: string;

     constructor(outputDir: string = path.join(__dirname, '..', 'output')) {
       this.outputDir = outputDir;
     }

     exportJSON(profileId: string, result: SimulationResult): string {
       const dir = path.join(this.outputDir, profileId);
       fs.mkdirSync(dir, { recursive: true });
       const filePath = path.join(dir, 'raw.json');
       fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
       return filePath;
     }

     exportCSV(profileId: string, result: SimulationResult): string {
       const dir = path.join(this.outputDir, profileId);
       fs.mkdirSync(dir, { recursive: true });
       const rows = result.days.map(day => ({
         day: day.dayIndex,
         date: day.date,
         season: day.season,
         actionsExecuted: day.actionsExecuted.filter(a => a.success).length,
         actionsFailed: day.actionsExecuted.filter(a => !a.success).length,
         recipesCooked: day.recipesCooked,
         mealPlanGenerated: day.mealPlanGenerated ? 1 : 0,
         pantrySize: day.stateAfter.pantryItems.length,
         leftoverCount: day.stateAfter.leftovers.filter(l => l.status === 'available').length,
         violationCount: day.violations.length,
       }));
       const csv = stringify(rows, { header: true });
       const filePath = path.join(dir, 'daily.csv');
       fs.writeFileSync(filePath, csv);
       return filePath;
     }
   }
   ```

2. Create `reports/SummaryReportGenerator.ts`:
   - `generate(results: SimulationResult[]): string` returns a Markdown string.
   - Report sections (matching design doc Section 4g):

   **Section 1: Executive Summary**
   - Total profiles simulated, total days, total violations.
   - Pass/fail summary per invariant type (dietary, repetition, instrument).
   - Overall quality metric averages.

   **Section 2: Per-Profile Cards (table)**
   ```markdown
   | Profile | Tier | Days | Plans Generated | Violations | Diversity | Pantry Util | Feedback Eff |
   |---------|------|------|-----------------|------------|-----------|-------------|--------------|
   ```

   **Section 3: Invariant Violation Log**
   ```markdown
   | Profile | Day | Date | Type | Recipe | Detail | Severity |
   |---------|-----|------|------|--------|--------|----------|
   ```
   - Sorted by severity (critical first), then by profile, then by day.
   - Cap at 100 entries with a "... and N more" note if exceeded.

   **Section 4: Quality Metric Trends**
   - For each metric: aggregate mean, std, min, max across all profiles.
   - Flag outlier profiles (more than 1.5 std from mean).

   **Section 5: Flagged Issues**
   - Profiles with >5 violations.
   - Profiles with diversity < 0.5.
   - Profiles where feedback loop `netEffectiveness < 0`.
   - Profiles where pantry utilization trend is negative (declining).
   - Profiles where expiry rescue rate < 0.2.

   The report also writes to `output/summary.md`.

**Test requirements:**
- No unit tests for report generators (output format testing is brittle). Verified via the smoke test in Prompt 15.
- Manual verification: inspect generated Markdown renders correctly.

**Integration with previous work:**
- Consumes `SimulationResult` objects from the engine (Prompts 10, 15).
- Uses `csv-stringify` from Prompt 1's package.json.
- Output directory is the `simulation/output/` directory (gitignored from Prompt 1).

---

### Prompt 15: SimulationRunner, CLI entry point, npm scripts, and smoke test

**Objective:** Wire everything together into the `SimulationRunner` orchestrator, the CLI entry point with argument parsing, and a full end-to-end smoke test (1 profile, 7 days). This is the final prompt that makes the simulation runnable.

**Files to create:**
- `KitchenSinkNew/simulation/engine/SimulationRunner.ts`
- `KitchenSinkNew/simulation/index.ts`
- `KitchenSinkNew/simulation/__tests__/integration.test.ts`

**Files to modify:**
- `KitchenSinkNew/package.json` (add simulation scripts)

**Implementation guidance:**

1. Create `engine/SimulationRunner.ts`:
   ```typescript
   import { SimFirestore } from '../data/SimFirestore';
   import { SimAuth } from '../data/SimAuth';
   import { initializeEmulatorApp, verifyEmulatorConnection, verifyRecipeData } from '../data/emulatorConnection';
   import { ActionRegistry } from '../actions/ActionRegistry';
   import { InvariantChecker } from '../invariants/InvariantChecker';
   import { QualityTracker } from '../quality/QualityTracker';
   import { DaySimulator } from './DaySimulator';
   import { RawDataExporter } from '../reports/RawDataExporter';
   import { SummaryReportGenerator } from '../reports/SummaryReportGenerator';
   import { generateArchetypeProfiles } from '../profiles/archetypeProfiles';
   import { generateRandomProfiles } from '../profiles/randomProfiles';
   import { SimulationProfile, SimulationResult, ProfileDefinition } from '../profiles/types';
   import seedRandom from 'seed-random';

   export interface SimulationOptions {
     profileCount?: number;      // default 20 (10 archetype + 10 random)
     daysPerProfile?: number;    // default 90
     seed?: number;              // global seed, default 42
     archetypeOnly?: boolean;    // only run archetype profiles
     randomOnly?: boolean;       // only run random profiles
     profileIds?: string[];      // run specific profile IDs only
   }

   export class SimulationRunner {
     async run(options: SimulationOptions = {}): Promise<SimulationResult[]> { ... }
   }
   ```

   The `run` method:
   1. **Pre-flight checks:**
      - Call `verifyEmulatorConnection()`.
      - Call `verifyRecipeData()` and log recipe count.
   2. **Initialize components:**
      - `const app = initializeEmulatorApp()`
      - `const simAuth = new SimAuth(app)`
      - `const simFirestore = new SimFirestore(app)`
      - `const actionRegistry = new ActionRegistry()`
      - `const invariantChecker = new InvariantChecker()`
   3. **Generate profiles:**
      - Generate archetype profiles (10) and random profiles (up to `profileCount - 10`).
      - Assign seeds: archetype profiles get seeds 1-10, random profiles get seeds 11-20.
      - Filter by `profileIds` if specified.
   4. **For each profile:**
      - `await simAuth.deleteAllUsers()` (clean slate per profile, or reuse).
      - `const uid = await simAuth.createUser(profile)`.
      - Assign `profile.uid = uid`.
      - Set user preferences via `simFirestore.setPreferences()`.
      - Seed starting pantry via `simFirestore.addPantryItem()` for each item.
      - Create a `QualityTracker` instance (fresh per profile).
      - Create a `DaySimulator` instance.
      - Create a seeded `rng` function from `seedRandom(String(profile.seed))`.
      - Loop `daysPerProfile` days:
        - Compute `currentDate` by adding `dayIndex` days to `profile.simulationStartDate`.
        - Call `daySimulator.simulateDay(profile, dayIndex, currentDate, rng)`.
        - Collect `DaySnapshot`.
      - Finalize quality metrics via `qualityTracker.finalize()`.
      - Build `SimulationResult`.
      - Export raw data via `RawDataExporter`.
      - Clean up user data via `simFirestore.clearUserData(uid)` and `simAuth.deleteUser(uid)`.
   5. **Generate summary report** from all `SimulationResult` objects.
   6. Return results.

2. Create `index.ts` (CLI entry point):
   ```typescript
   import yargs from 'yargs';
   import { hideBin } from 'yargs/helpers';
   import { SimulationRunner } from './engine/SimulationRunner';
   import chalk from 'chalk';

   async function main() {
     const argv = await yargs(hideBin(process.argv))
       .option('profiles', { type: 'number', default: 20, describe: 'Number of profiles to simulate' })
       .option('days', { type: 'number', default: 90, describe: 'Days per profile' })
       .option('seed', { type: 'number', default: 42, describe: 'Global PRNG seed' })
       .option('archetype-only', { type: 'boolean', default: false })
       .option('random-only', { type: 'boolean', default: false })
       .option('profile-ids', { type: 'array', string: true, describe: 'Specific profile IDs to run' })
       .help()
       .argv;

     console.log(chalk.bold('Kitchen Sink Simulation Harness'));
     console.log(chalk.gray(`Profiles: ${argv.profiles}, Days: ${argv.days}, Seed: ${argv.seed}`));

     const runner = new SimulationRunner();
     const startTime = Date.now();

     const results = await runner.run({
       profileCount: argv.profiles,
       daysPerProfile: argv.days,
       seed: argv.seed,
       archetypeOnly: argv.archetypeOnly,
       randomOnly: argv.randomOnly,
       profileIds: argv.profileIds,
     });

     const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
     const totalViolations = results.reduce((sum, r) => sum + r.totalViolations.length, 0);

     console.log(chalk.bold.green(`\nSimulation complete in ${elapsed}s`));
     console.log(`Profiles: ${results.length}`);
     console.log(`Total violations: ${totalViolations === 0 ? chalk.green('0') : chalk.red(String(totalViolations))}`);
     console.log(`Reports written to simulation/output/`);
   }

   main().catch(err => {
     console.error(chalk.red('Simulation failed:'), err.message);
     process.exit(1);
   });
   ```

3. Add scripts to root `KitchenSinkNew/package.json`:
   ```json
   "simulate": "cd simulation && npx tsx index.ts",
   "simulate:test": "cd simulation && npx tsx index.ts --profiles 1 --days 7",
   "simulate:emulator": "cd simulation && firebase emulators:start --import=seed-data/export"
   ```

4. Create `__tests__/integration.test.ts`:
   - This test requires the Firebase Emulator to be running and seeded with recipe data. Mark it with a `@integration` tag or put it behind an environment variable check (`process.env.EMULATOR_RUNNING`).
   - Test flow:
     1. Initialize emulator connection.
     2. Verify recipe data exists (skip test if not).
     3. Generate 1 archetype profile (archetype-02, the "Large Family Mediterranean Cook" -- a known-safe profile with no extreme constraints).
     4. Run `SimulationRunner` with `{ profileCount: 1, daysPerProfile: 7, profileIds: ['archetype-02'] }`.
     5. Assert: result array has 1 element.
     6. Assert: `result[0].days.length === 7`.
     7. Assert: at least 1 meal plan was generated (check `days.some(d => d.mealPlanGenerated)`).
     8. Assert: pantry state changed from initial (compare day 0 pantry to day 6 pantry).
     9. Assert: 0 invariant violations for this safe profile.
     10. Assert: quality metrics are populated (`diversity.mean > 0`, `pantryUtilization.mean >= 0`).
     11. Assert: raw JSON output file was written to `output/archetype-02/raw.json`.
     12. Assert: summary report was generated at `output/summary.md`.

**Test requirements:**
- Integration test as described above.
- Unit test: `SimulationRunner` generates correct number of profiles (mock out the emulator).
- Unit test: CLI argument parsing produces correct `SimulationOptions` for `--profiles 5 --days 30 --seed 123`.

**Integration with previous work:**
- Brings together every component from Prompts 1-14.
- `SimulationRunner` is the top-level orchestrator that chains: profile generation (Prompts 4-5), data layer (Prompts 2-3), engine (Prompt 10), invariants (Prompt 11), quality (Prompts 12-13), and reports (Prompt 14).
- The smoke test validates the entire pipeline end-to-end.
