# PDD Summary: Automated Simulation Harness

## Artifacts

| File | Description |
|------|-------------|
| `planning/rough-idea.md` | Original concept |
| `planning/idea-honing.md` | Finalized requirements (12 questions resolved) |
| `planning/research/firebase-emulator-setup.md` | Firebase config, emulator needs, existing import scripts |
| `planning/research/service-layer-compatibility.md` | Node.js compatibility matrix for all 15 services |
| `planning/research/architecture-strategy.md` | 3-layer architecture rationale |
| `planning/design/detailed-design.md` | Full design: 9 sections, all interfaces, 10 archetypes, action probabilities, error handling |
| `planning/implementation/prompt-plan.md` | 15-prompt implementation guide with inline interfaces and test requirements |

## Design Overview

A standalone Node.js simulation harness (`KitchenSinkNew/simulation/`) that:
- Creates 20 synthetic user profiles (10 archetypes + 10 random)
- Simulates 90 days of app usage per profile against the Firebase Emulator
- Reuses the app's pure ranking/feature/matching logic via `@app/*` imports
- Replaces React Native Firebase with `firebase-admin` SDK
- Checks 3 correctness invariants (dietary, repetition, instruments) after every meal plan
- Tracks 5 quality metrics (diversity, pantry utilization, feedback loop, seasonal relevance, expiry rescue)
- Outputs raw JSON/CSV per profile + a Markdown/HTML summary report

## Implementation Approach

15 prompts in dependency order:
1. Scaffolding + emulator config
2-3. Data layer (SimAuth, SimFirestore)
4-5. Profile generators (archetypes + random)
6. Bridge verification (shim RN deps for Node.js)
7-9. Action executors (7 actions total)
10. Engine (scheduler + day simulator)
11. Invariant checkers
12-13. Quality trackers
14. Report generators
15. Runner + CLI + smoke test

## Next Steps

1. Run `/code implement` with the prompt plan, or work through prompts manually
2. Export production Firestore data for emulator seeding
3. Run the 7-day smoke test first, then full 20-profile simulation
