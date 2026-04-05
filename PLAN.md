# Weekly Insights Dashboard

## Summary

Add a Weekly Insights Dashboard showing waste avoided ($), spending trends, nutrition summary, and streak tracking. Aggregates data from pantry + grocery history with simple charts via `react-native-chart-kit`. Includes share functionality.

## New Files

- `src/types/InsightsData.ts` — Data contract for insight cards
- `src/services/insightsService.ts` — Aggregation logic from Firestore + AsyncStorage
- `src/components/InsightCard.tsx` — Reusable card wrapper
- `src/screens/WeeklyInsightsScreen.tsx` — Dashboard with 4 cards + share

## Modified Files

- `src/navigation/AppNavigator.tsx` — Add WeeklyInsights route
- `src/screens/HomeScreen.tsx` — Add dashboard entry point
- `src/services/analyticsService.ts` — Add insights_viewed/shared events
- `package.json` — Add react-native-chart-kit + react-native-svg

## Insight Cards

1. **Waste Avoided** — $ saved by using pantry items before expiration (bar chart, 8 weeks)
2. **Spending Trends** — Estimated weekly grocery spend (line chart, 8 weeks)
3. **Nutrition Summary** — Macro breakdown from cooked recipes (pie chart)
4. **Streak Tracking** — Consecutive weeks cooking (flame icon + counter)

## Share

Text summary via React Native `Share` API — same pattern as GroceryListScreen.

---

# Predictive Meal Planning - Plan

Extends the ranking pipeline with temporal patterns, seasonal preferences, and leftover awareness to anticipate what users want to cook.

## Key Changes

1. **Temporal Pattern Analyzer** — learns day-of-week cooking habits from history
2. **Seasonal Preference Signal** — dynamically weights recipes by season based on actual usage (not static tags)
3. **Leftover Tracking** — model + service + UI for tracking uneaten portions, with ranking integration
4. **Prediction Service** — proactive "Today's Picks" combining all signals with confidence scoring
5. **3 new ranking features** — `temporalFit`, `seasonalFit`, `leftoverAware` added to the existing 7-feature pipeline

## See Also

- `IMPLEMENTATION_SPEC.md` — full technical spec with interfaces, file lists, and implementation order
- `ASSUMPTIONS.md` — design assumptions
- `QUESTIONS.md` — open questions
