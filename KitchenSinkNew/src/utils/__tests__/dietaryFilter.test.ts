import { DietaryPreferences } from '../../types/DietaryPreferences';
import {
  DIETARY_REQUIREMENTS,
  DIETARY_TAG_MAP,
  filterByDiet,
  missingDietaryRequirements,
  passesDietaryFilter,
} from '../dietaryFilter';

function makeRecipe(tags: string[] = []): { tags: string[] } {
  return { tags };
}

function makePrefs(
  overrides: Partial<DietaryPreferences> = {},
): DietaryPreferences {
  return {
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    dairyFree: false,
    nutFree: false,
    lowCarb: false,
    allergies: [],
    restrictions: [],
    ...overrides,
  };
}

describe('passesDietaryFilter', () => {
  it('returns true when no preferences are set', () => {
    const recipe = makeRecipe([]);
    const prefs = makePrefs();

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });

  it('returns true when recipe has all required tags', () => {
    const recipe = makeRecipe(['gluten-free', 'dairy-free']);
    const prefs = makePrefs({ glutenFree: true, dairyFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });

  it('returns false when a required tag is absent', () => {
    const recipe = makeRecipe(['dairy-free']);
    const prefs = makePrefs({ glutenFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(false);
  });

  it('treats vegan tag as satisfying vegetarian requirement', () => {
    const recipe = makeRecipe(['vegan']);
    const prefs = makePrefs({ vegetarian: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });

  it('does NOT treat vegetarian tag as satisfying vegan requirement', () => {
    const recipe = makeRecipe(['vegetarian']);
    const prefs = makePrefs({ vegan: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(false);
  });

  it('is case-insensitive for tag matching', () => {
    const recipe = makeRecipe(['Gluten-Free', 'DAIRY-FREE']);
    const prefs = makePrefs({ glutenFree: true, dairyFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });

  it('handles undefined tags array gracefully', () => {
    const recipe: { tags?: string[] } = {};
    const prefs = makePrefs({ glutenFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(false);
  });

  it('handles empty tags array gracefully', () => {
    const recipe = makeRecipe([]);
    const prefs = makePrefs({ glutenFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(false);
  });

  it('rejects when only one of multiple required tags is present (gluten-free + nut-free)', () => {
    const recipe = makeRecipe(['gluten-free']);
    const prefs = makePrefs({ glutenFree: true, nutFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(false);
  });

  it('accepts when all of multiple required tags are present (gluten-free + nut-free)', () => {
    const recipe = makeRecipe(['gluten-free', 'nut-free']);
    const prefs = makePrefs({ glutenFree: true, nutFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });

  it('enforces nutFree (regression: previously skipped in production)', () => {
    const recipe = makeRecipe(['vegetarian']);
    const prefs = makePrefs({ nutFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(false);
  });

  it('enforces lowCarb (regression: previously skipped in production)', () => {
    const recipe = makeRecipe(['vegetarian']);
    const prefs = makePrefs({ lowCarb: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(false);
  });

  it('accepts spaced tag synonyms for non-mapper-normalized data', () => {
    const recipe = makeRecipe(['gluten free', 'dairy free', 'nut free']);
    const prefs = makePrefs({ glutenFree: true, dairyFree: true, nutFree: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });

  it('accepts keto as a low-carb synonym', () => {
    const recipe = makeRecipe(['keto']);
    const prefs = makePrefs({ lowCarb: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });

  it('trims whitespace around tags before matching', () => {
    const recipe = makeRecipe(['  vegan  ']);
    const prefs = makePrefs({ vegan: true });

    const result = passesDietaryFilter(recipe, prefs);

    expect(result).toBe(true);
  });
});

describe('missingDietaryRequirements', () => {
  it('returns empty array when recipe is fully compliant', () => {
    const recipe = makeRecipe(['vegan', 'gluten-free']);
    const prefs = makePrefs({ vegan: true, glutenFree: true });

    const result = missingDietaryRequirements(recipe, prefs);

    expect(result).toEqual([]);
  });

  it('returns the specific requirements that failed, not all requirements', () => {
    const recipe = makeRecipe(['gluten-free']);
    const prefs = makePrefs({ glutenFree: true, nutFree: true, lowCarb: true });

    const result = missingDietaryRequirements(recipe, prefs);

    expect(result.map(r => r.key)).toEqual(['nutFree', 'lowCarb']);
  });

  it('includes label field for diagnostic messages', () => {
    const recipe = makeRecipe([]);
    const prefs = makePrefs({ dairyFree: true });

    const result = missingDietaryRequirements(recipe, prefs);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('dairy-free');
  });
});

describe('filterByDiet', () => {
  it('removes non-compliant recipes from a mixed list', () => {
    const recipes = [
      { id: 'a', tags: ['gluten-free'] },
      { id: 'b', tags: ['vegetarian'] },
      { id: 'c', tags: ['gluten-free', 'dairy-free'] },
    ];
    const prefs = makePrefs({ glutenFree: true });

    const result = filterByDiet(recipes, prefs);

    expect(result.map(r => r.id)).toEqual(['a', 'c']);
  });

  it('returns an empty array when no recipes are compliant', () => {
    const recipes = [
      { id: 'a', tags: ['vegetarian'] },
      { id: 'b', tags: ['dairy-free'] },
    ];
    const prefs = makePrefs({ glutenFree: true });

    const result = filterByDiet(recipes, prefs);

    expect(result).toEqual([]);
  });

  it('returns the original list unchanged when no preferences are active', () => {
    const recipes = [
      { id: 'a', tags: ['vegetarian'] },
      { id: 'b', tags: [] },
      { id: 'c', tags: ['low-carb'] },
    ];
    const prefs = makePrefs();

    const result = filterByDiet(recipes, prefs);

    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves recipe order for compliant recipes', () => {
    const recipes = [
      { id: 'first', tags: ['vegan'] },
      { id: 'skip', tags: ['vegetarian'] },
      { id: 'second', tags: ['vegan'] },
      { id: 'third', tags: ['vegan'] },
    ];
    const prefs = makePrefs({ vegan: true });

    const result = filterByDiet(recipes, prefs);

    expect(result.map(r => r.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('DIETARY_TAG_MAP', () => {
  it('exposes a key for each enforced preference flag', () => {
    const expectedKeys = [
      'vegan',
      'vegetarian',
      'glutenFree',
      'dairyFree',
      'nutFree',
      'lowCarb',
    ];

    expect(Object.keys(DIETARY_TAG_MAP).sort()).toEqual(expectedKeys.sort());
  });

  it('is structurally consistent with DIETARY_REQUIREMENTS', () => {
    for (const req of DIETARY_REQUIREMENTS) {
      expect(DIETARY_TAG_MAP[req.key]).toEqual(req.tags);
    }

    expect(Object.keys(DIETARY_TAG_MAP)).toHaveLength(
      DIETARY_REQUIREMENTS.length,
    );
  });
});
