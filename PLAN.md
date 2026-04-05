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
