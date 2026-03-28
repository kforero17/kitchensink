import { UnifiedRecipe } from '../shared/interfaces';
import {
  computeFeatures,
  FeatureContext,
  PantryIngredientInfo,
} from '../ranking/featureEngineering';
import { rankRecipes, RankRecipesOptions } from '../ranking/rankRecipes';

function makeRecipe(
  overrides: Partial<Omit<UnifiedRecipe, 'ingredients'>> & {
    ingredients: { name: string }[];
  },
): UnifiedRecipe {
  const { ingredients, ...rest } = overrides;
  return {
    id: 'test-1',
    source: 'tasty',
    title: 'Test Recipe',
    imageUrl: '',
    readyInMinutes: 30,
    servings: 4,
    tags: ['dinner'],
    ...rest,
    ingredients: ingredients.map(i => ({
      name: i.name,
      amount: 1,
      unit: 'unit',
    })),
  };
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function baseContext(overrides: Partial<FeatureContext> = {}): FeatureContext {
  return {
    userTokens: [],
    pantryIngredients: [],
    ...overrides,
  };
}

describe('computeFeatures — pantry overlap', () => {
  it('token-based matching connects partial ingredient names', () => {
    const recipe = makeRecipe({
      ingredients: [
        { name: 'chicken thighs' },
        { name: 'jasmine rice' },
        { name: 'soy sauce' },
      ],
    });

    const ctx = baseContext({
      pantryIngredients: ['chicken breast', 'brown rice'],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.pantry).toBeCloseTo(2 / 3, 2);
  });

  it('exact full-name matching still works', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'tomato' }, { name: 'onion' }],
    });

    const ctx = baseContext({
      pantryIngredients: ['tomato'],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.pantry).toBeCloseTo(0.5, 2);
  });

  // oil-to-oil is a valid token match — stop-word filtering happens upstream in the recommendation service
  it('common tokens like "oil" cause expected matches (documenting behavior)', () => {
    const recipe = makeRecipe({
      ingredients: [
        { name: 'vegetable oil' },
        { name: 'chicken breast' },
        { name: 'garlic' },
      ],
    });

    const ctx = baseContext({
      pantryIngredients: ['olive oil'],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.pantry).toBeCloseTo(1 / 3, 2);
  });

  it('empty pantry yields zero overlap', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'chicken' }, { name: 'rice' }],
    });

    const ctx = baseContext({
      pantryIngredients: [],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.pantry).toBe(0);
  });
});

describe('computeFeatures — expiry urgency', () => {
  it('ingredient expiring in 2 days gives max urgency', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'chicken thighs' }],
    });

    const ctx = baseContext({
      pantryIngredients: ['chicken breast'],
      pantryItems: [
        { name: 'chicken breast', expirationDate: daysFromNow(2) },
      ],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.expiryUrgency).toBeCloseTo(1.0, 2);
  });

  it('ingredient expiring in 5 days gives partial urgency', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'whole milk' }],
    });

    const ctx = baseContext({
      pantryIngredients: ['milk'],
      pantryItems: [{ name: 'milk', expirationDate: daysFromNow(5) }],
    });

    const features = computeFeatures(recipe, ctx);

    // Date math uses Math.ceil on the day diff and local-vs-UTC midnight
    // can shift the effective day count by 1. Accept the range [0.25, 0.75].
    expect(features.expiryUrgency).toBeGreaterThanOrEqual(0.25);
    expect(features.expiryUrgency).toBeLessThanOrEqual(0.75);
    // Verify it is strictly between 0 and 1 (partial)
    expect(features.expiryUrgency).toBeGreaterThan(0);
    expect(features.expiryUrgency).toBeLessThan(1);
  });

  it('ingredient expiring in 10 days gives zero urgency', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'rice' }],
    });

    const ctx = baseContext({
      pantryIngredients: ['rice'],
      pantryItems: [{ name: 'rice', expirationDate: daysFromNow(10) }],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.expiryUrgency).toBeCloseTo(0, 2);
  });

  it('no expiration date gives zero urgency', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'salt' }],
    });

    const ctx = baseContext({
      pantryIngredients: ['salt'],
      pantryItems: [{ name: 'salt' }],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.expiryUrgency).toBeCloseTo(0, 2);
  });

  it('max urgency across multiple pantry matches', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'chicken' }, { name: 'rice' }],
    });

    const ctx = baseContext({
      pantryIngredients: ['chicken', 'rice'],
      pantryItems: [
        { name: 'chicken', expirationDate: daysFromNow(2) },
        { name: 'rice', expirationDate: daysFromNow(10) },
      ],
    });

    const features = computeFeatures(recipe, ctx);

    expect(features.expiryUrgency).toBeCloseTo(1.0, 2);
  });
});

