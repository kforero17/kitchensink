# Research: Firebase Emulator Setup

## Current State
- **Project ID:** kitchensink-c4872
- **firebase.json:** Only configures Cloud Functions (nodejs18). No emulator config.
- **No emulator dependencies** in package.json (firebase-tools not installed)
- **Existing import script:** `import_allrecipes_to_firestore.js` — batch imports recipes from `allrecipes_firestore.json`

## What Needs to Be Set Up
1. Install `firebase-tools` globally or as devDependency
2. Add emulator config to `firebase.json` (Firestore + Auth emulators)
3. Export production Firestore data → import into emulator
4. The existing import script provides a template for seeding data

## Firestore Collections
- `users/{uid}/preferences` — user preference documents
- `users/{uid}/groceryLists/{listId}` — grocery lists
- `users/{uid}/recipes/{recipeId}` — saved recipes
- `users/{uid}/pantryItems/{itemId}` — pantry items
- `users/{uid}/leftovers/{leftoverId}` — leftover tracking
- `users/{uid}/appSettings/settings` — app settings
- `recipe_feedback/{recipeId}_{userId}` — global feedback collection
- `weeklyRankings/{weekOf}` — weekly ranking snapshots
- `recipes` — global recipe collection (Tasty/AllRecipes data)

## Cloud Functions
- `recipeProxy` — Spoonacular proxy (deprecated, no longer used)
- `getRecipes` — Streams Tasty recipes from Firestore with filtering/shuffle
