/**
 * Lightweight console-based logger for the simulation harness.
 *
 * Replaces any app-level logger so that simulation output is clearly prefixed
 * and debug noise is suppressed by default.
 */
export const logger = {
  info: (...args: any[]) => console.log('[SIM]', ...args),
  warn: (...args: any[]) => console.warn('[SIM:WARN]', ...args),
  error: (...args: any[]) => console.error('[SIM:ERROR]', ...args),
  debug: (..._args: any[]) => {
    // silent in simulation -- uncomment for local troubleshooting:
    // console.log('[SIM:DEBUG]', ..._args);
  },
};
