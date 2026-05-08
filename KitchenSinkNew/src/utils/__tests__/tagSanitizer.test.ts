import {
  cleanTags,
  isLikelyIngredientPhrase,
} from '../tagSanitizer';

describe('cleanTags - canonical Roasted Garlic Butter example', () => {
  it('keeps allowlist tags and drops ingredient phrases', () => {
    const raw = [
      'american',
      'bulb garlic',
      'dinner',
      'lightly salted whipped butter',
      'olive oil to drizzle over garlic',
      'vegetarian',
    ];

    const result = cleanTags(raw);

    expect(result).toEqual(['american', 'dinner', 'vegetarian']);
  });
});

describe('isLikelyIngredientPhrase - rule 1: comma', () => {
  it('drops tags containing a comma', () => {
    const result = isLikelyIngredientPhrase('salt, pepper, garlic');

    expect(result).toBe(true);
  });
});

describe('isLikelyIngredientPhrase - rule 2: length', () => {
  it('drops tags longer than 25 characters', () => {
    const tag = 'abcdefghijklmnopqrstuvwxyzabcd';

    const result = isLikelyIngredientPhrase(tag);

    expect(tag.length).toBe(30);
    expect(result).toBe(true);
  });

  it('keeps short single-word allowlist tags', () => {
    const result = isLikelyIngredientPhrase('easy');

    expect(result).toBe(false);
  });
});

describe('isLikelyIngredientPhrase - rule 3: word count', () => {
  it('drops tags with four or more whitespace-separated words', () => {
    const result = isLikelyIngredientPhrase('a b c d');

    expect(result).toBe(true);
  });

  it('keeps single-word tags', () => {
    const result = isLikelyIngredientPhrase('easy');

    expect(result).toBe(false);
  });
});

describe('isLikelyIngredientPhrase - rule 4: prepositions', () => {
  const cases = [
    'onions for garnish',
    'butter with herbs',
    'salt to taste',
    'cup of milk',
    'oil over heat',
    'recipe from grandma',
    'ingredient in sauce',
  ];

  it.each(cases)('drops tag containing preposition phrase: %s', (tag) => {
    const result = isLikelyIngredientPhrase(tag);

    expect(result).toBe(true);
  });
});

describe('isLikelyIngredientPhrase - rule 5: measurement and prep tokens', () => {
  const cases = [
    '2 tablespoons sugar',
    'chopped onions',
    'room temperature butter',
    'lightly salted',
  ];

  it.each(cases)('drops tag containing measurement or prep token: %s', (tag) => {
    const result = isLikelyIngredientPhrase(tag);

    expect(result).toBe(true);
  });
});

describe('isLikelyIngredientPhrase - rule 6: ingredient noun without allowlist', () => {
  it('drops a bare ingredient noun like "garlic"', () => {
    const result = isLikelyIngredientPhrase('garlic');

    expect(result).toBe(true);
  });

  it('drops "bulb garlic" because it has no allowlist token', () => {
    const result = isLikelyIngredientPhrase('bulb garlic');

    expect(result).toBe(true);
  });

  it('keeps a tag containing an ingredient noun if an allowlist token is present', () => {
    const result = isLikelyIngredientPhrase('garlic shrimp american');

    expect(result).toBe(false);
  });

  it('keeps a pure allowlist tag', () => {
    const result = isLikelyIngredientPhrase('american');

    expect(result).toBe(false);
  });
});

describe('isLikelyIngredientPhrase - allowlist requires whole-word match', () => {
  it('drops "snacky garlic" because "snack" is only a substring, not a whole word', () => {
    const result = isLikelyIngredientPhrase('snacky garlic');

    expect(result).toBe(true);
  });

  it('keeps "tex-mex" because the hyphenated vocab token matches with escaped regex', () => {
    const result = isLikelyIngredientPhrase('tex-mex');

    expect(result).toBe(false);
  });
});

describe('isLikelyIngredientPhrase - multi-word allowlist tokens', () => {
  it('keeps "best comfort food" because the multi-word vocab token matches', () => {
    const result = isLikelyIngredientPhrase('best comfort food');

    expect(result).toBe(false);
  });
});

describe('cleanTags - hyphenated dietary tags', () => {
  it('keeps gluten-free, low-carb, dairy-free, and nut-free', () => {
    const result = cleanTags(['gluten-free', 'low-carb', 'dairy-free', 'nut-free']);

    expect(result).toEqual(['gluten-free', 'low-carb', 'dairy-free', 'nut-free']);
  });
});

describe('cleanTags - normalization and dedupe', () => {
  it('trims, lowercases, and dedupes case-insensitively while preserving first-seen order', () => {
    const raw = ['American', 'american', '  AMERICAN  ', 'Dinner'];

    const result = cleanTags(raw);

    expect(result).toEqual(['american', 'dinner']);
  });
});

describe('cleanTags - empty inputs', () => {
  it('returns an empty array for null', () => {
    const result = cleanTags(null);

    expect(result).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    const result = cleanTags(undefined);

    expect(result).toEqual([]);
  });

  it('returns an empty array for an empty array', () => {
    const result = cleanTags([]);

    expect(result).toEqual([]);
  });
});

describe('cleanTags - non-string entries', () => {
  it('ignores non-string entries without throwing', () => {
    const raw = ['american', 42, null, undefined, 'dinner'] as unknown as string[];

    const result = cleanTags(raw);

    expect(result).toEqual(['american', 'dinner']);
  });
});

describe('cleanTags - input order', () => {
  it('preserves the original input order for surviving tags', () => {
    const raw = ['vegetarian', 'american', 'dinner', 'easy'];

    const result = cleanTags(raw);

    expect(result).toEqual(['vegetarian', 'american', 'dinner', 'easy']);
  });
});
