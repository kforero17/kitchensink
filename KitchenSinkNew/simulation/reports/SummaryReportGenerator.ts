/**
 * SummaryReportGenerator - Produces a Markdown summary report for the
 * full simulation run.
 *
 * The report is structured into five sections:
 *   1. Executive Summary - counts, invariant pass/fail, quality averages
 *   2. Per-Profile Cards - one table row per profile
 *   3. Invariant Violation Log - sorted table, capped at 100 rows
 *   4. Quality Metric Trends - mean/std/min/max + outlier detection
 *   5. Flagged Issues - profiles that cross quality thresholds
 *
 * `generate()` returns the Markdown string. `writeToFile()` persists it.
 */

import { SimulationResult, InvariantViolation, QualityMetrics } from '../profiles/types';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Violation type constants
// ---------------------------------------------------------------------------

const INVARIANT_TYPES: InvariantViolation['type'][] = ['dietary', 'repetition', 'instrument'];

// ---------------------------------------------------------------------------
// SummaryReportGenerator
// ---------------------------------------------------------------------------

export class SummaryReportGenerator {
  /**
   * Generate a Markdown summary report from simulation results.
   *
   * @param results - All completed simulation results.
   * @returns The full Markdown report as a string.
   */
  generate(results: SimulationResult[]): string {
    const lines: string[] = [];

    lines.push('# Simulation Summary Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    this.appendExecutiveSummary(lines, results);
    this.appendPerProfileCards(lines, results);
    this.appendViolationLog(lines, results);
    this.appendQualityTrends(lines, results);
    this.appendFlaggedIssues(lines, results);

    return lines.join('\n');
  }

  /**
   * Write a Markdown string to `summary.md` in the given output directory.
   *
   * @param md - The Markdown content to write.
   * @param outputDir - Directory to write into (created if missing).
   * @returns The absolute path of the written file.
   */
  writeToFile(md: string, outputDir: string): string {
    fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, 'summary.md');
    fs.writeFileSync(filePath, md);
    return filePath;
  }

  // -------------------------------------------------------------------------
  // Section 1: Executive Summary
  // -------------------------------------------------------------------------

