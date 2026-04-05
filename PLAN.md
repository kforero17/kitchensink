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
