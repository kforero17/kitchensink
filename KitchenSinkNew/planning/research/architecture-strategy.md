# Research: Simulation Architecture Strategy

## Key Insight
The app cleanly separates **data access** (services using RN Firebase/AsyncStorage) from **pure computation** (ranking, feature engineering, matching). The simulation can reuse ALL computation logic and only replace the data layer.

## Architecture: Three Layers

### Layer 1: Simulation Data Layer (NEW)
Replace RN Firebase + AsyncStorage with `firebase-admin` SDK talking to the emulator.
- `SimFirestoreClient` — wraps firebase-admin for Firestore ops
- `SimAuthClient` — creates test users in Auth emulator
- Mirrors the same CRUD patterns as existing services

### Layer 2: Pure Computation (REUSE)
Import directly from the existing codebase:
- Ranking engine (10-dimensional feature scoring)
- Temporal/seasonal pattern analysis
- Feedback signal computation with decay
- Ingredient matching and similarity
- Meal plan selection with constraint relaxation
- Smart grocery list generation

### Layer 3: Simulation Orchestrator (NEW)
Drives the 90-day simulation per profile:
- Profile generator (archetypes + random)
- Day simulator (advances clock, triggers user actions)
- Engagement behavior engine (high/medium/low patterns)
- Data collector (captures all decisions and outcomes)
- Report generator (raw data + summary)

## Profile Schema
Each profile defines:
- All 4 preference types (dietary, food, cooking, budget)
- Engagement tier (high/medium/low)
- Action probabilities per tier
- Starting pantry state
- Simulated season start date

## Day Simulation Loop
```
for each day in [1..90]:
  advance simulated clock
  expire stale leftovers/pantry items
  if meal plan generation day:
    generate candidates from Firebase recipes
    rank with full feature pipeline
    check correctness invariants
    record recommendations + scores
  if engagement triggers:
    log feedback on cooked recipes
    update pantry (consume/add items)
    record leftovers
    generate grocery list (if needed)
  collect daily snapshot
```

## Invariant Checks (Per Recommendation)
1. Dietary: recipe tags/ingredients vs user dietary prefs
2. Repetition: recipe ID not in same week's plan
3. Instruments: recipe requirements vs user's kitchen instruments
