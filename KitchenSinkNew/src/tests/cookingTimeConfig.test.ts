import {
  getTimeRange,
  calculateTimeScore,
  DEFAULT_TIME_CONFIG,
  PENALTY_FUNCTIONS,
  createTimeConfig,
  TimeRange,
  TimePreferenceConfig
} from '../config/cookingTimeConfig';

describe('Cooking Time Configuration Tests', () => {
  describe('getTimeRange', () => {
    // Tests exact boundary between ranges
    it('should correctly identify time ranges at boundaries', () => {
      const config: TimePreferenceConfig = {
        ranges: [
          { min: 0, max: 30, label: 'quick', description: 'Quick meals under 30 minutes' },
          { min: 31, max: 60, label: 'medium', description: 'Medium length meals (30-60 minutes)' },
          { min: 61, max: 120, label: 'long', description: 'Long cooking time (over 60 minutes)' }
        ],
        penaltyFunction: PENALTY_FUNCTIONS.linear
      };

      expect(getTimeRange(30, config.ranges).label).toBe('quick');
      expect(getTimeRange(31, config.ranges).label).toBe('medium');
      expect(getTimeRange(60, config.ranges).label).toBe('medium');
      expect(getTimeRange(61, config.ranges).label).toBe('long');
    });

    // Tests values within ranges
    it('should correctly identify time ranges for values within ranges', () => {
      const config: TimePreferenceConfig = {
        ranges: [
          { min: 0, max: 30, label: 'quick', description: 'Quick meals under 30 minutes' },
          { min: 31, max: 60, label: 'medium', description: 'Medium length meals (30-60 minutes)' },
          { min: 61, max: 120, label: 'long', description: 'Long cooking time (over 60 minutes)' }
        ],
        penaltyFunction: PENALTY_FUNCTIONS.linear
      };

      expect(getTimeRange(15, config.ranges).label).toBe('quick');
      expect(getTimeRange(45, config.ranges).label).toBe('medium');
      expect(getTimeRange(90, config.ranges).label).toBe('long');
    });

    // Tests extreme and invalid inputs
    it('should handle extreme and invalid inputs gracefully', () => {
      const config: TimePreferenceConfig = {
        ranges: [
          { min: 0, max: 30, label: 'quick', description: 'Quick meals under 30 minutes' },
          { min: 31, max: 60, label: 'medium', description: 'Medium length meals (30-60 minutes)' },
          { min: 61, max: 120, label: 'long', description: 'Long cooking time (over 60 minutes)' }
        ],
        penaltyFunction: PENALTY_FUNCTIONS.linear
      };

      // Test negative time
      expect(getTimeRange(-10, config.ranges)).toEqual(config.ranges[0]);

      // Test time beyond maximum range
      expect(getTimeRange(150, config.ranges)).toEqual(config.ranges[config.ranges.length - 1]);

      // Test time at exactly 0
      expect(getTimeRange(0, config.ranges).label).toBe('quick');
    });
  });

  describe('calculateTimeScore', () => {
    // Tests perfect score at ideal time
    it('should return maximum score for ideal cooking time', () => {
      const range: TimeRange = { 
        min: 15, 
        max: 30, 
        label: 'quick',
        description: 'Quick meals under 30 minutes'
      };
      const idealTime = 20;
      
      expect(calculateTimeScore(idealTime, range)).toBe(100);
    });

    // Tests boundary values
    it('should handle boundary values correctly', () => {
      const range: TimeRange = { 
        min: 15, 
        max: 30, 
        label: 'quick',
        description: 'Quick meals under 30 minutes'
      };
      
      const minScore = calculateTimeScore(15, range);
      const maxScore = calculateTimeScore(30, range);
      
      expect(minScore).toBeLessThan(100);
      expect(maxScore).toBeLessThan(100);
      expect(minScore).toBeGreaterThan(0);
      expect(maxScore).toBeGreaterThan(0);
    });

    // Tests score bounds
    it('should maintain score bounds (0-100) for extreme values', () => {
      const range: TimeRange = { 
        min: 15, 
        max: 30, 
        label: 'quick',
        description: 'Quick meals under 30 minutes'
      };
      
      expect(calculateTimeScore(0, range)).toBeGreaterThanOrEqual(0);
      expect(calculateTimeScore(0, range)).toBeLessThanOrEqual(100);
      expect(calculateTimeScore(1000, range)).toBeGreaterThanOrEqual(0);
      expect(calculateTimeScore(1000, range)).toBeLessThanOrEqual(100);
    });
  });

  describe('Penalty Functions', () => {
    describe('linear', () => {
      it('should decrease score linearly', () => {
        const score1 = PENALTY_FUNCTIONS.linear(10);
        const score2 = PENALTY_FUNCTIONS.linear(20);
        const diff = score1 - score2;
        
        const score3 = PENALTY_FUNCTIONS.linear(20);
        const score4 = PENALTY_FUNCTIONS.linear(30);
        const diff2 = score3 - score4;

        expect(Math.abs(diff - diff2)).toBeLessThan(0.01);
      });
    });

    describe('exponential', () => {
      it('should decrease score exponentially', () => {
        const score1 = PENALTY_FUNCTIONS.exponential(10);
        const score2 = PENALTY_FUNCTIONS.exponential(20);
        const diff1 = score1 - score2;
        
        const score3 = PENALTY_FUNCTIONS.exponential(20);
        const score4 = PENALTY_FUNCTIONS.exponential(30);
        const diff2 = score3 - score4;

        expect(diff1).toBeLessThan(diff2);
      });
    });

    describe('stepped', () => {
      it('should return discrete values', () => {
        expect(PENALTY_FUNCTIONS.stepped(10)).toBe(80);
        expect(PENALTY_FUNCTIONS.stepped(20)).toBe(60);
        expect(PENALTY_FUNCTIONS.stepped(40)).toBe(40);
        expect(PENALTY_FUNCTIONS.stepped(50)).toBe(20);
        expect(PENALTY_FUNCTIONS.stepped(70)).toBe(0);
      });
    });
  });
}); 