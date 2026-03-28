# Assumptions

- 60% pantry ingredient match threshold is reasonable for "Use What You Have" mode — not too strict to starve results, not too loose to be meaningless
- CookingHabitsScreen is the right place for the toggle since it's in the meal plan generation preferences flow
- Fallback to normal ranking when pantry-only mode yields <3 recipes prevents empty meal plans
- Expiry urgency thresholds (3-day max, 7-day decay) don't need to be user-configurable
- All pantry ingredients (not just top 5) should be used in pantry-only mode
