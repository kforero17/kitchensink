# Simulation Harness -- Detailed Design

## 1. Overview

An automated simulation harness that creates 20 synthetic user profiles, simulates 90 days of app usage per profile against the Firebase Emulator Suite, and produces correctness/quality reports. The harness reuses the app's pure computation modules (ranking, feature engineering, meal plan selection) while replacing React Native Firebase and AsyncStorage dependencies with a `firebase-admin`-backed data layer.

## 2. Requirements Summary

| Dimension | Detail |
|---|---|
| Profiles | 10 hand-crafted archetypes + 10 randomly generated |
| Duration | ~90 simulated days per profile |
| Runtime | Firebase Emulator Suite (Firestore + Auth) |
| Recipe data | Production Firestore export imported into emulator |
| Execution | `npm run simulate` -- standalone Node.js script |
| External APIs | None -- all data in Firebase |
| Correctness invariants | Dietary violations, intra-week repetition, instrument mismatches |
| Quality metrics | Diversity, pantry utilization, feedback loop, seasonal relevance, expiry-driven suggestions |
| Output | Raw JSON/CSV per profile + summary Markdown/HTML report |

## 3. Architecture

```
+------------------------------------------------------------------+
|                    Simulation Orchestrator                        |
|  (drives 90-day loop, dispatches actions, collects results)      |
+----------+-----------------------+-------------------------------+
           |                       |
           v                       v
+---------------------+  +-------------------------------+
| Simulation Data     |  | Pure Computation (REUSED)     |
| Layer               |  |                               |
| - SimFirestore      |  | - rankRecipes()               |
| - SimAuth           |  | - computeFeatures()           |
| (firebase-admin     |  | - buildTemporalProfile()      |
|  talking to         |  | - buildSeasonalProfile()      |
|  emulator)          |  | - buildFeedbackMap()          |
+---------------------+  | - generateMealPlan()          |
                          | - buildSmartGroceryList()     |
                          | - computeStatus()             |
                          | - ingredientsMatch()          |
                          +-------------------------------+
```

**Data flow per simulated day:**

```
Orchestrator
  |
  +--> DaySimulator.plan(profile, day)
  |      |
  |      +--> ActionScheduler (engagement tier -> action list)
  |      |
  |      +--> for each action:
  |             ActionExecutor
  |               reads state via SimFirestore
  |               calls pure computation
  |               writes state via SimFirestore
  |
  +--> InvariantChecker.check(daySnapshot)
  |
  +--> QualityTracker.record(daySnapshot)
  |
  +--> DaySnapshot captured
```

## 4. Components and Interfaces

### 4a. Simulation Data Layer

```typescript
// simulation/data/SimFirestore.ts
class SimFirestore {
  constructor(app: admin.app.App);

  // Recipes (global)
  getAllRecipes(): Promise<UnifiedRecipe[]>;
  getRecipeById(id: string): Promise<UnifiedRecipe | null>;
  getRecipesByTags(tags: string[]): Promise<UnifiedRecipe[]>;

  // User preferences
  setPreferences(uid: string, prefs: UserPreferences): Promise<void>;
  getPreferences(uid: string): Promise<UserPreferences>;

  // Pantry
  addPantryItem(uid: string, item: PantryItem): Promise<string>;
  getPantryItems(uid: string): Promise<PantryItem[]>;
  updatePantryItem(uid: string, id: string, update: Partial<PantryItem>): Promise<void>;
  removePantryItem(uid: string, id: string): Promise<void>;

  // Leftovers
  addLeftover(uid: string, leftover: Leftover): Promise<string>;
  getLeftovers(uid: string): Promise<Leftover[]>;
  updateLeftover(uid: string, id: string, update: Partial<Leftover>): Promise<void>;

  // Feedback
  saveFeedback(recipeId: string, uid: string, fb: RecipeFeedback): Promise<void>;
  getUserFeedback(uid: string): Promise<RecipeFeedback[]>;

  // Saved recipes (user collection)
  saveRecipe(uid: string, recipe: RecipeDocument): Promise<string>;
  getUserRecipes(uid: string): Promise<RecipeDocument[]>;
  resetWeeklyMealPlanFlags(uid: string): Promise<void>;

  // Grocery lists
  saveGroceryList(uid: string, list: GroceryListDocument): Promise<string>;

  // Weekly rankings
  saveWeeklyRanking(weekOf: string, data: any): Promise<void>;

  // Recipe history (stored in Firestore subcollection instead of AsyncStorage)
  addHistoryItem(uid: string, item: RecipeHistoryItem): Promise<void>;
  getHistory(uid: string): Promise<RecipeHistoryItem[]>;
}
```

