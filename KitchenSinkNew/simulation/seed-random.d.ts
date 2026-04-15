declare module 'seed-random' {
  /**
   * Create a seeded pseudo-random number generator.
   * Returns a function that produces a new random number in [0, 1) on each call.
   */
  function seedRandom(seed: string): () => number;
  export = seedRandom;
}
