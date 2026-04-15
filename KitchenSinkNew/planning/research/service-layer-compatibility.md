# Research: Service Layer Node.js Compatibility

## Critical Finding
**ALL services depend on React Native Firebase** (`@react-native-firebase/*`) and cannot run in a pure Node.js environment. Several also depend on AsyncStorage.

## Compatibility Matrix

| Service | RN Firebase | AsyncStorage | Node.js Ready? |
|---------|-------------|--------------|----------------|
| firebaseService | required | none | NO |
| recommendationMealPlanService | required | none | NO |
| groceryListService | required | fallback | NO |
| pantryService | required | none | NO |
| leftoverService | async secondary | primary | NO |
| recipeFeedbackService | required | none | NO |
| insightsService | required | for history | NO |
| predictionService | required | none | NO |
| weeklyRankingService | required | none | NO |

## Pure Logic (Node.js Compatible)
These modules contain pure computation with no RN dependencies:
- `ranking/rankRecipes.ts` — weighted scoring
- `ranking/featureEngineering.ts` — feature vector computation
- `ranking/temporalPatterns.ts` — temporal signal
- `ranking/seasonalSignal.ts` — seasonal signal
- `ranking/feedbackSignal.ts` — feedback decay
- `utils/ingredientMatching.ts` — ingredient matching
- `utils/mealPlanSelector.ts` — meal plan generation logic
- `utils/smartGroceryList.ts` — grocery list optimization
- `utils/pantryStatus.ts` — pantry status calculation

## Recommended Approach
Create a **simulation data access layer** using `firebase-admin` SDK that provides the same data operations as the RN services, then wire it to the existing pure logic modules.
