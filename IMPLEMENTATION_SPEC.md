# Predictive Meal Planning - Implementation Spec

## Problem Statement

The app currently generates meal plans reactively — only when the user explicitly requests one. It has no awareness of **when** users cook (day-of-week patterns), **what season** it is (dynamic, not static), **what leftovers** exist, or how to **anticipate** what users want before they ask. The goal is to make the app proactively predict and suggest meals by learning from cooking history, temporal patterns, seasonal preferences, and leftover awareness.

## What Exists (Foundation)

- **7-feature ranking pipeline** (`ranking/featureEngineering.ts`, `ranking/rankRecipes.ts`): `sim`, `pantry`, `popularity`, `novelty`, `sourceBias`, `expiryUrgency`, `feedback` — weighted linear scoring
- **Recipe history** (`utils/recipeHistory.ts`): `RecipeHistoryItem { recipeId, usedDate, mealType }` — max 100 items in AsyncStorage
- **Feedback signals** (`ranking/feedbackSignal.ts`): likes/dislikes/ratings with exponential time decay (90-day constant)
- **Pantry tracking** with expiry urgency scoring
- **Recommendation event logging** (`services/recoLoggingService.ts`): viewed, dismissed, addedToMealPlan, rejectedWithReason
- **Static seasonal recipe data** (`data/seasonalRecipes.ts`)
- **Variety penalty** (`calculateVarietyPenalty`): recency + frequency based

## Architecture: Three New Ranking Features + Leftover Model + Prediction Service

The approach extends the existing ranking pipeline with 3 new features in `FeatureVector`, adds a leftover tracking model, and introduces a prediction service that combines all signals to anticipate user needs.

---

## Implementation Plan

### 1. Temporal Pattern Analyzer (`src/ranking/temporalPatterns.ts`)

**Purpose**: Learn day-of-week cooking patterns from history.

**Data source**: Existing `RecipeHistoryItem[]` — has `usedDate` (ISO) and `mealType`.

**Logic**:
```typescript
interface TemporalProfile {
  // day 0=Sun..6=Sat, mealType → frequency count
  dayMealFrequency: Map<number, Map<string, number>>;
  // day → total recipes cooked
  dayActivity: Map<number, number>;
  totalWeeks: number;
}

function buildTemporalProfile(history: RecipeHistoryItem[]): TemporalProfile
```

- Parse `usedDate` to extract `dayOfWeek` (0-6).
- Build frequency table: how often does the user cook `breakfast` on Monday vs Saturday?
- Normalize by `totalWeeks` to get probabilities.

**Feature output**: `temporalFit: number` in [0, 1]:
```typescript
function computeTemporalFit(
  recipe: UnifiedRecipe,
  profile: TemporalProfile,
  targetDay: number,    // day of week we're planning for
): number
```
- Extract recipe's meal type from tags (breakfast/lunch/dinner/snacks).
- Look up `dayMealFrequency[targetDay][mealType]` normalized probability.
- Higher score = user historically cooks this meal type on this day.
- Fallback: 0.5 if insufficient history (< 4 weeks).

### 2. Seasonal Preference Signal (`src/ranking/seasonalSignal.ts`)

**Purpose**: Dynamically weight recipes by season based on user's historical cooking patterns, not just static seasonal tags.

**Logic**:
```typescript
type Season = 'spring' | 'summer' | 'fall' | 'winter';

interface SeasonalProfile {
  // tag → Map<season, cookCount> (e.g., "soup" cooked 8x in winter, 1x in summer)
  tagSeasonal: Map<string, Map<Season, number>>;
}

function buildSeasonalProfile(history: RecipeHistoryItem[], recipeTagLookup: Map<string, string[]>): SeasonalProfile

function computeSeasonalFit(recipe: UnifiedRecipe, profile: SeasonalProfile, currentSeason: Season): number
```

- Determine season from `usedDate` month (Mar-May=spring, Jun-Aug=summer, Sep-Nov=fall, Dec-Feb=winter).
- Build tag-level seasonal affinity: if user cooks "soup" tagged recipes 8x in winter vs 1x in summer, "soup" has high winter affinity.
- For a candidate recipe, average the seasonal affinity of its tags for the current season.
- Output: `seasonalFit: number` in [0, 1]. Higher = recipe's tags match what user historically cooks in this season.
- Fallback: 0.5 if insufficient seasonal data.

### 3. Leftover Tracking Model

#### 3a. Data Model (`src/types/Leftover.ts`)
```typescript
interface Leftover {
  id: string;
  recipeId: string;
  recipeName: string;
  originalServings: number;
  remainingServings: number;
  cookedDate: string;          // ISO date
  estimatedExpiryDate: string; // ISO date (cookedDate + 3 days default)
  mealType: string;
  status: 'available' | 'used' | 'expired';
}
```