  private appendExecutiveSummary(lines: string[], results: SimulationResult[]): void {
    lines.push('## 1. Executive Summary');
    lines.push('');

    const totalDays = results.reduce((sum, r) => sum + r.days.length, 0);
    const totalViolations = results.flatMap(r => r.totalViolations);

    // Counts table
    lines.push('| Metric | Value |');
    lines.push('| --- | --- |');
    lines.push(`| Profiles | ${results.length} |`);
    lines.push(`| Total Days | ${totalDays} |`);
    lines.push(`| Total Violations | ${totalViolations.length} |`);
    lines.push('');

    // Invariant pass/fail
    lines.push('**Invariant Results:**');
    lines.push('');
    for (const type of INVARIANT_TYPES) {
      const count = totalViolations.filter(v => v.type === type).length;
      if (count === 0) {
        lines.push(`- **${type}**: PASS`);
      } else {
        lines.push(`- **${type}**: FAIL (${count})`);
      }
    }
    lines.push('');

    // Quality averages table
    if (results.length > 0) {
      const metrics = results.map(r => r.qualityMetrics);
      const noveltyLabel = this.noveltyLabel(results, 'mean');

      lines.push('**Quality Averages:**');
      lines.push('');
      lines.push('| Metric | Average |');
      lines.push('| --- | --- |');
      lines.push(`| ${noveltyLabel} | ${this.formatAvgSkipNaN(metrics.map(m => m.diversity.mean))} |`);
      lines.push(`| Pantry Utilization | ${this.avg(metrics.map(m => m.pantryUtilization.mean)).toFixed(4)} |`);
      lines.push(`| Feedback Effectiveness | ${this.avg(metrics.map(m => m.feedbackLoop.netEffectiveness)).toFixed(4)} |`);
      lines.push(`| Seasonal Relevance | ${this.avg(metrics.map(m => m.seasonalRelevance.meanMatchRate)).toFixed(4)} |`);
      lines.push(`| Expiry Rescue Rate | ${this.avg(metrics.map(m => m.expiryDriven.rescueRate)).toFixed(4)} |`);
    }
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // Section 2: Per-Profile Cards
  // -------------------------------------------------------------------------

  private appendPerProfileCards(lines: string[], results: SimulationResult[]): void {
    lines.push('## 2. Per-Profile Cards');
    lines.push('');

    const noveltyColumn = this.noveltyLabel(results);
    lines.push(`| Name | ID | Tier | Days | Plans | Cooked | Violations | ${noveltyColumn} | Pantry Util | Feedback | Seasonal | Rescue |`);
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');

    for (const r of results) {
      const { profile, days, qualityMetrics, totalViolations: violations } = r;
      const planDays = days.filter(d => d.mealPlanGenerated).length;
      const totalCooked = days.reduce((s, d) => s + d.recipesCooked, 0);

      lines.push(
        `| ${profile.name} | ${profile.id} | ${profile.engagementTier} ` +
        `| ${days.length} | ${planDays} | ${totalCooked} | ${violations.length} ` +
        `| ${this.formatNumber(qualityMetrics.diversity.mean)} ` +
        `| ${qualityMetrics.pantryUtilization.mean.toFixed(4)} ` +
        `| ${qualityMetrics.feedbackLoop.netEffectiveness.toFixed(4)} ` +
        `| ${qualityMetrics.seasonalRelevance.meanMatchRate.toFixed(4)} ` +
        `| ${qualityMetrics.expiryDriven.rescueRate.toFixed(4)} |`,
      );
    }
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // Section 3: Invariant Violation Log
  // -------------------------------------------------------------------------

  private appendViolationLog(lines: string[], results: SimulationResult[]): void {
    lines.push('## 3. Invariant Violation Log');
    lines.push('');

    const allViolations = results.flatMap(r => r.totalViolations);

    // Sort: critical first, then by profile, then by day
    const sorted = [...allViolations].sort((a, b) => {
      const sevOrder = (v: InvariantViolation) => (v.severity === 'critical' ? 0 : 1);
      if (sevOrder(a) !== sevOrder(b)) return sevOrder(a) - sevOrder(b);
      if (a.profileId !== b.profileId) return a.profileId < b.profileId ? -1 : 1;
      return a.dayIndex - b.dayIndex;
    });

    lines.push('| Profile | Day | Date | Type | Severity | Recipe | Detail |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');

    const capped = sorted.slice(0, 100);
    for (const v of capped) {
      lines.push(
        `| ${v.profileId} | ${v.dayIndex} | ${v.date} | ${v.type} | ${v.severity} | ${v.recipeTitle} | ${v.detail} |`,
      );
    }

    if (sorted.length > 100) {
      lines.push('');
      lines.push(`... and ${sorted.length - 100} more violations`);
    }
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // Section 4: Quality Metric Trends
  // -------------------------------------------------------------------------

  private appendQualityTrends(lines: string[], results: SimulationResult[]): void {
    lines.push('## 4. Quality Metric Trends');
    lines.push('');

    if (results.length === 0) {
      lines.push('No data.');
      lines.push('');
      return;
    }

    const metricExtractors: Array<{
      label: string;
      extract: (m: QualityMetrics) => number;
    }> = [
      { label: this.noveltyLabel(results, 'mean'), extract: m => m.diversity.mean },
      { label: 'Pantry Utilization (mean)', extract: m => m.pantryUtilization.mean },
      { label: 'Feedback Effectiveness', extract: m => m.feedbackLoop.netEffectiveness },
      { label: 'Seasonal Relevance', extract: m => m.seasonalRelevance.meanMatchRate },
      { label: 'Expiry Rescue Rate', extract: m => m.expiryDriven.rescueRate },
    ];

    lines.push('| Metric | Mean | Std | Min | Max | Outliers |');
    lines.push('| --- | --- | --- | --- | --- | --- |');

    for (const { label, extract } of metricExtractors) {
      const rawValues = results.map(r => extract(r.qualityMetrics));
      const values = rawValues.filter(v => !Number.isNaN(v));

      if (values.length === 0) {
        lines.push(`| ${label} | — | — | — | — | none |`);
        continue;
      }

      const mean = this.avg(values);
      const std = this.stdDev(values);
      const min = Math.min(...values);
      const max = Math.max(...values);

      // Find outliers: > 1.5 std from mean
      const threshold = 1.5 * std;
      const outlierNames: string[] = [];
      for (let i = 0; i < results.length; i++) {
        if (Number.isNaN(rawValues[i])) continue;
        if (Math.abs(rawValues[i] - mean) > threshold && threshold > 0) {
          outlierNames.push(results[i].profile.name);
        }
      }

      const outlierStr = outlierNames.length > 0 ? outlierNames.join(', ') : 'none';

      lines.push(
        `| ${label} | ${mean.toFixed(4)} | ${std.toFixed(4)} | ${min.toFixed(4)} | ${max.toFixed(4)} | ${outlierStr} |`,
      );
    }
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // Section 5: Flagged Issues
  // -------------------------------------------------------------------------

  private appendFlaggedIssues(lines: string[], results: SimulationResult[]): void {
    lines.push('## 5. Flagged Issues');
    lines.push('');

    const flags: string[] = [];

    for (const r of results) {
      const name = r.profile.name;
      const m = r.qualityMetrics;

      if (r.totalViolations.length > 5) {
        flags.push(`- **${name}**: ${r.totalViolations.length} violations`);
      }
      if (!Number.isNaN(m.diversity.mean) && m.diversity.mean < 0.5) {
        flags.push(`- **${name}**: novelty ${m.diversity.mean.toFixed(4)}`);
      }
      if (m.feedbackLoop.netEffectiveness < 0) {
        flags.push(`- **${name}**: feedback effectiveness ${m.feedbackLoop.netEffectiveness.toFixed(4)}`);
      }
      if (m.pantryUtilization.trend < 0) {
        flags.push(`- **${name}**: pantry utilization trend ${m.pantryUtilization.trend.toFixed(4)}`);
      }
      if (m.expiryDriven.rescueRate < 0.2) {
        flags.push(`- **${name}**: expiry rescue rate ${m.expiryDriven.rescueRate.toFixed(4)}`);
      }
    }

    if (flags.length === 0) {
      lines.push('No issues flagged.');
    } else {
      lines.push(...flags);
    }
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // Math helpers
  // -------------------------------------------------------------------------

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[]): number {
    if (values.length <= 1) return 0;
    const mean = this.avg(values);
    const sumSq = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
    return Math.sqrt(sumSq / values.length);
  }

  /**
   * Build the Novelty column/row label.  Reads lookbackDays from the first
   * persona's diversity metrics; falls back to a generic label if the shape
   * is missing (e.g. tests with pre-computed fixtures).
   */
  private noveltyLabel(results: SimulationResult[], suffix?: string): string {
    const first = results[0]?.qualityMetrics?.diversity;
    const lookback =
      first && typeof first.lookbackDays === 'number'
        ? first.lookbackDays
        : null;
    const base = lookback !== null ? `Novelty (${lookback}d` : 'Novelty (';
    if (suffix) {
      return lookback !== null
        ? `${base}, ${suffix})`
        : `Novelty (${suffix})`;
    }
    return lookback !== null ? `${base})` : 'Novelty';
  }

  /** Format a number for a report cell, rendering NaN as an em dash. */
  private formatNumber(value: number): string {
    return Number.isNaN(value) ? '—' : value.toFixed(4);
  }

  /**
   * Average a list of values, skipping NaNs.  Renders `"—"` when every value
   * is NaN.  Used for the executive-summary novelty row.
   */
  private formatAvgSkipNaN(values: number[]): string {
    const finite = values.filter(v => !Number.isNaN(v));
    if (finite.length === 0) return '—';
    return this.avg(finite).toFixed(4);
  }
}
