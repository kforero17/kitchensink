const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

const SPOONACULAR_API_KEY = functions.config().spoonacular && functions.config().spoonacular.key;

if (!SPOONACULAR_API_KEY) {
  console.warn('[recipeProxy] Spoonacular API key not set in functions config');
}

/**
 * Whitelist Spoonacular fields to comply with ToS (no instructions / summary).
 */
function mapApiToAllowed(responseJson) {
  const pickMacros = (nutrients, name) => {
    const n = nutrients.find(x => x.name.toLowerCase() === name.toLowerCase());
    return n ? n.amount : 0;
  };

  return {
    id: `spn-${responseJson.id}`,
    title: responseJson.title,
    imageUrl: responseJson.image,
    readyInMinutes: responseJson.readyInMinutes,
    servings: responseJson.servings,
    ingredients: (responseJson.extendedIngredients || []).map(ing => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      original: ing.original,
    })),
    tags: [
      ...(responseJson.dishTypes || []),
      ...(responseJson.diets || []),
      ...(responseJson.cuisines || []),
    ],
    nutrition: responseJson.nutrition && responseJson.nutrition.nutrients ? {
      calories: pickMacros(responseJson.nutrition.nutrients, 'Calories'),
      protein: pickMacros(responseJson.nutrition.nutrients, 'Protein'),
      fat: pickMacros(responseJson.nutrition.nutrients, 'Fat'),
      carbs: pickMacros(responseJson.nutrition.nutrients, 'Carbohydrates'),
    } : undefined,
  };
}

exports.recipeProxy = functions.https.onRequest(async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string' || !id.startsWith('spn-')) {
      return res.status(400).json({ error: 'Invalid recipe id. Expecting spn-<number>' });
    }

    const numericId = id.replace('spn-', '');
    const apiUrl = `https://api.spoonacular.com/recipes/${numericId}/information?includeNutrition=true&apiKey=${SPOONACULAR_API_KEY}`;
    const apiResp = await fetch(apiUrl);
    if (!apiResp.ok) {
      return res.status(apiResp.status).json({ error: 'Failed to fetch from Spoonacular' });
    }
    const data = await apiResp.json();
    const allowed = mapApiToAllowed(data);
    res.set('Cache-Control', 'public,max-age=3600'); // 1h CDN cache
    return res.json(allowed);
  } catch (err) {
    console.error('[recipeProxy] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

const db = admin.firestore();

/**
 * getRecipes – lightweight public endpoint to stream Tasty recipes.
 * Query params (all optional):
 *   mealType          breakfast|lunch|dinner|snacks
 *   diet              vegan,vegetarian,low carb (comma-sep)
 *   intolerances      gluten,dairy (comma-sep)
 *   cuisine           mexican,italian,… (comma-sep)
 *   include           chicken,tomato  (comma-sep ingredients required to appear)
 *   maxReadyTime      minutes (number)
 *   seed              random seed to shuffle results
 */
exports.getRecipes = functions.region('us-central1').https.onRequest(async (req, res) => {
  try {
    // CORS & caching headers
    res.set('Access-Control-Allow-Origin', '*');
    
    // Reduce cache time if seed is present (for variety)
    const hasSeed = req.query.seed && typeof req.query.seed === 'string';
    const cacheTime = hasSeed ? 'public,max-age=60' : 'public,max-age=900'; // 1 min vs 15 min
    res.set('Cache-Control', cacheTime);

    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).send('');
    }

    const {
      mealType,
      diet,
      intolerances,
      cuisine,
      include,
      maxReadyTime,
      limit,
      seed,
    } = req.query;

    let query = db.collection('recipes')
      // Minimal fields + full instructions so the client can render steps.
      .select('name', 'ingredients', 'tags', 'imageUrl', 'readyInMinutes', 'servings', 'popularityScore', 'instructions')
      .orderBy('updatedAt', 'desc');

    // Filters
    if (mealType && typeof mealType === 'string') {
      query = query.where('tags', 'array-contains', mealType.toLowerCase());
    }
    if (diet && typeof diet === 'string') {
      diet.split(',').forEach(d => {
        query = query.where('tags', 'array-contains', d.trim().toLowerCase());
      });
    }
    if (intolerances && typeof intolerances === 'string') {
      intolerances.split(',').forEach(t => {
        query = query.where('tags', 'array-contains', t.trim().toLowerCase());
      });
    }
    if (cuisine && typeof cuisine === 'string') {
      cuisine.split(',').forEach(c => {
        query = query.where('tags', 'array-contains', c.trim().toLowerCase());
      });
    }

    const docLimit = limit ? parseInt(limit) : 250;
    query = query.limit(docLimit);

    let snap;
    try {
      snap = await query.get();
    } catch (err) {
      console.error('[getRecipes] Firestore query failed – attempting fallback without orderBy', err);
      try {
        // Remove the orderBy to avoid composite-index errors and retry once.
        // Include the full instructions array in the fallback projection so
        // that the client UI can always render preparation steps even when
        // we have to drop the ordering constraint to satisfy Firestore index
        // limitations.
        let fallbackQuery = db.collection('recipes')
          .select(
            'name',
            'ingredients',
            'tags',
            'imageUrl',
            'readyInMinutes',
            'servings',
            'popularityScore',
            'instructions' // <-- added to ensure instructions are returned
          )
          .limit(docLimit);
        snap = await fallbackQuery.get();
      } catch (fallbackErr) {
        console.error('[getRecipes] Fallback query also failed', fallbackErr);
        return res.status(500).json({ error: 'Firestore query error', details: `${fallbackErr}` });
      }
    }

    const recipes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Optional post-filter for include ingredients (because Firestore cannot OR-contains).
    let out = recipes;
    if (include && typeof include === 'string') {
      const incArr = include.toLowerCase().split(',');
      out = recipes.filter(r => {
        const ingNames = (r.ingredients || []).map(i => (i.name || i.item || '').toLowerCase());
        return incArr.every(inc => ingNames.some(n => n.includes(inc)));
      });
    }

    if (maxReadyTime && !isNaN(parseInt(maxReadyTime))) {
      const m = parseInt(maxReadyTime);
      out = out.filter(r => (r.readyInMinutes || 0) <= m);
    }

    // Shuffle results if seed is provided
    if (seed && out.length > 0) {
      // Create a simple seeded random function
      const seedHash = seed.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      // Fisher-Yates shuffle with seeded random
      const shuffled = [...out];
      let currentIndex = shuffled.length;
      let temporaryValue, randomIndex;
      
      // Simple seeded random number generator
      let randomSeed = Math.abs(seedHash);
      const seededRandom = () => {
        randomSeed = (randomSeed * 9301 + 49297) % 233280;
        return randomSeed / 233280;
      };
      
      while (currentIndex !== 0) {
        randomIndex = Math.floor(seededRandom() * currentIndex);
        currentIndex -= 1;
        temporaryValue = shuffled[currentIndex];
        shuffled[currentIndex] = shuffled[randomIndex];
        shuffled[randomIndex] = temporaryValue;
      }
      
      out = shuffled;
    }

    return res.json({ recipes: out });
  } catch (err) {
    console.error('[getRecipes] error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}); 