# Implementation Spec: Simulation Harness

## Problem Statement

KitchenSink's recommendation engine, pantry tracking, grocery lists, and feedback loop need systematic testing across diverse user profiles over extended time periods. Manual testing is impractical for 20 profiles x 90 days x multiple features.

## Approach

Build a standalone Node.js simulation harness under `KitchenSinkNew/simulation/` that:
1. Runs against Firebase Emulator (Firestore + Auth)
2. Creates 20 synthetic users (10 archetypes + 10 random)
3. Simulates 90 days of usage per profile with varied engagement levels
4. Checks correctness invariants after every meal plan generation
5. Tracks quality metrics over time
6. Produces raw JSON/CSV + summary Markdown report

## Architecture

3-layer design:
- **Data Layer** (`data/`): `SimFirestore` + `SimAuth` using `firebase-admin` SDK
- **Computation** (reused): Import ranking, features, matching from `@app/*` path alias
- **Orchestrator** (`engine/`): DaySimulator, ActionScheduler, SimulationRunner

## Detailed Prompt Plan

See `planning/implementation/prompt-plan.md` for the complete 15-prompt implementation guide with inline TypeScript interfaces and test requirements.

## Implementation Order

| Phase | Prompts | Files | Description |
|-------|---------|-------|-------------|
| Infrastructure | 1 | package.json, tsconfig, firebase.json, seed script | Project scaffolding |
| Data Layer | 2-3 | emulatorConnection, SimAuth, SimFirestore | Firebase admin wrappers |
| Profiles | 4-5 | types, archetypes, random generator, pantry templates | 20 user profiles |
| Bridge | 6 | shims for RN deps | Verify @app/* imports work in Node.js |
| Actions | 7-9 | 7 action executors + registry | MealPlan, Cook, Feedback, Pantry, Grocery, Swap, Insights |
| Engine | 10 | ActionScheduler, DaySimulator | Per-day simulation loop |
| Invariants | 11 | 3 checkers | Dietary, Repetition, Instrument |
| Quality | 12-13 | 5 trackers + orchestrator | Diversity, Pantry, Feedback, Seasonal, Expiry |
| Reports | 14 | RawDataExporter, SummaryReportGenerator | JSON/CSV + Markdown |
| Runner | 15 | SimulationRunner, CLI, npm scripts | Entry point + smoke test |

## Key Decisions

- **Separate package.json** for simulation to avoid polluting the main app
- **`@app/*` path alias** to import pure computation modules without copying them
- **Seeded PRNG** (`seed-random`) for reproducible simulations
- **firebase-admin SDK** instead of React Native Firebase (not Node.js compatible)
- **Recipe history in Firestore** (instead of AsyncStorage) for the simulation context
- **`tsx`** for TypeScript execution (faster than ts-node)

## Files to Create

All under `KitchenSinkNew/simulation/`:

```
package.json, tsconfig.json, jest.config.js, firebase.json, .firebaserc, .gitignore
index.ts
seed-data/import-recipes.ts
data/emulatorConnection.ts, SimAuth.ts, SimFirestore.ts
profiles/types.ts, archetypeProfiles.ts, randomProfiles.ts, pantryTemplates.ts
engine/DaySimulator.ts, ActionScheduler.ts, SimulationRunner.ts
actions/ActionExecutor.ts, MealPlanAction.ts, CookRecipeAction.ts, FeedbackAction.ts,
        PantryAction.ts, GroceryRestockAction.ts, SwapRecipeAction.ts, InsightsAction.ts
invariants/InvariantChecker.ts, DietaryInvariant.ts, RepetitionInvariant.ts, InstrumentInvariant.ts
quality/QualityTracker.ts, DiversityTracker.ts, PantryUtilizationTracker.ts,
        FeedbackLoopTracker.ts, SeasonalRelevanceTracker.ts, ExpiryTracker.ts
reports/RawDataExporter.ts, SummaryReportGenerator.ts
__tests__/profiles.test.ts, invariants.test.ts, actionScheduler.test.ts,
          qualityTrackers.test.ts, integration.test.ts
```

## Files to Modify

- `KitchenSinkNew/package.json` — add `simulate`, `simulate:test`, `simulate:emulator` scripts

## Test Strategy

- Unit tests for profile generators, invariant checkers, action scheduler, quality trackers
- Integration test: 1 profile, 7 days, full pipeline against emulator
- Smoke test via `npm run simulate:test` (1 profile, 7 days)

## Risks

1. **@app/* imports may fail** if any reused module transitively imports React Native code — Prompt 6 addresses this with shims
2. **Firebase Emulator startup** adds latency — mitigated by running emulator separately
3. **Large recipe dataset** may slow emulator — seed only necessary subset for testing
