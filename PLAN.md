# Feedback Loop: Recipe Rating Integration into Ranking

Wire user feedback (likes/dislikes/ratings) into ranking with time decay, add meal plan accept/reject tracking, and polish the onboarding UX so recommendations improve as users engage.

## Changes
1. New `feedbackSignal.ts` — builds feedback map with exponential time decay (half-life ~62 days)
2. Add `feedback` feature to FeatureVector [-1, 1] and 0.15 weight in ranking
3. Wire feedback history + seenRecipeIds into recommendation service
4. Implicit like on meal plan recipe selection, "Regenerate" button for rejection
5. Returning user UX on HomeScreen, one-time feedback prompt on MealPlanScreen
6. Analytics: meal_plan_accepted, meal_plan_regenerated events
7. Unit tests for feedback signal computation and time decay
