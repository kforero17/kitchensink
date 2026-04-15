# Idea Honing: Automated App Testing Suite

## Finalized Requirements

### Goal
Validate correctness + evaluate recommendation quality over simulated time.

### Infrastructure
- **Runtime:** Firebase Emulator Suite (Firestore + Auth)
- **Recipe data:** Export production Firestore, import into emulator
- **External APIs:** None — all recipe data lives in Firebase
- **Execution:** Standalone script (`npm run simulate`)

### User Profiles
- **Total:** 20 (10 hand-crafted archetypes + 10 randomly generated)
- **Engagement tiers:** High, Medium, Low — assigned per profile
  - **High:** weekly meal plans, logs leftovers, rates recipes, updates pantry, swaps recipes, checks insights
  - **Medium:** weekly meal plans, occasional leftover/feedback logging, pantry updates after grocery runs
  - **Low:** meal plans every 1-2 weeks, minimal interaction beyond generation
- **Simulation duration:** ~90 days per profile

### Correctness Invariants (Priority)
1. Dietary violations (vegan user gets non-vegan recipe, etc.)
2. Recipe repetition within a meal plan week
3. Kitchen instrument mismatches (recipe requires instrument user doesn't have)

### Quality Metrics
1. Recommendation diversity over time
2. Pantry utilization improvement
3. Feedback loop effectiveness (liked recipes appear more, disliked disappear)
4. Seasonal relevance (appropriate recipes for the season)
5. Expiry-driven suggestions (soon-to-expire items get used)

### Output
- **Raw data:** JSON/CSV per profile (every recommendation, score, pantry state, etc.)
- **Summary report:** Markdown/HTML with key findings, flagged violations, quality trends
