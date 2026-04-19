/**
 * Tests for SummaryReportGenerator.
 *
 * Covers all five report sections, edge cases, and the writeToFile method.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SummaryReportGenerator } from '../../reports/SummaryReportGenerator';
import {
  SimulationResult,
  SimulationProfile,
  DaySnapshot,
  DayState,
  QualityMetrics,
  InvariantViolation,
} from '../../profiles/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQualityMetrics(
  overrides: Partial<QualityMetrics> = {},
): QualityMetrics {
  return {
    diversity: {
      mean: 0.8,
      min: 0.6,
      max: 1.0,
      std: 0.1,
      perDay: [0.8],
      lookbackDays: 7,
      skippedDays: 7,
    },
    pantryUtilization: { mean: 0.7, trend: 0.1, perPlan: [0.7] },
    feedbackLoop: {
      positiveCorrelation: 0.5,
      negativeCorrelation: 0.1,
      netEffectiveness: 0.4,
    },
    seasonalRelevance: {
      meanMatchRate: 0.6,
      perSeason: { spring: 0.5, summer: 0.7, fall: 0.6, winter: 0.5 },
    },
    expiryDriven: { rescueRate: 0.8, totalExpiring: 5, totalRescued: 4 },
    ...overrides,
  };
}

function makeProfile(
  overrides: Partial<SimulationProfile> = {},
): SimulationProfile {
  return {
    id: 'profile-1',
    name: 'Test Profile',
    uid: 'uid-1',
    preferences: {
      dietary: {} as any,
      food: {} as any,
      cooking: {} as any,
      budget: {} as any,
    },
    engagementTier: 'high',
    startingPantry: [],
    simulationStartDate: '2025-06-01',
    seed: 42,
    ...overrides,
  };
}

function makeDayState(overrides: Partial<DayState> = {}): DayState {
  return {
    pantryItems: [],
    leftovers: [],
    currentMealPlan: [],
    recipeHistory: [],
    feedbackHistory: [],
    cookedToday: [],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<DaySnapshot> = {}): DaySnapshot {
  return {
    profileId: 'profile-1',
    dayIndex: overrides.dayIndex ?? 0,
    date: overrides.date ?? '2025-06-01',
    season: overrides.season ?? 'summer',
    actionsExecuted: overrides.actionsExecuted ?? [],
    stateAfter: overrides.stateAfter ?? makeDayState(),
    violations: overrides.violations ?? [],
    mealPlanGenerated: overrides.mealPlanGenerated ?? true,
    recipesCooked: overrides.recipesCooked ?? 1,
  };
}

function makeViolation(
  overrides: Partial<InvariantViolation> = {},
): InvariantViolation {
  return {
    profileId: 'profile-1',
    dayIndex: 0,
    date: '2025-06-01',
    type: 'dietary',
    recipeId: 'r-1',
    recipeTitle: 'Test Recipe',
    detail: 'contains allergen',
    severity: 'warning',
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<SimulationResult> = {},
): SimulationResult {
  return {
    profile: overrides.profile ?? makeProfile(),
    days: overrides.days ?? [makeSnapshot()],
    qualityMetrics: overrides.qualityMetrics ?? makeQualityMetrics(),
    totalViolations: overrides.totalViolations ?? [],
    durationMs: overrides.durationMs ?? 1500,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SummaryReportGenerator', () => {
  let generator: SummaryReportGenerator;

  beforeEach(() => {
    generator = new SummaryReportGenerator();
  });

  // -------------------------------------------------------------------------
  // Overall structure
  // -------------------------------------------------------------------------

  describe('generate', () => {
    it('should produce a string containing all five section headers', () => {
      const md = generator.generate([makeResult()]);

      expect(md).toContain('# Simulation Summary Report');
      expect(md).toContain('## 1. Executive Summary');
      expect(md).toContain('## 2. Per-Profile Cards');
      expect(md).toContain('## 3. Invariant Violation Log');
      expect(md).toContain('## 4. Quality Metric Trends');
      expect(md).toContain('## 5. Flagged Issues');
    });

    it('should include a timestamp in the header', () => {
      const md = generator.generate([makeResult()]);
      // ISO timestamp format: YYYY-MM-DDTHH:MM:SS
      expect(md).toMatch(/Generated: \d{4}-\d{2}-\d{2}T/);
    });

    it('should handle an empty results array without throwing', () => {
      const md = generator.generate([]);
      expect(md).toContain('Profiles | 0');
      expect(md).toContain('Total Days | 0');
    });
  });

  // -------------------------------------------------------------------------
  // Section 1: Executive Summary
  // -------------------------------------------------------------------------

  describe('executive summary', () => {
    it('should show correct profile and day counts', () => {
      const results = [
        makeResult({
          days: [makeSnapshot({ dayIndex: 0 }), makeSnapshot({ dayIndex: 1 })],
        }),
        makeResult({
          profile: makeProfile({ id: 'p2', name: 'Profile 2' }),
          days: [makeSnapshot({ dayIndex: 0 })],
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('Profiles | 2');
      expect(md).toContain('Total Days | 3');
    });

    it('should show PASS for invariant types with zero violations', () => {
      const md = generator.generate([makeResult()]);

      expect(md).toContain('**dietary**: PASS');
      expect(md).toContain('**repetition**: PASS');
      expect(md).toContain('**instrument**: PASS');
    });

    it('should show FAIL with count for invariant types that have violations', () => {
      const results = [
        makeResult({
          totalViolations: [
            makeViolation({ type: 'dietary' }),
            makeViolation({ type: 'dietary' }),
            makeViolation({ type: 'repetition' }),
          ],
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('**dietary**: FAIL (2)');
      expect(md).toContain('**repetition**: FAIL (1)');
      expect(md).toContain('**instrument**: PASS');
    });

    it('should compute correct quality averages across profiles', () => {
      const r1 = makeResult({
        qualityMetrics: makeQualityMetrics({
          diversity: {
            mean: 0.6,
            min: 0.6,
            max: 0.6,
            std: 0,
            perDay: [],
            lookbackDays: 7,
            skippedDays: 0,
          },
        }),
      });
      const r2 = makeResult({
        profile: makeProfile({ id: 'p2', name: 'P2' }),
        qualityMetrics: makeQualityMetrics({
          diversity: {
            mean: 0.8,
            min: 0.8,
            max: 0.8,
            std: 0,
            perDay: [],
            lookbackDays: 7,
            skippedDays: 0,
          },
        }),
      });
      const md = generator.generate([r1, r2]);

      // Average novelty = (0.6 + 0.8) / 2 = 0.7
      expect(md).toContain('Novelty (7d, mean) | 0.7000');
    });
  });

  // -------------------------------------------------------------------------
  // Section 2: Per-Profile Cards
  // -------------------------------------------------------------------------

  describe('per-profile cards', () => {
    it('should include a table row for each profile', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'Alice' }),
        }),
        makeResult({
          profile: makeProfile({ id: 'p2', name: 'Bob', engagementTier: 'low' }),
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('Alice');
      expect(md).toContain('Bob');
      expect(md).toContain('high');
      expect(md).toContain('low');
    });

    it('should count meal plan days correctly', () => {
      const days = [
        makeSnapshot({ dayIndex: 0, mealPlanGenerated: true }),
        makeSnapshot({ dayIndex: 1, mealPlanGenerated: false }),
        makeSnapshot({ dayIndex: 2, mealPlanGenerated: true }),
      ];
      const results = [makeResult({ days })];
      const md = generator.generate(results);

      // The table row should contain "3" for days and "2" for plans
      // Find the profile row
      const lines = md.split('\n');
      const profileRow = lines.find(l => l.includes('Test Profile'));
      expect(profileRow).toBeDefined();
      // days=3, plans=2
      expect(profileRow).toContain('| 3 |');
      expect(profileRow).toContain('| 2 |');
    });
  });

  // -------------------------------------------------------------------------
  // Section 3: Invariant Violation Log
  // -------------------------------------------------------------------------

  describe('violation log', () => {
    it('should sort violations by severity (critical first), then profile, then day', () => {
      const violations = [
        makeViolation({ profileId: 'b', dayIndex: 1, severity: 'warning' }),
        makeViolation({ profileId: 'a', dayIndex: 0, severity: 'critical' }),
        makeViolation({ profileId: 'a', dayIndex: 2, severity: 'warning' }),
        makeViolation({ profileId: 'a', dayIndex: 1, severity: 'warning' }),
      ];
      const results = [makeResult({ totalViolations: violations })];
      const md = generator.generate(results);

      const logSection = md.split('## 3.')[1].split('## 4.')[0];
      const dataRows = logSection
        .split('\n')
        .filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Profile'));

      // First row should be the critical one (profile 'a', day 0)
      expect(dataRows[0]).toContain('critical');
      expect(dataRows[0]).toContain('| a |');
      // Remaining should be warnings sorted by profile then day
      expect(dataRows[1]).toContain('warning');
      expect(dataRows[1]).toContain('| a |');
      expect(dataRows[1]).toContain('| 1 |');
      expect(dataRows[2]).toContain('| a |');
      expect(dataRows[2]).toContain('| 2 |');
      expect(dataRows[3]).toContain('| b |');
    });

    it('should cap the log at 100 entries and show a remainder note', () => {
      const violations: InvariantViolation[] = [];
      for (let i = 0; i < 120; i++) {
        violations.push(
          makeViolation({ dayIndex: i, detail: `violation-${i}` }),
        );
      }
      const results = [makeResult({ totalViolations: violations })];
      const md = generator.generate(results);

      expect(md).toContain('... and 20 more violations');

      // Count data rows in the violation table
      const logSection = md.split('## 3.')[1].split('## 4.')[0];
      const dataRows = logSection
        .split('\n')
        .filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Profile'));
      expect(dataRows).toHaveLength(100);
    });

    it('should not show remainder note when violations are at or below 100', () => {
      const violations = [makeViolation()];
      const results = [makeResult({ totalViolations: violations })];
      const md = generator.generate(results);

      expect(md).not.toContain('... and');
    });

    it('should render an empty table when there are no violations', () => {
      const results = [makeResult({ totalViolations: [] })];
      const md = generator.generate(results);

      const logSection = md.split('## 3.')[1].split('## 4.')[0];
      const dataRows = logSection
        .split('\n')
        .filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Profile'));
      expect(dataRows).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Section 4: Quality Metric Trends
  // -------------------------------------------------------------------------

  describe('quality metric trends', () => {
    it('should include aggregate stats for each metric', () => {
      const md = generator.generate([makeResult()]);

      expect(md).toContain('Novelty (7d, mean)');
      expect(md).toContain('Pantry Utilization (mean)');
      expect(md).toContain('Feedback Effectiveness');
      expect(md).toContain('Seasonal Relevance');
      expect(md).toContain('Expiry Rescue Rate');
    });

    it('should show "none" when there are no outliers', () => {
      // Single profile => std=0 => no outliers possible
      const md = generator.generate([makeResult()]);

      expect(md).toContain('none');
    });

    it('should flag outlier profiles that are >1.5 std from the mean', () => {
      // Create 5 profiles: four have diversity 0.9, one has 0.0 (outlier).
      // mean=0.72, std~0.36, threshold=1.5*0.36=0.54, |0.0-0.72|=0.72 > 0.54
      const normal = makeQualityMetrics({
        diversity: {
          mean: 0.9,
          min: 0.9,
          max: 0.9,
          std: 0,
          perDay: [],
          lookbackDays: 7,
          skippedDays: 0,
        },
      });
      const outlier = makeQualityMetrics({
        diversity: {
          mean: 0.0,
          min: 0.0,
          max: 0.0,
          std: 0,
          perDay: [],
          lookbackDays: 7,
          skippedDays: 0,
        },
      });

      const results = [
        makeResult({
          profile: makeProfile({ name: 'Normal1' }),
          qualityMetrics: normal,
        }),
        makeResult({
          profile: makeProfile({ id: 'p2', name: 'Normal2' }),
          qualityMetrics: normal,
        }),
        makeResult({
          profile: makeProfile({ id: 'p3', name: 'Normal3' }),
          qualityMetrics: normal,
        }),
        makeResult({
          profile: makeProfile({ id: 'p4', name: 'Normal4' }),
          qualityMetrics: normal,
        }),
        makeResult({
          profile: makeProfile({ id: 'p5', name: 'Outlier' }),
          qualityMetrics: outlier,
        }),
      ];

      const md = generator.generate(results);

      // The Diversity row should flag Outlier
      const trendSection = md.split('## 4.')[1].split('## 5.')[0];
      const diversityRow = trendSection
        .split('\n')
        .find(l => l.includes('Novelty (7d, mean)'));
      expect(diversityRow).toContain('Outlier');
    });

    it('should compute correct mean and std across profiles', () => {
      const r1 = makeResult({
        profile: makeProfile({ name: 'A' }),
        qualityMetrics: makeQualityMetrics({
          expiryDriven: { rescueRate: 0.2, totalExpiring: 10, totalRescued: 2 },
        }),
      });
      const r2 = makeResult({
        profile: makeProfile({ id: 'p2', name: 'B' }),
        qualityMetrics: makeQualityMetrics({
          expiryDriven: { rescueRate: 0.8, totalExpiring: 10, totalRescued: 8 },
        }),
      });
      const md = generator.generate([r1, r2]);

      const trendSection = md.split('## 4.')[1].split('## 5.')[0];
      const rescueRow = trendSection
        .split('\n')
        .find(l => l.includes('Expiry Rescue Rate'));
      // mean = 0.5, std = 0.3, min = 0.2, max = 0.8
      expect(rescueRow).toContain('0.5000');
      expect(rescueRow).toContain('0.3000');
      expect(rescueRow).toContain('0.2000');
      expect(rescueRow).toContain('0.8000');
    });
  });

  // -------------------------------------------------------------------------
  // Section 5: Flagged Issues
  // -------------------------------------------------------------------------

  describe('flagged issues', () => {
    it('should flag profiles with >5 violations', () => {
      const violations = Array.from({ length: 6 }, (_, i) =>
        makeViolation({ dayIndex: i }),
      );
      const results = [
        makeResult({
          profile: makeProfile({ name: 'Violator' }),
          totalViolations: violations,
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('**Violator**: 6 violations');
    });

    it('should not flag profiles with exactly 5 violations', () => {
      const violations = Array.from({ length: 5 }, (_, i) =>
        makeViolation({ dayIndex: i }),
      );
      const results = [
        makeResult({
          profile: makeProfile({ name: 'BorderCase' }),
          totalViolations: violations,
        }),
      ];
      const md = generator.generate(results);

      expect(md).not.toContain('**BorderCase**: 5 violations');
    });

    it('should flag profiles with novelty < 0.5', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'LowDiv' }),
          qualityMetrics: makeQualityMetrics({
            diversity: {
              mean: 0.4,
              min: 0.4,
              max: 0.4,
              std: 0,
              perDay: [],
              lookbackDays: 7,
              skippedDays: 0,
            },
          }),
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('**LowDiv**: novelty 0.4000');
    });

    it('should not flag profiles with novelty exactly 0.5', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'BorderDiv' }),
          qualityMetrics: makeQualityMetrics({
            diversity: {
              mean: 0.5,
              min: 0.5,
              max: 0.5,
              std: 0,
              perDay: [],
              lookbackDays: 7,
              skippedDays: 0,
            },
          }),
        }),
      ];
      const md = generator.generate(results);

      expect(md).not.toContain('**BorderDiv**: novelty');
    });

    it('should flag profiles with negative feedback effectiveness', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'BadFB' }),
          qualityMetrics: makeQualityMetrics({
            feedbackLoop: {
              positiveCorrelation: 0.1,
              negativeCorrelation: 0.5,
              netEffectiveness: -0.4,
            },
          }),
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('**BadFB**: feedback effectiveness -0.4000');
    });

    it('should flag profiles with negative pantry utilization trend', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'Declining' }),
          qualityMetrics: makeQualityMetrics({
            pantryUtilization: { mean: 0.5, trend: -0.1, perPlan: [] },
          }),
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('**Declining**: pantry utilization trend -0.1000');
    });

    it('should flag profiles with expiry rescue rate < 0.2', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'Wasteful' }),
          qualityMetrics: makeQualityMetrics({
            expiryDriven: { rescueRate: 0.1, totalExpiring: 10, totalRescued: 1 },
          }),
        }),
      ];
      const md = generator.generate(results);

      expect(md).toContain('**Wasteful**: expiry rescue rate 0.1000');
    });

    it('should not flag a profile with rescue rate exactly 0.2', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'BorderRescue' }),
          qualityMetrics: makeQualityMetrics({
            expiryDriven: { rescueRate: 0.2, totalExpiring: 10, totalRescued: 2 },
          }),
        }),
      ];
      const md = generator.generate(results);

      expect(md).not.toContain('**BorderRescue**: expiry rescue rate');
    });

    it('should show "No issues flagged" when nothing is flagged', () => {
      const results = [makeResult()];
      const md = generator.generate(results);

      expect(md).toContain('No issues flagged');
    });

    it('should report multiple flags for the same profile', () => {
      const results = [
        makeResult({
          profile: makeProfile({ name: 'MultiFlag' }),
          totalViolations: Array.from({ length: 10 }, (_, i) =>
            makeViolation({ dayIndex: i }),
          ),
          qualityMetrics: makeQualityMetrics({
            diversity: {
              mean: 0.3,
              min: 0.3,
              max: 0.3,
              std: 0,
              perDay: [],
              lookbackDays: 7,
              skippedDays: 0,
            },
            feedbackLoop: {
              positiveCorrelation: 0,
              negativeCorrelation: 1,
              netEffectiveness: -1,
            },
            pantryUtilization: { mean: 0.3, trend: -0.5, perPlan: [] },
            expiryDriven: { rescueRate: 0.05, totalExpiring: 20, totalRescued: 1 },
          }),
        }),
      ];
      const md = generator.generate(results);

      const flagSection = md.split('## 5.')[1];
      const flagLines = flagSection
        .split('\n')
        .filter(l => l.startsWith('- **MultiFlag**'));
      expect(flagLines.length).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // writeToFile
  // -------------------------------------------------------------------------

  describe('writeToFile', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-report-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should write the markdown to summary.md in the output directory', () => {
      const md = '# Test Report';
      const filePath = generator.writeToFile(md, tmpDir);

      expect(filePath).toBe(path.join(tmpDir, 'summary.md'));
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(md);
    });

    it('should create the output directory if it does not exist', () => {
      const nested = path.join(tmpDir, 'deep', 'nested');
      const filePath = generator.writeToFile('test', nested);

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should overwrite an existing summary.md', () => {
      generator.writeToFile('first', tmpDir);
      const filePath = generator.writeToFile('second', tmpDir);

      expect(fs.readFileSync(filePath, 'utf-8')).toBe('second');
    });
  });
});