describe('rankRecipes — pantry-only mode', () => {
  it('pantry-only mode filters low-match recipes', () => {
    const recipes = [
      makeRecipe({ id: 'r1', ingredients: [{ name: 'chicken' }, { name: 'rice' }] }),
      makeRecipe({ id: 'r2', ingredients: [{ name: 'beef' }, { name: 'noodles' }] }),
      makeRecipe({ id: 'r3', ingredients: [{ name: 'chicken' }] }),
      makeRecipe({ id: 'r4', ingredients: [{ name: 'tofu' }, { name: 'spinach' }] }),
      makeRecipe({ id: 'r5', ingredients: [{ name: 'rice' }] }),
    ];

    const opts: RankRecipesOptions = {
      userTokens: [],
      pantryIngredients: ['chicken', 'rice'],
      pantryOnlyMode: true,
    };

    const results = rankRecipes(recipes, opts);

    // r1 pantry=1.0, r3 pantry=1.0, r5 pantry=1.0 => 3 meet >= 0.6 threshold
    // r2 pantry=0.0, r4 pantry=0.0 => excluded
    expect(results.length).toBe(3);
    expect(results.every(r => r.features.pantry >= 0.6)).toBe(true);

    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('pantry-only mode falls back when fewer than 3 match', () => {
    const recipes = [
      makeRecipe({ id: 'r1', ingredients: [{ name: 'chicken' }, { name: 'rice' }] }),
      makeRecipe({ id: 'r2', ingredients: [{ name: 'beef' }, { name: 'noodles' }] }),
      makeRecipe({ id: 'r3', ingredients: [{ name: 'tofu' }, { name: 'spinach' }] }),
      makeRecipe({ id: 'r4', ingredients: [{ name: 'salmon' }, { name: 'lemon' }] }),
      makeRecipe({ id: 'r5', ingredients: [{ name: 'pasta' }, { name: 'tomato' }] }),
    ];

    const opts: RankRecipesOptions = {
      userTokens: [],
      pantryIngredients: ['chicken', 'rice'],
      pantryOnlyMode: true,
    };

    const results = rankRecipes(recipes, opts);

    // Only r1 has pantry >= 0.6 (1.0), so fewer than 3 => fallback returns all
    expect(results.length).toBe(5);

    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('pantry-only mode uses boosted weights', () => {
    const pantryRecipe = makeRecipe({
      id: 'pantry-heavy',
      title: 'Pantry Dish',
      ingredients: [{ name: 'chicken' }, { name: 'rice' }],
    });

    const simRecipe = makeRecipe({
      id: 'sim-heavy',
      title: 'Sim Dish',
      ingredients: [{ name: 'beef' }, { name: 'noodles' }],
    });

    const opts: RankRecipesOptions = {
      userTokens: ['beef', 'noodles', 'stir', 'fry'],
      pantryIngredients: ['chicken', 'rice'],
      pantryItems: [
        { name: 'chicken', expirationDate: daysFromNow(1) },
        { name: 'rice', expirationDate: daysFromNow(2) },
      ],
      pantryOnlyMode: true,
      pantryMatchThreshold: 0,
    };

    const results = rankRecipes([pantryRecipe, simRecipe], opts);

    // pantry-heavy: pantry=1.0, expiryUrgency=1.0 (weights: 0.30 + 0.35 = 0.65)
    // sim-heavy: sim is high (weights: 0.20), pantry=0, expiryUrgency=0
    const pantryResult = results.find(r => r.recipe.id === 'pantry-heavy')!;
    const simResult = results.find(r => r.recipe.id === 'sim-heavy')!;

    expect(pantryResult.score).toBeGreaterThan(simResult.score);
  });

  it('normal mode does not filter by pantry threshold', () => {
    const recipes = [
      makeRecipe({ id: 'r1', ingredients: [{ name: 'chicken' }, { name: 'rice' }] }),
      makeRecipe({ id: 'r2', ingredients: [{ name: 'beef' }, { name: 'noodles' }] }),
      makeRecipe({ id: 'r3', ingredients: [{ name: 'tofu' }, { name: 'spinach' }] }),
      makeRecipe({ id: 'r4', ingredients: [{ name: 'salmon' }, { name: 'lemon' }] }),
      makeRecipe({ id: 'r5', ingredients: [{ name: 'pasta' }, { name: 'tomato' }] }),
    ];

    const opts: RankRecipesOptions = {
      userTokens: [],
      pantryIngredients: ['chicken'],
      pantryOnlyMode: false,
    };

    const results = rankRecipes(recipes, opts);

    expect(results.length).toBe(5);
  });
});
