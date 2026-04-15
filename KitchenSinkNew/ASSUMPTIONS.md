# Assumptions

1. **Pure computation modules have no transitive RN dependencies** — ranking, feature engineering, temporal/seasonal patterns, ingredient matching are all pure TypeScript. If any transitively import RN modules, we'll create shims (addressed in Prompt 6).

2. **Production Firestore export is available** — User will export recipe data from production Firebase and make it available for emulator seeding.

3. **Recipe tags are sufficient for dietary checking** — The dietary invariant checker relies on recipe `tags` containing dietary labels (e.g., "vegan", "gluten-free"). If recipes lack these tags, dietary violation detection will be incomplete.

4. **Kitchen instrument detection via keyword matching** — Since recipes don't have a structured `requiredInstruments` field, we detect instruments from recipe title/tags using keyword patterns. This is heuristic and may miss some cases.

5. **firebase-admin v12+ works with current emulator** — The emulator protocol is stable, but version mismatches could cause issues.

6. **`seed-random` package provides sufficient PRNG quality** — For simulation reproducibility, not cryptographic security.
