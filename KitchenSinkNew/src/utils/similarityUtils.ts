/**
 * Utility helpers to compute fuzzy similarity between strings / lists for
 * de-duplication of recipe candidates.
 */

/** Compute Levenshtein distance between two strings (case-insensitive). */
function levenshtein(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,   // deletion
          matrix[i][j - 1] + 1,   // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

/** Return similarity ratio in range [0,1] based on Levenshtein distance. */
export function titleSimilarity(s1: string, s2: string): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const distance = levenshtein(s1, s2);
  return (maxLen - distance) / maxLen;
}

/** Build set of character bigrams for a string (lower-cased). */
function buildBigrams(str: string): Set<string> {
  const s = str.toLowerCase();
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.substring(i, i + 2));
  }
  return bigrams;
}

/** Compute Jaccard similarity of bigram sets produced from an array of strings. */
export function bigramJaccard(arr1: string[], arr2: string[]): number {
  const set1 = new Set<string>();
  const set2 = new Set<string>();

  arr1.forEach(str => buildBigrams(str).forEach(b => set1.add(b)));
  arr2.forEach(str => buildBigrams(str).forEach(b => set2.add(b)));

  const intersection = new Set([...set1].filter(b => set2.has(b)));
  const unionSize = set1.size + set2.size - intersection.size;
  return unionSize === 0 ? 0 : intersection.size / unionSize;
} 