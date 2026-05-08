export const KNOWN_TAG_VOCABULARY: ReadonlySet<string> = new Set<string>([
  'vegan',
  'vegetarian',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'low-carb',
  'keto',
  'paleo',
  'pescatarian',
  'kosher',
  'halal',
  'breakfast',
  'lunch',
  'dinner',
  'snacks',
  'snack',
  'dessert',
  'appetizer',
  'side dish',
  'main course',
  'brunch',
  'american',
  'italian',
  'mexican',
  'asian',
  'chinese',
  'japanese',
  'thai',
  'indian',
  'french',
  'mediterranean',
  'greek',
  'middle eastern',
  'southern',
  'tex-mex',
  'cajun',
  'korean',
  'vietnamese',
  'spanish',
  'german',
  'british',
  'baked',
  'grilled',
  'fried',
  'roasted',
  'slow cooker',
  'instant pot',
  'air fryer',
  'one pot',
  'no cook',
  'make ahead',
  'comfort food',
  'healthy',
  'quick',
  'easy',
  'kid friendly',
  'holiday',
  'summer',
  'winter',
  'spring',
  'fall',
]);

export const INGREDIENT_NOUN_DENYLIST: ReadonlySet<string> = new Set<string>([
  'garlic',
  'butter',
  'oil',
  'sugar',
  'flour',
  'egg',
  'milk',
  'salt',
  'pepper',
  'onion',
  'tomato',
  'cheese',
  'chicken',
  'beef',
  'pork',
  'fish',
  'shrimp',
  'bread',
  'rice',
  'pasta',
]);

export const MEASUREMENT_TOKENS: ReadonlySet<string> = new Set<string>([
  'teaspoon',
  'tablespoon',
  'tbsp',
  'tsp',
  'cup',
  'ounce',
  'oz',
  'gram',
  'lb',
  'pound',
  'drizzle',
  'chopped',
  'grated',
  'sliced',
  'diced',
  'minced',
  'peeled',
  'melted',
  'softened',
  'whipped',
  'room temperature',
  'unsalted',
  'lightly salted',
]);

const PREPOSITION_PHRASES: readonly string[] = [
  ' to ',
  ' for ',
  ' with ',
  ' of ',
  ' over ',
  ' from ',
  ' in ',
];

const MAX_TAG_LENGTH = 25;
const MAX_TAG_WORDS = 3;

function escapeRegExp(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function containsAllowlistToken(tag: string): boolean {
  for (const vocab of KNOWN_TAG_VOCABULARY) {
    const pattern = new RegExp(`\\b${escapeRegExp(vocab)}\\b`);
    if (pattern.test(tag)) return true;
  }
  return false;
}

function containsMeasurementToken(tag: string): boolean {
  for (const token of MEASUREMENT_TOKENS) {
    if (tag.includes(token)) return true;
  }
  return false;
}

function containsIngredientNoun(tag: string): boolean {
  for (const noun of INGREDIENT_NOUN_DENYLIST) {
    const wordBoundary = new RegExp(`\\b${noun}\\b`);
    if (wordBoundary.test(tag)) return true;
  }
  return false;
}

export function isLikelyIngredientPhrase(tag: string): boolean {
  if (tag.includes(',')) return true;
  if (tag.length > MAX_TAG_LENGTH) return true;

  const words = tag.split(/\s+/).filter(Boolean);
  if (words.length > MAX_TAG_WORDS) return true;

  const padded = ` ${tag} `;
  for (const phrase of PREPOSITION_PHRASES) {
    if (padded.includes(phrase)) return true;
  }

  if (containsMeasurementToken(tag)) return true;

  if (containsIngredientNoun(tag) && !containsAllowlistToken(tag)) return true;

  return false;
}

export function cleanTags(raw: readonly string[] | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const norm = t.trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;
    if (isLikelyIngredientPhrase(norm)) continue;
    seen.add(norm);
    result.push(norm);
  }
  return result;
}