```typescript
// simulation/data/SimAuth.ts
class SimAuth {
  constructor(app: admin.app.App);

  createUser(profile: SimulationProfile): Promise<string>; // returns uid
  deleteUser(uid: string): Promise<void>;
  deleteAllUsers(): Promise<void>;
}
```

Connection setup:

```typescript
// simulation/data/emulatorConnection.ts
function initializeEmulatorApp(): admin.app.App {
  const app = admin.initializeApp({ projectId: 'kitchensink-sim' });
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  return app;
}
```

### 4b. Profile Generator

#### 10 Hand-Crafted Archetypes

| # | Name | Dietary | Cuisine | Skill | Instruments | Engagement | Start Date | Edge Case Tested |
|---|---|---|---|---|---|---|---|---|
| 1 | Vegan College Student | vegan | Thai, Mexican, Indian | beginner | microwave, stove_top | Medium | Jan 15 (winter) | Strict vegan + minimal instruments |
| 2 | Large Family Mediterranean Cook | none | Mediterranean, Greek, Italian | advanced | stove_top, oven, grill, slow_cooker | High | Mar 1 (spring) | householdSize=6, high servings |
| 3 | Busy Professional with Allergies | glutenFree, nutFree; allergies: [peanut, tree nuts, shellfish] | Japanese, Korean, American | intermediate | microwave, pressure_cooker, stove_top | Low | Jun 1 (summer) | Multiple allergies + low engagement |
| 4 | Keto Fitness Enthusiast | lowCarb | American, Mediterranean | intermediate | grill, air_fryer, oven, stove_top | High | Sep 1 (fall) | Low-carb constraint + high engagement |
| 5 | Vegetarian Indian Grandparent | vegetarian; allergies: [mushroom] | Indian, Middle Eastern | advanced | stove_top, oven, pressure_cooker | Medium | Dec 1 (winter) | Vegetarian + allergy + seasonal shift |
| 6 | Dairy-Free Single Parent | dairyFree | Mexican, Caribbean, Chinese | beginner | stove_top, microwave, slow_cooker | High | Apr 15 (spring) | Dairy-free + beginner + high engagement |
| 7 | Gluten-Free Weekend Warrior | glutenFree | Italian, French, Spanish | advanced | oven, stove_top, grill, toaster_oven, air_fryer | Low | Jul 1 (summer) | GF + weekends_only frequency + low engagement |
| 8 | Budget-Conscious Meal Prepper | none | Vietnamese, Thai, Korean | intermediate | stove_top, pressure_cooker, microwave | High | Oct 15 (fall) | Tight budget ($30/week), high prep count |
| 9 | Pescatarian Newlywed | restrictions: [no_red_meat, no_poultry]; allergies: [soy] | Japanese, Mediterranean, French | intermediate | stove_top, oven, grill | Medium | Feb 1 (winter) | Custom restrictions + soy allergy |
| 10 | Raw Vegan Minimalist | vegan; restrictions: [no_cooked_food] | American, Thai, Caribbean | beginner | none (no instruments) | Low | Aug 1 (summer) | Zero instruments -- maximum constraint relaxation |

```typescript
// simulation/profiles/archetypeProfiles.ts
function generateArchetypeProfiles(): SimulationProfile[];
```

Each profile includes:

```typescript
interface ProfileDefinition {
  name: string;
  preferences: UserPreferences;
  engagementTier: EngagementTier;
  startingPantry: PantryItem[];
  simulationStartDate: string; // ISO date
}
```

#### Random Profile Generator

```typescript
// simulation/profiles/randomProfiles.ts
function generateRandomProfiles(count: number, seed?: number): SimulationProfile[];
```

