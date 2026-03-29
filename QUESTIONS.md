# Questions

- Should the `source` field be removed entirely from `UnifiedRecipe`? With only `'tasty'` as a value, it's arguably redundant. Kept for now to minimize blast radius.
- Should `cachingService.ts` be deleted entirely? It was built for Spoonacular candidate caching. Firebase has its own offline cache, so this may be unnecessary.
- Should `mealPlanSelector.ts` exploration bonus be wired to a runtime recipe cache instead of returning 0? Current behavior is acceptable but slightly degrades variety scoring.
