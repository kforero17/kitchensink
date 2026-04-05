# Open Questions

1. **Leftover complementarity scoring**: How should we determine that "leftover rice" complements a "stir-fry" recipe? Token overlap between leftover recipe ingredients and candidate recipe ingredients? Or tag-based (both Asian cuisine)?
The former

2. **Collaborative filtering scope**: The task mentions "collaborative filtering on user history" — should we implement cross-user collaborative filtering (requires backend aggregation across users) or is single-user pattern learning sufficient for v1?

single user is fine for now

3. **Per-day meal plan slots**: Current meal plans are flat recipe lists. Should "Today's Picks" imply we need to assign recipes to specific days, or is "here are your top picks for today" sufficient?

the latter sounds fine

4. **Notification integration**: Should "Today's Picks" trigger a push notification (e.g., morning notification with breakfast suggestion)? Or is the HomeScreen card sufficient for v1?

No push notifications in v1; HomeScreen card only. Profile screen houses notification preferences for future iterations.

5. **History migration**: Existing users have up to 100 history items. Should we backfill seasonal data from Firestore recipe feedback (which has `feedbackDate`) to bootstrap the seasonal profile?

yes.

6. **Snack predictions**: Should `predictTodaysMeals` include snack as a meal type, or just breakfast/lunch/dinner? Currently breakfast/lunch/dinner only.

7. **TodaysPicks dismiss persistence**: Should dismiss state persist across app restarts via AsyncStorage, or is per-session sufficient?

8. **MealPlan alert ordering**: The leftover prompt and "Recipes Saved" alert both fire after saving — the alert may overlay the prompt on some devices. May need sequencing.

9. **RecipeFeedbackService injection**: The prediction service imports it directly. Should it use dependency injection for testability?