Strategy:
- Use seeded PRNG (`seed-random` or similar) for reproducibility
- Randomly select 0-3 dietary flags (ensuring no contradictions, e.g. not both vegan + lowCarb simultaneously)
- Random 1-4 cuisines from the 15 options
- Random skill level, cooking frequency, cooking duration
- Random 2-5 kitchen instruments
- Random engagement tier (weighted: 40% Medium, 30% High, 30% Low)
- Random start date (one per month Jan-Oct to cover all seasons)
- Random starting pantry of 5-15 items appropriate to dietary prefs

### 4c. Day Simulator

```typescript
// simulation/engine/DaySimulator.ts
class DaySimulator {
  constructor(
    private firestore: SimFirestore,
    private actions: ActionRegistry,
    private invariantChecker: InvariantChecker,
    private qualityTracker: QualityTracker,
  );

  async simulateDay(
    profile: SimulationProfile,
    dayIndex: number,        // 0..89
    currentDate: Date,       // simulated date
  ): Promise<DaySnapshot>;
}
```

**Action probabilities per engagement tier:**

| Action | High | Medium | Low |
|---|---|---|---|
| Generate meal plan (weekly, on day 0 of week) | 1.0 | 1.0 | 0.5 (alternating weeks) |
| Cook a recipe from plan | 0.85/day | 0.55/day | 0.25/day |
| Log leftover after cooking | 0.70 | 0.25 | 0.05 |
| Rate/feedback cooked recipe | 0.80 | 0.30 | 0.05 |
| Update pantry (consume cooked ingredients) | 0.90 | 0.40 | 0.10 |
| Grocery restock (weekly) | 0.95 | 0.60 | 0.20 |
| Swap recipe in current plan | 0.20 | 0.05 | 0.0 |
| Check weekly insights | 0.70 | 0.10 | 0.0 |

Meal plan generation triggers on `dayIndex % 7 === 0` (or `dayIndex % 14 === 0` for Low tier with 50% chance).

```typescript
// simulation/engine/ActionScheduler.ts
interface ScheduledAction {
  type: ActionType;
  probability: number;
  params?: Record<string, any>;
}

type ActionType =
  | 'generate_meal_plan'
  | 'cook_recipe'
  | 'log_leftover'
  | 'give_feedback'
  | 'update_pantry'
  | 'grocery_restock'
  | 'swap_recipe'
  | 'check_insights';

function scheduleActions(
  tier: EngagementTier,
  dayIndex: number,
  currentState: DayState,
): ScheduledAction[];
```

The scheduler uses a seeded PRNG per profile to ensure reproducibility. Each action's probability is compared against the PRNG output to decide execution.

### 4d. Action Executors

All executors implement:

```typescript
// simulation/actions/ActionExecutor.ts
interface ActionExecutor {
  execute(ctx: ActionContext): Promise<ActionResult>;
}

interface ActionContext {
  profile: SimulationProfile;
  uid: string;
  currentDate: Date;
  dayIndex: number;
  firestore: SimFirestore;
  currentState: DayState;
  rng: () => number; // seeded PRNG
}

interface ActionResult {
  type: ActionType;
  success: boolean;
  data?: any;
  error?: string;
}
```

#### MealPlanAction

```typescript
// simulation/actions/MealPlanAction.ts
class MealPlanAction implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    // 1. Load all recipes from SimFirestore
    // 2. Load user history, feedback, pantry, leftovers from SimFirestore
    // 3. Build FeatureContext:
    //    - userTokens from preferences (fav ingredients, cuisines)
    //    - pantryIngredients from current pantry
    //    - pantryItems with expiration info
    //    - seenRecipeIds from history
    //    - feedbackMap from buildFeedbackMap()
    //    - temporalProfile from buildTemporalProfile()
    //    - seasonalProfile from buildSeasonalProfile()
    //    - currentSeason from getSeason(currentDate)
    //    - activeLeftovers
    // 4. Call rankRecipes(recipes, featureContext)
    // 5. Map top scored recipes to Recipe format
    // 6. Call generateMealPlan(rankedRecipes, preferences, mealCounts)
    // 7. Save meal plan via SimFirestore
    // 8. Return plan for invariant checking
  }
}
```

#### CookRecipeAction

```typescript
class CookRecipeAction implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    // 1. Pick a recipe from current meal plan (prefer uncookd ones)
    // 2. Record usage in history via SimFirestore
    // 3. Consume pantry ingredients (reduce quantities, remove if 0)
    // 4. Return cooked recipe info for leftover/feedback actions
  }
}
```

