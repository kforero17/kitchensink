/**
 * Configuration for cooking time preferences and scoring
 */

export interface TimeRange {
  min: number;
  max: number;
  label: string;
  description: string;
}

export interface TimeConfig {
  ranges: TimeRange[];
  penaltyPerMinute: number;
}

export interface TimePreferenceConfig {
  ranges: TimeRange[];
  penaltyFunction: (distance: number) => number;
}

export const PENALTY_FUNCTIONS = {
  linear: (distance: number): number => Math.min(100, distance * 2),
  exponential: (distance: number): number => Math.min(100, distance * distance / 25),
  stepped: (distance: number): number => {
    if (distance <= 10) return 80;
    if (distance <= 20) return 60;
    if (distance <= 40) return 40;
    if (distance <= 60) return 20;
    return 0;
  }
};

export const DEFAULT_TIME_CONFIG: TimeConfig = {
  ranges: [
    { min: 0, max: 15, label: 'quick', description: 'Quick meals under 15 minutes' },
    { min: 16, max: 30, label: 'medium-quick', description: 'Medium-quick meals (16-30 minutes)' },
    { min: 31, max: 60, label: 'medium', description: 'Medium length meals (31-60 minutes)' },
    { min: 61, max: 120, label: 'long', description: 'Long cooking time (61-120 minutes)' },
    { min: 121, max: Infinity, label: 'very-long', description: 'Very long cooking time (over 2 hours)' }
  ],
  penaltyPerMinute: 2 // Points deducted per minute outside preferred range
};

/**
 * Gets the time range category for a given duration
 */
export function getTimeRange(totalMinutes: number, ranges: TimeRange[] = DEFAULT_TIME_CONFIG.ranges): TimeRange {
  const range = ranges.find(
    r => totalMinutes >= r.min && totalMinutes <= r.max
  );
  return range || ranges[ranges.length - 1];
}

/**
 * Calculates a score (0-100) based on how well a recipe's cooking time
 * matches the preferred time range
 */
export function calculateTimeScore(
  totalMinutes: number,
  preferredRange: TimeRange,
  config: TimeConfig = DEFAULT_TIME_CONFIG
): number {
  // If within preferred range, perfect score
  if (totalMinutes >= preferredRange.min && totalMinutes <= preferredRange.max) {
    return 100;
  }

  // Calculate penalty based on minutes outside range
  const minutesOver = Math.max(0, totalMinutes - preferredRange.max);
  const minutesUnder = Math.max(0, preferredRange.min - totalMinutes);
  const totalPenalty = (minutesOver + minutesUnder) * config.penaltyPerMinute;

  return Math.max(0, 100 - totalPenalty);
}

/**
 * Creates a custom time preference configuration
 */
export function createTimeConfig(
  ranges?: TimeRange[],
  penaltyPerMinute?: number
): TimeConfig {
  return {
    ranges: ranges || DEFAULT_TIME_CONFIG.ranges,
    penaltyPerMinute: penaltyPerMinute || DEFAULT_TIME_CONFIG.penaltyPerMinute
  };
} 