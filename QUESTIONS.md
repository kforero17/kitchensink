# Open Questions

## Weekly Insights Dashboard

1. **Pantry removal tracking** — Currently, deleting a pantry item just removes it from Firestore. Should we add a `pantryHistory` collection to log removals with reason (used/expired/discarded)? This would make "waste avoided" much more accurate but adds complexity.

Yes, this makes sense.

2. **Entry point placement** — Should the Insights button go on the Home screen (more visible) or Profile screen (less cluttered home)? Current plan: Home screen.

Let's go with the profile screen.

3. **Weekly reset day** — Should the "week" start on Monday or Sunday? Current plan: Monday (ISO standard).

Monday is fine.

4. **Grocery cost accuracy** — Would users benefit from being able to enter actual grocery costs, or is the category-based estimate sufficient for now?

Give users the option to enter the grocery amount, the plan in the future would be to be able to enter receipts or connect to instacart/amazon.

5. **Week key calculation at year boundaries** — The ISO week calculation is an approximation. Streak counts could be off by 1 at year boundaries (Dec/Jan). Worth fixing with a proper ISO week library if streak accuracy matters.

6. **Insights entry point** — Currently wired to HomeScreen per the spec, but user preference was ProfileScreen (noted above). May need to move.

## Predictive Meal Planning

7. **Leftover complementarity scoring**: How should we determine that "leftover rice" complements a "stir-fry" recipe? Token overlap between leftover recipe ingredients and candidate recipe ingredients? Or tag-based (both Asian cuisine)?
The former

8. **Collaborative filtering scope**: The task mentions "collaborative filtering on user history" — should we implement cross-user collaborative filtering (requires backend aggregation across users) or is single-user pattern learning sufficient for v1?

single user is fine for now

9. **Per-day meal plan slots**: Current meal plans are flat recipe lists. Should "Today's Picks" imply we need to assign recipes to specific days, or is "here are your top picks for today" sufficient?

the latter sounds fine

10. **Notification integration**: Should "Today's Picks" trigger a push notification (e.g., morning notification with breakfast suggestion)? Or is the HomeScreen card sufficient for v1?

No push notifications in v1; HomeScreen card only. Profile screen houses notification preferences for future iterations.

11. **History migration**: Existing users have up to 100 history items. Should we backfill seasonal data from Firestore recipe feedback (which has `feedbackDate`) to bootstrap the seasonal profile?

yes.

12. **Snack predictions**: Should `predictTodaysMeals` include snack as a meal type, or just breakfast/lunch/dinner? Currently breakfast/lunch/dinner only.

13. **TodaysPicks dismiss persistence**: Should dismiss state persist across app restarts via AsyncStorage, or is per-session sufficient?

14. **MealPlan alert ordering**: The leftover prompt and "Recipes Saved" alert both fire after saving — the alert may overlay the prompt on some devices. May need sequencing.

15. **RecipeFeedbackService injection**: The prediction service imports it directly. Should it use dependency injection for testability?