#### FeedbackAction

```typescript
class FeedbackAction implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    // 1. Get most recently cooked recipe
    // 2. Generate feedback based on profile alignment:
    //    - Recipes matching dietary prefs: bias toward positive (70-90% like)
    //    - Recipes with disliked ingredients: bias negative (70-90% dislike)
    //    - Random rating 1-5 with profile-appropriate distribution
    // 3. Save via SimFirestore.saveFeedback()
  }
}
```

#### PantryAction

```typescript
class PantryAction implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    // 1. Update expiration statuses using computeStatus()
    // 2. Remove expired items (probability 0.8)
    // 3. Reduce quantities of items used in cooking
    // 4. Mark items with updated status
  }
}
```

#### GroceryRestockAction

```typescript
class GroceryRestockAction implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    // 1. Generate grocery list using buildSmartGroceryList()
    // 2. Add purchased items to pantry via SimFirestore
    // 3. Assign realistic expiration dates:
    //    - Produce: 5-10 days
    //    - Dairy: 7-14 days
    //    - Meat: 3-5 days
    //    - Pantry staples: 60-180 days
    //    - Frozen: 30-90 days
  }
}
```

#### SwapRecipeAction

```typescript
class SwapRecipeAction implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    // 1. Pick a random recipe from current meal plan
    // 2. Re-rank available recipes excluding current plan
    // 3. Select top-ranked replacement of same meal type
    // 4. Update meal plan in SimFirestore
  }
}
```

#### InsightsAction

```typescript
class InsightsAction implements ActionExecutor {
  async execute(ctx: ActionContext): Promise<ActionResult> {
    // 1. Compute weekly stats: recipes cooked, pantry utilization, variety
    // 2. Store insights snapshot (for quality tracking)
    // No side effects on user state -- read-only action
  }
}
```

### 4e. Invariant Checker

Runs after every `generate_meal_plan` action.

```typescript
// simulation/invariants/InvariantChecker.ts
class InvariantChecker {
  private checkers: InvariantRule[];

  constructor() {
    this.checkers = [
      new DietaryInvariant(),
      new RepetitionInvariant(),
      new InstrumentInvariant(),
    ];
  }

  check(plan: UnifiedRecipe[], profile: SimulationProfile, date: Date): InvariantViolation[];
}

interface InvariantRule {
  name: string;
  check(plan: UnifiedRecipe[], profile: SimulationProfile): InvariantViolation[];
}
```

#### DietaryInvariant

```typescript
class DietaryInvariant implements InvariantRule {
  name = 'dietary';

  check(plan: UnifiedRecipe[], profile: SimulationProfile): InvariantViolation[] {
    // For each recipe in the plan:
    //   - If user.vegetarian: recipe.tags must include 'vegetarian'
    //   - If user.vegan: recipe.tags must include 'vegan'
    //   - If user.glutenFree: recipe.tags must include 'gluten-free'
    //   - If user.dairyFree: recipe.tags must include 'dairy-free'
    //   - If user.nutFree: recipe.tags must include 'nut-free'
    //   - For each allergy: no recipe ingredient should match (via ingredientsMatch)
    //   - For each restriction: check against recipe tags/ingredients
  }
}
```

#### RepetitionInvariant

```typescript
class RepetitionInvariant implements InvariantRule {
  name = 'repetition';

  check(plan: UnifiedRecipe[], profile: SimulationProfile): InvariantViolation[] {
    // Check for duplicate recipe IDs within the plan
    // Flag any recipe appearing more than once
  }
}
```

#### InstrumentInvariant

```typescript
class InstrumentInvariant implements InvariantRule {
  name = 'instrument';

  check(plan: UnifiedRecipe[], profile: SimulationProfile): InvariantViolation[] {
    // For each recipe: detect required instruments from title/tags
    //   using INSTRUMENT_KEYWORDS regex patterns (from mealPlanSelector.ts)
    // Compare against profile's kitchenInstruments
    // Flag recipes requiring instruments the user lacks
  }
}
```

### 4f. Quality Tracker

```typescript
// simulation/quality/QualityTracker.ts
class QualityTracker {
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

  record(snapshot: DaySnapshot): void;
  finalize(): QualityMetrics;
}
```

