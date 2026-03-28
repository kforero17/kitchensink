# Assumptions

- Expired pantry items should not count toward what you "have"
- Partial pantry coverage shows adjusted quantity rather than hiding the item
- Items fully covered by pantry are shown dimmed, not removed, so user can verify
- US grocery store aisle layout (produce → meat → dairy → frozen → grains → pantry → beverages → snacks)
- Unit subtraction only happens when pantry unit and grocery unit are in the same measurement group (volume, weight, or count)
- Existing GroceryListScreen consolidation logic (parseMeasurement, standardizeQuantity, formatMeasurement) is reusable