#### 3b. Leftover Service (`src/services/leftoverService.ts`)

- CRUD operations on AsyncStorage key `leftovers` (dual-write to Firestore `users/{uid}/leftovers` if authenticated).
- `recordLeftover(recipeId, recipeName, originalServings, portionsEaten, mealType)`: creates a leftover entry with `remainingServings = originalServings - portionsEaten`.
- `getActiveLeftovers()`: returns leftovers where `status === 'available'` and not past expiry.
- `consumeLeftover(leftoverId, portions)`: decrements `remainingServings`, marks `used` if 0.
- `expireStaleLeftovers()`: marks leftovers past `estimatedExpiryDate` as `expired`.

#### 3c. Leftover Ranking Feature

Add to `FeatureVector`:
```typescript
leftoverAware: number; // [-0.5, 1]
```

Logic in `featureEngineering.ts`:
- If active leftovers exist, **penalize** recipes that would create redundant leftovers (same cuisine/protein overlap with existing leftovers).
- **Boost** recipes that complement existing leftovers (e.g., leftover rice → stir-fry recipe).
- Score = ingredient complementarity with active leftovers minus redundancy penalty.

#### 3d. UI Integration

- After accepting a meal plan or marking a recipe as "cooked", show a bottom sheet: "How many servings did you eat? (out of X)". Remaining → leftover.
- `PantryScreen` gets a "Leftovers" section showing active leftovers with expiry countdown.

### 4. Extend FeatureVector and Weights

**`featureEngineering.ts`** changes:
```typescript
export interface FeatureVector {
  // ... existing 7 features ...
  temporalFit: number;    // NEW: day-of-week pattern match [0, 1]
  seasonalFit: number;    // NEW: seasonal preference match [0, 1]
  leftoverAware: number;  // NEW: leftover complement/redundancy [-0.5, 1]
}
```

**`rankRecipes.ts`** changes:
```typescript
export interface RankingWeights {
  // ... existing 7 weights ...
  temporalFit: number;
  seasonalFit: number;
  leftoverAware: number;
}

// Re-tuned default weights (sum = 1.0):
const DEFAULT_WEIGHTS: RankingWeights = {
  sim: 0.22,
  pantry: 0.15,
  popularity: 0.05,
  novelty: 0.08,
  sourceBias: 0.03,
  expiryUrgency: 0.10,
  feedback: 0.12,
  temporalFit: 0.10,
  seasonalFit: 0.08,
  leftoverAware: 0.07,
};

const PANTRY_ONLY_WEIGHTS: RankingWeights = {
  sim: 0.10,
  pantry: 0.20,
  popularity: 0.02,
  novelty: 0.03,
  sourceBias: 0.03,
  expiryUrgency: 0.25,
  feedback: 0.12,
  temporalFit: 0.08,
  seasonalFit: 0.07,
  leftoverAware: 0.10,
};
```

### 5. Prediction Service (`src/services/predictionService.ts`)

**Purpose**: Anticipate what the user wants — proactive "Today's suggestion" rather than waiting for explicit meal plan generation.

**Logic**:
```typescript
interface PredictedMeal {
  recipe: UnifiedRecipe;
  mealType: string;
  confidence: number;       // 0-1, how confident we are
  reasons: string[];         // human-readable explanations
}

async function predictTodaysMeals(
  prefs: UserPreferences,
  targetDate?: Date,
): Promise<PredictedMeal[]>
```