#### DiversityTracker

```typescript
class DiversityTracker implements MetricTracker {
  // Tracks per sliding 2-week window:
  //   diversity = uniqueRecipeIds.size / totalRecommended
  // Also tracks cuisine diversity:
  //   cuisineDiversity = uniqueCuisines.size / totalRecommended
  // Output: mean, min, max diversity over all windows
}
```

#### PantryUtilizationTracker

```typescript
class PantryUtilizationTracker implements MetricTracker {
  // Per meal plan generation:
  //   utilization = pantryItemsUsedInPlan / totalPantryItems
  // Tracks trend: is utilization increasing over time?
  // Output: mean utilization, slope of trend line
}
```

#### FeedbackLoopTracker

```typescript
class FeedbackLoopTracker implements MetricTracker {
  // Tracks: when user likes recipe R at time T,
  //   do subsequent plans include more recipes similar to R?
  // Metric: Spearman rank correlation between feedback score
  //   and appearance frequency in next 2 plans
  // Also tracks: disliked recipes should rank lower in future plans
  // Output: positive_correlation, negative_correlation, net_effectiveness
}
```

#### SeasonalRelevanceTracker

```typescript
class SeasonalRelevanceTracker implements MetricTracker {
  // Per meal plan:
  //   seasonalMatch = recipes with season-appropriate tags / total
  // Season tags defined as:
  //   winter: ['soup', 'stew', 'comfort', 'warm', 'roast', 'baked']
  //   summer: ['salad', 'grill', 'fresh', 'cold', 'light', 'bbq']
  //   spring: ['fresh', 'light', 'herb', 'green']
  //   fall: ['harvest', 'squash', 'pumpkin', 'apple', 'warm', 'roast']
  // Output: mean seasonal match rate per season
}
```

#### ExpiryTracker

```typescript
class ExpiryTracker implements MetricTracker {
  // Tracks items that entered 'expiring' status (<=3 days to expiry)
  // Checks if any recipe in the most recent plan uses that ingredient
  // expiryRescueRate = expiringItemsInPlan / totalExpiringItems
  // Output: mean rescue rate, total expired items, total rescued items
}
```

### 4g. Report Generator

```typescript
// simulation/reports/RawDataExporter.ts
class RawDataExporter {
  exportJSON(profileId: string, result: SimulationResult): void;
  // Writes to: simulation/output/{profileId}/raw.json

  exportCSV(profileId: string, result: SimulationResult): void;
  // Writes to: simulation/output/{profileId}/daily.csv
  // Columns: day, date, season, actionsExecuted, recipesCooked,
  //          pantrySize, leftoverCount, violationCount
}
```

```typescript
// simulation/reports/SummaryReportGenerator.ts
class SummaryReportGenerator {
  generate(results: SimulationResult[]): string; // returns Markdown

  // Report sections:
  // 1. Executive Summary
  //    - Total profiles, days simulated, total violations
  //    - Pass/fail per invariant type
  //
  // 2. Per-Profile Cards (table)
  //    | Profile | Tier | Days | Plans | Violations | Diversity | Pantry Util |
  //
  // 3. Invariant Violation Log
  //    | Profile | Day | Type | Recipe | Detail |
  //
  // 4. Quality Metric Trends
  //    Per-metric: aggregate mean, std, min/max across profiles
  //    Per-profile breakdown for outliers
  //
  // 5. Flagged Issues
  //    - Profiles with >5 violations
  //    - Profiles with diversity < 0.5
  //    - Profiles where feedback loop correlation < 0
  //    - Profiles where pantry utilization is declining
}
```

## 5. Data Models

