/**
 * SimulationRunner - Top-level orchestrator for the simulation harness.
 *
 * Wires together all components (auth, firestore, profiles, engine, reports)
 * and drives the full simulation lifecycle:
 *   1. Pre-flight checks (emulator connectivity, recipe data)
 *   2. Profile generation (archetype + random)
 *   3. Per-profile simulation loop
 *   4. Report generation
 */

import { SimFirestore } from '../data/SimFirestore';
import { SimAuth } from '../data/SimAuth';
import {
  initializeEmulatorApp,
  verifyEmulatorConnection,
  verifyRecipeData,
} from '../data/emulatorConnection';
import { ActionRegistry } from '../actions/ActionRegistry';
import { InvariantChecker } from '../invariants/InvariantChecker';
import { QualityTracker } from '../quality/QualityTracker';
import { DaySimulator } from './DaySimulator';
import { RawDataExporter } from '../reports/RawDataExporter';
import { SummaryReportGenerator } from '../reports/SummaryReportGenerator';
import { generateArchetypeProfiles } from '../profiles/archetypeProfiles';
import { generateRandomProfiles } from '../profiles/randomProfiles';
import {
  SimulationProfile,
  SimulationResult,
  ProfileDefinition,
  DaySnapshot,
} from '../profiles/types';
import * as path from 'path';
import seedRandom = require('seed-random');

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SimulationOptions {
  /** Total number of profiles to simulate (default 20: 10 archetype + 10 random). */
  profileCount?: number;
  /** Number of simulated days per profile (default 90). */
  daysPerProfile?: number;
  /** Global PRNG seed (default 42). */
  seed?: number;
  /** Only run archetype profiles. */
  archetypeOnly?: boolean;
  /** Only run random profiles. */
  randomOnly?: boolean;
  /** Run specific profile IDs only (e.g. ['archetype-01', 'random-03']). */
  profileIds?: string[];
}

// ---------------------------------------------------------------------------
// SimulationRunner
// ---------------------------------------------------------------------------

