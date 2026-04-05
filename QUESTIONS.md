# Open Questions

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