```typescript
type EngagementTier = 'high' | 'medium' | 'low';

interface SimulationProfile {
  id: string;                          // e.g. "archetype-01" or "random-07"
  name: string;                        // human label
  uid: string;                         // Firebase Auth uid (assigned at runtime)
  preferences: UserPreferences;
  engagementTier: EngagementTier;
  startingPantry: PantryItem[];
  simulationStartDate: string;         // ISO date
  seed: number;                        // PRNG seed for reproducibility
}

interface DayState {
  pantryItems: PantryItem[];
  leftovers: Leftover[];
  currentMealPlan: UnifiedRecipe[];
  recipeHistory: RecipeHistoryItem[];
  feedbackHistory: RecipeFeedback[];
  cookedToday: string[];               // recipe IDs cooked this day
}

interface DaySnapshot {
  profileId: string;
  dayIndex: number;
  date: string;                        // ISO date
  season: Season;
  actionsExecuted: ActionResult[];
  stateAfter: DayState;
  violations: InvariantViolation[];
  mealPlanGenerated: boolean;
  recipesCooked: number;
}

interface SimulationResult {
  profile: SimulationProfile;
  days: DaySnapshot[];
  qualityMetrics: QualityMetrics;
  totalViolations: InvariantViolation[];
  durationMs: number;
}

interface InvariantViolation {
  profileId: string;
  dayIndex: number;
  date: string;
  type: 'dietary' | 'repetition' | 'instrument';
  recipeId: string;
  recipeTitle: string;
  detail: string;                      // e.g. "vegan user received non-vegan recipe 'Beef Stew'"
  severity: 'critical' | 'warning';    // dietary=critical, repetition/instrument=warning
}

interface QualityMetrics {
  diversity: {
    mean: number;
    min: number;
    max: number;
    perWindow: number[];               // per 2-week window
  };
  pantryUtilization: {
    mean: number;
    trend: number;                     // slope: positive = improving
    perPlan: number[];
  };
  feedbackLoop: {
    positiveCorrelation: number;       // liked -> more similar recommended
    negativeCorrelation: number;       // disliked -> fewer similar recommended
    netEffectiveness: number;
  };
  seasonalRelevance: {
    meanMatchRate: number;
    perSeason: Record<Season, number>;
  };
  expiryDriven: {
    rescueRate: number;                // % expiring items that appeared in plan
    totalExpiring: number;
    totalRescued: number;
  };
}
```

## 6. Error Handling

| Scenario | Handling |
|---|---|
| `generateMealPlan` returns 0 recipes | Log warning. Retry with constraint relaxation (already built into `generateMealPlan` -- 4 relaxation levels). If still 0 after max relaxation, record day as "no plan generated", skip cook/feedback actions, log as anomaly in report. |
| `rankRecipes` produces tied scores | Stable sort preserves original order. No special handling needed -- ties are expected and benign. |
| Emulator connection failure | Fail fast with clear error message including emulator host/port. Exit with code 1. Pre-flight health check at startup: `GET http://localhost:8080/` before any simulation. |
| Missing recipe data (empty collection) | Pre-flight check: assert `recipes` collection has >0 documents. If empty, abort with instructions to run the data import script. |
| Pantry has 0 items | Valid state. `pantry` feature scores 0, simulation continues. Grocery restock action will add items. |
| Profile generates impossible constraints (e.g. vegan + no instruments + raw food) | Constraint relaxation kicks in. If still 0 recipes, log the day. This is intentional -- archetype #10 tests this edge case. |
| Action executor throws | Catch per-action. Log error in `ActionResult.error`. Continue to next action. Never abort the full day or profile. |

## 7. Testing Strategy

### Unit Tests

| Module | Tests |
|---|---|
| `ArchetypeProfileGenerator` | All 10 profiles generated. Each has valid `UserPreferences`. No contradictions (e.g. vegan + lowCarb not both set). Correct engagement tiers. Start dates span all 4 seasons. |
| `RandomProfileGenerator` | Generates requested count. Seeded generation is deterministic. No invalid preference combinations. All engagement tiers represented across 100-run sample. |
| `DietaryInvariant` | Pass: vegan plan with all-vegan recipes. Fail: vegan plan with one non-vegan recipe. Allergy detection with partial ingredient name match. |
| `RepetitionInvariant` | Pass: 7 unique recipes. Fail: plan with duplicate ID. Edge: same title different IDs (should pass). |
| `InstrumentInvariant` | Pass: air fryer recipe for user with air fryer. Fail: air fryer recipe for user without. Edge: recipe with no detected instruments (always passes). |
| `ActionScheduler` | High tier on day 0: includes `generate_meal_plan`. Low tier on day 3: no meal plan. Probability sanity: 1000-run Monte Carlo within expected range. |
| `DiversityTracker` | 7 unique out of 7 = 1.0. 3 unique out of 7 = 0.43. Empty plan = 0. |
| `ExpiryTracker` | Item expiring in 2 days, recipe uses it = rescued. Item expired yesterday = not counted as rescuable. |