export class SimulationRunner {
  /**
   * Run the full simulation.
   *
   * @param options - Configuration overrides.
   * @returns An array of SimulationResult, one per profile.
   */
  async run(options: SimulationOptions = {}): Promise<SimulationResult[]> {
    const {
      profileCount = 20,
      daysPerProfile = 90,
      seed = 42,
      archetypeOnly = false,
      randomOnly = false,
      profileIds,
    } = options;

    const runStart = Date.now();

    // ------------------------------------------------------------------
    // 1. Pre-flight checks
    // ------------------------------------------------------------------
    console.log('[runner] Verifying emulator connection...');
    await verifyEmulatorConnection();
    console.log('[runner] Emulator connection OK');

    console.log('[runner] Verifying recipe data...');
    const recipeCount = await verifyRecipeData();
    console.log(`[runner] Found ${recipeCount} recipes in emulator Firestore`);

    // ------------------------------------------------------------------
    // 2. Initialize shared dependencies
    // ------------------------------------------------------------------
    const app = initializeEmulatorApp();
    const simAuth = new SimAuth(app);
    const simFirestore = new SimFirestore(app);
    const actionRegistry = new ActionRegistry();
    const invariantChecker = new InvariantChecker();
    const rawExporter = new RawDataExporter();
    const summaryGenerator = new SummaryReportGenerator();

    // ------------------------------------------------------------------
    // 3. Generate profiles
    // ------------------------------------------------------------------
    const profiles = this.buildProfiles({
      profileCount,
      seed,
      archetypeOnly,
      randomOnly,
      profileIds,
    });

    console.log(`[runner] ${profiles.length} profiles to simulate, ${daysPerProfile} days each`);

    // ------------------------------------------------------------------
    // 4. Run each profile
    // ------------------------------------------------------------------
    const results: SimulationResult[] = [];

    for (let pi = 0; pi < profiles.length; pi++) {
      const profile = profiles[pi];
      const profileStart = Date.now();

      console.log(
        `\n[runner] [${ pi + 1}/${profiles.length}] Starting profile: ${profile.name} (${profile.id})`,
      );

      // 4a. Clean previous data and create user
      await simAuth.deleteAllUsers();
      const uid = await simAuth.createUser(profile);
      const resolvedProfile: SimulationProfile = { ...profile, uid };

      // 4b. Set preferences
      await simFirestore.setPreferences(uid, resolvedProfile.preferences);

      // 4c. Seed pantry (strip id before adding -- Firestore generates ids)
      for (const pantryItem of resolvedProfile.startingPantry) {
        const { id, ...item } = pantryItem;
        await simFirestore.addPantryItem(uid, item);
      }

      // 4d. Create per-profile engine instances
      const qualityTracker = new QualityTracker();
      const daySimulator = new DaySimulator(
        simFirestore,
        actionRegistry,
        invariantChecker,
        qualityTracker,
      );

      // 4e. Create seeded RNG from profile seed
      const rng = seedRandom(String(resolvedProfile.seed));

      // 4f. Day loop
      const daySnapshots: DaySnapshot[] = [];

      for (let dayIndex = 0; dayIndex < daysPerProfile; dayIndex++) {
        const currentDate = this.addDays(resolvedProfile.simulationStartDate, dayIndex);

        const snapshot = await daySimulator.simulateDay(
          resolvedProfile,
          dayIndex,
          currentDate,
          rng,
        );
        daySnapshots.push(snapshot);

        // Progress logging every 10 days
        if ((dayIndex + 1) % 10 === 0 || dayIndex === daysPerProfile - 1) {
          const elapsed = ((Date.now() - profileStart) / 1000).toFixed(1);
          console.log(
            `  [${profile.id}] Day ${dayIndex + 1}/${daysPerProfile} (${elapsed}s)`,
          );
        }
      }

      // 4g. Finalize quality metrics
      const qualityMetrics = qualityTracker.finalize();
      const totalViolations = qualityTracker.getAllViolations();
      const profileDuration = Date.now() - profileStart;

      const result: SimulationResult = {
        profile: resolvedProfile,
        days: daySnapshots,
        qualityMetrics,
        totalViolations,
        durationMs: profileDuration,
      };

      // 4h. Export raw data
      rawExporter.exportJSON(resolvedProfile.id, result);
      rawExporter.exportCSV(resolvedProfile.id, result);

      // 4i. Cleanup
      await simFirestore.clearUserData(uid);
      await simAuth.deleteUser(uid);

      results.push(result);

      console.log(
        `[runner] Completed ${profile.name}: ${daySnapshots.length} days, ` +
        `${totalViolations.length} violations, ${(profileDuration / 1000).toFixed(1)}s`,
      );
    }

    // ------------------------------------------------------------------
    // 5. Generate summary report
    // ------------------------------------------------------------------
    const totalDuration = Date.now() - runStart;
    const summaryMd = summaryGenerator.generate(results);
    const outputDir = path.join(__dirname, '..', 'output');
    summaryGenerator.writeToFile(summaryMd, outputDir);

    console.log(`\n[runner] All profiles complete. Total time: ${(totalDuration / 1000).toFixed(1)}s`);

    return results;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Build the list of SimulationProfile objects from archetype and random
   * profile definitions, applying filters and caps.
   */
  private buildProfiles(opts: {
    profileCount: number;
    seed: number;
    archetypeOnly: boolean;
    randomOnly: boolean;
    profileIds?: string[];
  }): SimulationProfile[] {
    const { profileCount, seed, archetypeOnly, randomOnly, profileIds } = opts;

    let allProfiles: SimulationProfile[] = [];

    // Generate archetype profiles unless randomOnly
    if (!randomOnly) {
      const archetypeDefs = generateArchetypeProfiles();
      const archetypeProfiles = archetypeDefs.map((def, index) =>
        this.toSimulationProfile(
          def,
          `archetype-${String(index + 1).padStart(2, '0')}`,
          index + 1, // seeds 1-10
        ),
      );
      allProfiles.push(...archetypeProfiles);
    }

    // Generate random profiles unless archetypeOnly
    if (!archetypeOnly) {
      const randomCount = archetypeOnly ? 0 : Math.max(0, profileCount - allProfiles.length);
      const randomDefs = generateRandomProfiles(randomCount, seed);
      const randomProfiles = randomDefs.map((def, index) =>
        this.toSimulationProfile(
          def,
          `random-${String(index + 1).padStart(2, '0')}`,
          index + 11, // seeds 11-N+10
        ),
      );
      allProfiles.push(...randomProfiles);
    }

    // Filter by specific profile IDs if provided
    if (profileIds && profileIds.length > 0) {
      allProfiles = allProfiles.filter(p => profileIds.includes(p.id));
    }

    // Cap total at profileCount
    return allProfiles.slice(0, profileCount);
  }

  /**
   * Convert a ProfileDefinition to a SimulationProfile by assigning
   * an ID, a placeholder UID, and a seed.
   */
  private toSimulationProfile(
    def: ProfileDefinition,
    id: string,
    seed: number,
  ): SimulationProfile {
    return {
      id,
      name: def.name,
      uid: '', // Assigned when the user is created in Firebase Auth
      preferences: def.preferences,
      engagementTier: def.engagementTier,
      startingPantry: def.startingPantry,
      simulationStartDate: def.simulationStartDate,
      seed,
    };
  }

  /**
   * Compute a Date by adding `days` to a date string (YYYY-MM-DD).
   */
  private addDays(dateStr: string, days: number): Date {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() + days);
    return date;
  }
}
