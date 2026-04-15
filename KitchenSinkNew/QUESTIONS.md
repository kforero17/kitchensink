# Open Questions

1. **Recipe data completeness** — Do all recipes in the Firestore `recipes` collection have `tags` populated? If many lack dietary tags, the dietary invariant checker will undercount violations.

Yes, tags should be populated. 

2. **Instrument keywords** — The existing `mealPlanSelector.ts` may already have instrument keyword patterns. Need to verify and reuse rather than reinvent.

3. **Feedback generation realism** — The simulation generates synthetic feedback (likes/dislikes/ratings). How realistic should this be? Currently using profile-aligned probability distributions.

Pretty realistic, have a normal distribution. 

4. **Pantry item expiration realism** — Expiration dates for restocked items are assigned by category (produce: 5-10 days, dairy: 7-14 days, etc.). Are these ranges realistic enough?
Yes. 

5. **Simulation performance** — 20 profiles x 90 days = 1800 simulated days. Each day involves Firestore reads/writes. Estimated runtime against emulator is unknown — may need to optimize if too slow.
Fine.