### Integration Test

Single profile, 7 simulated days:

1. Seed emulator with recipe data
2. Create one archetype profile
3. Run 7-day simulation
4. Assert: at least 1 meal plan generated
5. Assert: pantry state changed
6. Assert: 0 invariant violations (use a known-safe profile)
7. Assert: quality metrics are populated with non-zero values
8. Assert: raw JSON output file written

```
npm run simulate:test  -->  runs 1 profile, 7 days
```

## 8. Dependencies

| Package | Purpose | Version |
|---|---|---|
| `firebase-admin` | Server-side Firestore + Auth SDK | ^12.x |
| `firebase-tools` | Emulator suite CLI | ^13.x |
| `tsx` | TypeScript execution in Node.js (replaces ts-node, faster) | ^4.x |
| `seed-random` | Deterministic PRNG for reproducibility | ^2.2 |
| `csv-stringify` | CSV output generation | ^6.x |
| `marked` | Markdown to HTML conversion (optional, for HTML report) | ^12.x |
| `chalk` | Terminal output coloring for progress | ^5.x |
| `ora` | Spinner for long-running simulation steps | ^7.x |

Dev dependencies (already in project): `typescript`, `@types/node`.

**Not needed:** `@react-native-firebase/*`, `@react-native-async-storage/*` -- these are the dependencies we are explicitly avoiding.

## 9. File Structure

```
KitchenSinkNew/simulation/
  package.json                     # separate package.json for simulation deps
  tsconfig.json                    # extends base, target=ES2022, module=Node16
  firebase.json                    # emulator config (ports, data dir)
  .firebaserc                      # project alias for emulator
  seed-data/
    import-recipes.ts              # script to export prod -> emulator
  data/
    SimFirestore.ts
    SimAuth.ts
    emulatorConnection.ts
  profiles/
    types.ts                       # SimulationProfile, EngagementTier
    archetypeProfiles.ts           # 10 hand-crafted
    randomProfiles.ts              # 10 random
    pantryTemplates.ts             # starter pantry item sets per cuisine/diet
  engine/
    DaySimulator.ts
    ActionScheduler.ts
    SimulationRunner.ts            # orchestrates all 20 profiles
  actions/
    ActionExecutor.ts              # interface + ActionContext
    MealPlanAction.ts
    CookRecipeAction.ts
    FeedbackAction.ts
    PantryAction.ts
    GroceryRestockAction.ts
    SwapRecipeAction.ts
    InsightsAction.ts
  invariants/
    InvariantChecker.ts
    DietaryInvariant.ts
    RepetitionInvariant.ts
    InstrumentInvariant.ts
  quality/
    QualityTracker.ts
    DiversityTracker.ts
    PantryUtilizationTracker.ts
    FeedbackLoopTracker.ts
    SeasonalRelevanceTracker.ts
    ExpiryTracker.ts
  reports/
    RawDataExporter.ts
    SummaryReportGenerator.ts
  output/                          # gitignored, created at runtime
    {profileId}/
      raw.json
      daily.csv
    summary.md
    summary.html
  __tests__/
    profiles.test.ts
    invariants.test.ts
    actionScheduler.test.ts
    qualityTrackers.test.ts
    integration.test.ts
  index.ts                         # entry point: npm run simulate
```

**Entry point wiring (in root `KitchenSinkNew/package.json`):**

```json
{
  "scripts": {
    "simulate": "cd simulation && npx tsx index.ts",
    "simulate:test": "cd simulation && npx tsx index.ts --profiles 1 --days 7",
    "simulate:emulator": "cd simulation && firebase emulators:start --import=seed-data/export"
  }
}
```

**Simulation `tsconfig.json`:**

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
    "paths": {
      "@app/*": ["../src/*"]
    }
  },
  "include": ["*.ts", "**/*.ts"],
  "exclude": ["node_modules", "dist", "output"]
}
```

The `@app/*` path alias allows importing pure computation modules from the main app source:

```typescript
import { rankRecipes } from '@app/ranking/rankRecipes';
import { computeFeatures } from '@app/ranking/featureEngineering';
import { buildSmartGroceryList } from '@app/utils/smartGroceryList';
```