- Combines all signals: temporal patterns (what does user cook on this day?), seasonal affinity (what's in season?), active leftovers (suggest using them up), pantry expiry urgency, and feedback history.
- Runs the full ranking pipeline with `targetDay` set to today's day-of-week.
- Picks top recipe per meal type (breakfast, lunch, dinner) with confidence score.
- Confidence = weighted average of the top recipe's feature scores. Below 0.3 → don't suggest (insufficient data).
- Returns human-readable `reasons`: "You often cook pasta on Wednesdays", "Uses leftover chicken from Monday", "Tomatoes expiring tomorrow".

### 6. Extend FeatureContext

```typescript
export interface FeatureContext {
  // ... existing fields ...
  targetDay?: number;                     // NEW: day of week for temporal fit
  temporalProfile?: TemporalProfile;      // NEW: from temporalPatterns.ts
  seasonalProfile?: SeasonalProfile;      // NEW: from seasonalSignal.ts
  currentSeason?: Season;                 // NEW: current season
  activeLeftovers?: Leftover[];           // NEW: from leftoverService.ts
}
```

### 7. Wire Into Recommendation Service

**`recommendationMealPlanService.ts`** changes:
- Before calling `rankRecipes`, build `TemporalProfile` from recipe history.
- Build `SeasonalProfile` from recipe history + recipe tag lookup.
- Fetch active leftovers.
- Pass all new context fields to `rankRecipes` via `FeatureContext`.

### 8. "Today's Picks" UI Component

- New component `src/components/TodaysPicks.tsx`: card on `HomeScreen` showing predicted meals for today.
- Shows 1-3 predicted meals with confidence indicators and reason chips.
- Tap → `RecipeDetailScreen`. "Add to plan" → adds to current meal plan.
- Only shows when confidence > 0.3 (enough history data).
- Dismissible. Dismiss events logged to `recoLoggingService`.

### 9. Leftover Prompt UI

- New component `src/components/LeftoverPrompt.tsx`: bottom sheet shown after marking a recipe as cooked.
- Slider or +/- buttons for "portions eaten" out of total servings.
- Creates leftover entry if remaining > 0.
- Shown contextually from `RecipeDetailScreen` or `MealPlanScreen`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/ranking/temporalPatterns.ts` | Day-of-week pattern analysis |
| `src/ranking/temporalPatterns.test.ts` | Tests for temporal patterns |
| `src/ranking/seasonalSignal.ts` | Seasonal preference scoring |
| `src/ranking/seasonalSignal.test.ts` | Tests for seasonal signal |
| `src/types/Leftover.ts` | Leftover data model |
| `src/services/leftoverService.ts` | Leftover CRUD + expiry management |
| `src/services/leftoverService.test.ts` | Tests for leftover service |
| `src/services/predictionService.ts` | Proactive meal prediction |
| `src/services/predictionService.test.ts` | Tests for prediction service |
| `src/components/TodaysPicks.tsx` | Home screen prediction cards |
| `src/components/LeftoverPrompt.tsx` | Post-cook leftover entry UI |

## Files to Modify

| File | Changes |
|------|---------|
| `src/ranking/featureEngineering.ts` | Add `temporalFit`, `seasonalFit`, `leftoverAware` to `FeatureVector` and `FeatureContext`; compute them in `computeFeatures` |
| `src/ranking/rankRecipes.ts` | Add 3 new weights to `RankingWeights`, re-tune default/pantry-only weight sets |
| `src/services/recommendationMealPlanService.ts` | Build temporal/seasonal profiles, fetch leftovers, pass new context to ranker |
| `src/screens/HomeScreen.tsx` | Add `TodaysPicks` component |
| `src/screens/RecipeDetailScreen.tsx` | Add leftover prompt trigger after "mark as cooked" |
| `src/screens/MealPlanScreen.tsx` | Add leftover prompt trigger after accepting meal plan |
| `src/screens/PantryScreen.tsx` | Add "Leftovers" section |
| `src/types/FirestoreSchema.ts` | Add `leftovers` subcollection type |
| `src/constants/storage.ts` | Add `LEFTOVERS_KEY` constant |
| `src/tests/ranking.test.ts` | Update existing ranking tests for new features |

## Implementation Order

1. **Temporal patterns** (pure logic, no deps) — `temporalPatterns.ts` + tests
2. **Seasonal signal** (pure logic, no deps) — `seasonalSignal.ts` + tests
3. **Leftover model + service** — `Leftover.ts`, `leftoverService.ts` + tests
4. **Extend ranking pipeline** — modify `featureEngineering.ts`, `rankRecipes.ts`, update existing tests
5. **Prediction service** — `predictionService.ts` + tests (depends on 1-4)
6. **Wire into recommendation service** — modify `recommendationMealPlanService.ts`
7. **UI: TodaysPicks** — component + HomeScreen integration
8. **UI: LeftoverPrompt** — component + screen integrations
9. **UI: Pantry leftovers section** — PantryScreen modification

## Risks

- **Cold start**: New users have no history. Mitigation: all new features fall back to 0.5 (neutral) with < 4 weeks of data. Prediction confidence threshold (0.3) prevents bad suggestions.
- **History cap at 100**: May limit seasonal analysis (need ~1 year). Mitigation: bump `MAX_HISTORY_ITEMS` to 365 for temporal/seasonal analysis, or store a separate aggregated profile.
- **Leftover accuracy**: Users may not consistently log portions. Mitigation: make the prompt optional and non-blocking. Default to "ate all servings" if dismissed.
- **Weight re-tuning**: Adding 3 features changes the balance. Mitigation: weights sum to 1.0, existing features get proportionally reduced. Monitor via weekly ranking logs.

## Test Strategy

- **Unit tests** for all pure functions: `buildTemporalProfile`, `computeTemporalFit`, `buildSeasonalProfile`, `computeSeasonalFit`, leftover awareness scoring.
- **Ranking integration tests**: verify new features influence final scores correctly (extend existing `ranking.test.ts`).
- **Prediction service tests**: mock history + pantry + leftovers → verify predicted meals and confidence thresholds.
- **No mocking of data models**. Use factory helpers (`makeRecipe()`, `makeHistoryItem()`) following existing test patterns.
