/**
 * CLI entry point for the Kitchen Sink Simulation Harness.
 *
 * Usage:
 *   npx tsx index.ts                          # default: 20 profiles, 90 days
 *   npx tsx index.ts --profiles 5 --days 30   # custom run
 *   npx tsx index.ts --archetype-only          # only archetype profiles
 *   npx tsx index.ts --profile-ids archetype-01 random-03
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { SimulationRunner } from './engine/SimulationRunner';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('profiles', {
      type: 'number',
      default: 20,
      describe: 'Number of profiles to simulate',
    })
    .option('days', {
      type: 'number',
      default: 90,
      describe: 'Days per profile',
    })
    .option('seed', {
      type: 'number',
      default: 42,
      describe: 'Global PRNG seed',
    })
    .option('archetype-only', {
      type: 'boolean',
      default: false,
      describe: 'Only run archetype profiles',
    })
    .option('random-only', {
      type: 'boolean',
      default: false,
      describe: 'Only run random profiles',
    })
    .option('profile-ids', {
      type: 'array',
      string: true,
      describe: 'Specific profile IDs to run',
    })
    .help()
    .argv;

  console.log('Kitchen Sink Simulation Harness');
  console.log(`Profiles: ${argv.profiles}, Days: ${argv.days}, Seed: ${argv.seed}`);

  const runner = new SimulationRunner();
  const startTime = Date.now();

  const results = await runner.run({
    profileCount: argv.profiles,
    daysPerProfile: argv.days,
    seed: argv.seed,
    archetypeOnly: argv.archetypeOnly,
    randomOnly: argv.randomOnly,
    profileIds: argv.profileIds,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalViolations = results.reduce((sum, r) => sum + r.totalViolations.length, 0);

  console.log(`\nSimulation complete in ${elapsed}s`);
  console.log(`Profiles: ${results.length}`);
  console.log(`Total violations: ${totalViolations}`);
  console.log(`Reports written to simulation/output/`);
}

main().catch(err => {
  console.error('Simulation failed:', err.message);
  process.exit(1);
});
