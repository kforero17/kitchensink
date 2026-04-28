/**
 * RawDataExporter - Exports simulation results to raw JSON and CSV files.
 *
 * Each profile gets its own subdirectory under the output folder containing:
 * - `raw.json`  - The full SimulationResult serialized as formatted JSON.
 * - `daily.csv` - One row per simulated day with key daily metrics.
 */

import { SimulationResult } from '../profiles/types';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// CSV row shape
// ---------------------------------------------------------------------------

/**
 * FeedbackLoop metrics are computed at the profile level (not per-day), but
 * we repeat them on every daily row so downstream analysis tools can join
 * them without a second file.  NaN values are emitted as empty strings
 * (standard CSV convention) rather than the literal "NaN".
 */
interface DailyRow {
  day: number;
  date: string;
  season: string;
  actionsExecuted: number;
  actionsFailed: number;
  recipesCooked: number;
  mealPlanGenerated: number;
  pantrySize: number;
  leftoverCount: number;
  violationCount: number;
  // feedbackLoop columns (profile-level; repeated on each row).  Order is
  // intentional — existing consumers rely on positiveCorrelation,
  // negativeCorrelation, netEffectiveness appearing first in the feedbackLoop
  // section; new diagnostic columns are appended.
  positiveCorrelation: string;
  negativeCorrelation: string;
  netEffectiveness: string;
  feedbackEventCount: number;
  exactRecipeHits: number;
  signatureHits: number;
  overlapDensity: string;
}

/**
 * Render a number for CSV output: NaN becomes empty string, everything else
 * is kept as a fixed-4 decimal string.  Using strings lets csv-stringify
 * emit `""` for NaN rather than the literal `NaN` token.
 */
function formatCsvMetric(value: number): string {
  return Number.isNaN(value) ? '' : value.toFixed(4);
}

// ---------------------------------------------------------------------------
// RawDataExporter
// ---------------------------------------------------------------------------

export class RawDataExporter {
  private outputDir: string;

  constructor(outputDir: string = path.join(__dirname, '..', 'output')) {
    this.outputDir = outputDir;
  }

  /**
   * Write the full SimulationResult as pretty-printed JSON.
   *
   * @returns The absolute path of the written file.
   */
  exportJSON(profileId: string, result: SimulationResult): string {
    const dir = this.ensureProfileDir(profileId);
    const filePath = path.join(dir, 'raw.json');
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
    return filePath;
  }

  /**
   * Write a CSV with one row per simulated day.
   *
   * Columns capture the most useful per-day aggregates so downstream
   * analysis tools (Excel, pandas, R) can ingest the data without
   * parsing the full JSON.
   *
   * @returns The absolute path of the written file.
   */
  exportCSV(profileId: string, result: SimulationResult): string {
    const dir = this.ensureProfileDir(profileId);
    const fb = result.qualityMetrics.feedbackLoop;
    const feedbackFields = {
      positiveCorrelation: formatCsvMetric(fb.positiveCorrelation),
      negativeCorrelation: formatCsvMetric(fb.negativeCorrelation),
      netEffectiveness: formatCsvMetric(fb.netEffectiveness),
      feedbackEventCount: fb.feedbackEventCount,
      exactRecipeHits: fb.exactRecipeHits,
      signatureHits: fb.signatureHits,
      overlapDensity: formatCsvMetric(fb.overlapDensity),
    };
    const rows: DailyRow[] = result.days.map(day => ({
      day: day.dayIndex,
      date: day.date,
      season: day.season,
      actionsExecuted: day.actionsExecuted.filter(a => a.success).length,
      actionsFailed: day.actionsExecuted.filter(a => !a.success).length,
      recipesCooked: day.recipesCooked,
      mealPlanGenerated: day.mealPlanGenerated ? 1 : 0,
      pantrySize: day.stateAfter.pantryItems.length,
      leftoverCount: day.stateAfter.leftovers.filter(l => l.status === 'available').length,
      violationCount: day.violations.length,
      ...feedbackFields,
    }));
    const csv = stringify(rows, { header: true });
    const filePath = path.join(dir, 'daily.csv');
    fs.writeFileSync(filePath, csv);
    return filePath;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private ensureProfileDir(profileId: string): string {
    const dir = path.join(this.outputDir, profileId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}
