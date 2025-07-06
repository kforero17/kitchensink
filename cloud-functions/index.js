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