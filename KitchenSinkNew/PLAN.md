# Plan: Simulation Harness

Build a standalone Node.js simulation harness under `simulation/` that creates 20 synthetic user profiles, simulates 90 days of app usage per profile against the Firebase Emulator, and produces correctness + quality reports.

## Implementation Phases

1. **Infrastructure** — Project scaffolding, emulator config, seed script
2. **Data Layer** — SimFirestore + SimAuth using firebase-admin
3. **Profiles** — 10 archetypes + 10 random with pantry templates
4. **Bridge** — Verify/shim @app/* imports for Node.js
5. **Actions** — 7 executors (MealPlan, Cook, Feedback, Pantry, Grocery, Swap, Insights)
6. **Engine** — ActionScheduler (probability tables) + DaySimulator (90-day loop)
7. **Invariants** — Dietary, Repetition, Instrument checkers
8. **Quality** — 5 metric trackers (Diversity, Pantry, Feedback, Seasonal, Expiry)
9. **Reports** — JSON/CSV raw data + Markdown summary
10. **Runner** — CLI entry point with yargs, npm scripts, smoke test

## Correctness Invariants
- Dietary violations (vegan user gets non-vegan recipe)
- Recipe repetition within same week
- Kitchen instrument mismatches

## Quality Metrics
- Recommendation diversity over time
- Pantry utilization improvement
- Feedback loop effectiveness
- Seasonal relevance
- Expiry-driven rescue rate
