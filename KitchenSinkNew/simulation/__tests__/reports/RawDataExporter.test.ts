/**
 * Tests for RawDataExporter.
 *
 * Covers JSON and CSV export, directory creation, and data fidelity.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RawDataExporter } from '../../reports/RawDataExporter';
import {
  SimulationResult,
  SimulationProfile,
  DaySnapshot,
  DayState,
  QualityMetrics,
  ActionResult,
  InvariantViolation,
} from '../../profiles/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQualityMetrics(
  overrides: Partial<QualityMetrics> = {},
): QualityMetrics {
  return {
    diversity: { mean: 0.8, min: 0.6, max: 1.0, perWindow: [0.8] },
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

function makeProfile(overrides: Partial<SimulationProfile> = {}): SimulationProfile {
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
    pantryItems: overrides.pantryItems ?? [],
    leftovers: overrides.leftovers ?? [],
    currentMealPlan: overrides.currentMealPlan ?? [],
    recipeHistory: overrides.recipeHistory ?? [],
    feedbackHistory: overrides.feedbackHistory ?? [],
    cookedToday: overrides.cookedToday ?? [],
  };
}

function makeSnapshot(overrides: Partial<DaySnapshot> = {}): DaySnapshot {
  return {
    profileId: 'profile-1',
    dayIndex: overrides.dayIndex ?? 0,
    date: overrides.date ?? '2025-06-01',
    season: overrides.season ?? 'summer',
    actionsExecuted: overrides.actionsExecuted ?? [
      { type: 'generate_meal_plan', success: true },
      { type: 'cook_recipe', success: true },
      { type: 'cook_recipe', success: false, error: 'missing ingredient' },
    ],
    stateAfter: overrides.stateAfter ?? makeDayState({
      pantryItems: [
        { id: 'p-1', name: 'Chicken', quantity: 1, unit: 'lb', category: 'protein' },
        { id: 'p-2', name: 'Rice', quantity: 2, unit: 'cups', category: 'grain' },
      ],
      leftovers: [
        {
          id: 'l-1',
          recipeId: 'r-1',
          recipeName: 'Pasta',
          originalServings: 4,
          remainingServings: 2,
          cookedDate: '2025-06-01',
          estimatedExpiryDate: '2025-06-04',
          mealType: 'dinner',
          status: 'available',
        },
        {
          id: 'l-2',
          recipeId: 'r-2',
          recipeName: 'Soup',
          originalServings: 3,
          remainingServings: 0,
          cookedDate: '2025-05-30',
          estimatedExpiryDate: '2025-06-02',
          mealType: 'lunch',
          status: 'used',
        },
      ],
    }),
    violations: overrides.violations ?? [],
    mealPlanGenerated: overrides.mealPlanGenerated ?? true,
    recipesCooked: overrides.recipesCooked ?? 2,
  };
}

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
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

describe('RawDataExporter', () => {
  let tmpDir: string;
  let exporter: RawDataExporter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-export-'));
    exporter = new RawDataExporter(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // exportJSON
  // -------------------------------------------------------------------------

  describe('exportJSON', () => {
    it('should create the profile directory and write raw.json', () => {
      const result = makeResult();
      const filePath = exporter.exportJSON('profile-1', result);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toBe(path.join(tmpDir, 'profile-1', 'raw.json'));
    });

    it('should write valid JSON that round-trips to the original result', () => {
      const result = makeResult();
      const filePath = exporter.exportJSON('profile-1', result);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(parsed.profile.id).toBe('profile-1');
      expect(parsed.days).toHaveLength(1);
      expect(parsed.durationMs).toBe(1500);
    });

    it('should pretty-print JSON with 2-space indent', () => {
      const result = makeResult();
      const filePath = exporter.exportJSON('profile-1', result);

      const content = fs.readFileSync(filePath, 'utf-8');
      // Pretty-printed JSON has newlines and indentation
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });

    it('should create nested directories if they do not exist', () => {
      const deepDir = path.join(tmpDir, 'deep', 'nested');
      const deepExporter = new RawDataExporter(deepDir);
      const filePath = deepExporter.exportJSON('p1', makeResult());

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should overwrite an existing file without error', () => {
      const result1 = makeResult({ durationMs: 100 });
      const result2 = makeResult({ durationMs: 200 });

      exporter.exportJSON('profile-1', result1);
      const filePath = exporter.exportJSON('profile-1', result2);

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(parsed.durationMs).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // exportCSV
  // -------------------------------------------------------------------------

  describe('exportCSV', () => {
    it('should create the profile directory and write daily.csv', () => {
      const result = makeResult();
      const filePath = exporter.exportCSV('profile-1', result);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toBe(path.join(tmpDir, 'profile-1', 'daily.csv'));
    });

    it('should include a header row followed by one data row per day', () => {
      const result = makeResult({
        days: [
          makeSnapshot({ dayIndex: 0, date: '2025-06-01' }),
          makeSnapshot({ dayIndex: 1, date: '2025-06-02' }),
        ],
      });
      const filePath = exporter.exportCSV('profile-1', result);

      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      // 1 header + 2 data rows
      expect(lines).toHaveLength(3);
    });

    it('should have correct CSV header columns', () => {
      const filePath = exporter.exportCSV('profile-1', makeResult());
      const header = fs.readFileSync(filePath, 'utf-8').split('\n')[0];

      expect(header).toContain('day');
      expect(header).toContain('date');
      expect(header).toContain('season');
      expect(header).toContain('actionsExecuted');
      expect(header).toContain('actionsFailed');
      expect(header).toContain('recipesCooked');
      expect(header).toContain('mealPlanGenerated');
      expect(header).toContain('pantrySize');
      expect(header).toContain('leftoverCount');
      expect(header).toContain('violationCount');
    });

    it('should correctly count successful and failed actions', () => {
      const actions: ActionResult[] = [
        { type: 'generate_meal_plan', success: true },
        { type: 'cook_recipe', success: true },
        { type: 'cook_recipe', success: false, error: 'fail' },
        { type: 'give_feedback', success: false, error: 'fail' },
      ];
      const result = makeResult({
        days: [makeSnapshot({ actionsExecuted: actions })],
      });
      const filePath = exporter.exportCSV('profile-1', result);

      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      const dataRow = lines[1];
      // actionsExecuted (2 success), actionsFailed (2 failed)
      const fields = dataRow.split(',');
      // fields: day, date, season, actionsExecuted, actionsFailed, ...
      expect(fields[3]).toBe('2'); // actionsExecuted
      expect(fields[4]).toBe('2'); // actionsFailed
    });

    it('should encode mealPlanGenerated as 1 or 0', () => {
      const result = makeResult({
        days: [
          makeSnapshot({ dayIndex: 0, mealPlanGenerated: true }),
          makeSnapshot({ dayIndex: 1, mealPlanGenerated: false }),
        ],
      });
      const filePath = exporter.exportCSV('profile-1', result);

      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      const row1Fields = lines[1].split(',');
      const row2Fields = lines[2].split(',');
      // mealPlanGenerated is at index 6
      expect(row1Fields[6]).toBe('1');
      expect(row2Fields[6]).toBe('0');
    });

    it('should count only available leftovers', () => {
      const filePath = exporter.exportCSV('profile-1', makeResult());
      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      const fields = lines[1].split(',');
      // leftoverCount is at index 8; default snapshot has 1 available, 1 used
      expect(fields[8]).toBe('1');
    });

    it('should count violations per day', () => {
      const violation: InvariantViolation = {
        profileId: 'profile-1',
        dayIndex: 0,
        date: '2025-06-01',
        type: 'dietary',
        recipeId: 'r-1',
        recipeTitle: 'Bad Recipe',
        detail: 'contains allergen',
        severity: 'critical',
      };
      const result = makeResult({
        days: [makeSnapshot({ violations: [violation, violation] })],
      });
      const filePath = exporter.exportCSV('profile-1', result);

      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      const fields = lines[1].split(',');
      // violationCount is at index 9
      expect(fields[9]).toBe('2');
    });

    it('should produce an empty data section for zero days', () => {
      const result = makeResult({ days: [] });
      const filePath = exporter.exportCSV('profile-1', result);

      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
      // Only header row
      expect(lines).toHaveLength(1);
    });
  });
});
