/**
 * Jest mock for @react-native-firebase/auth.
 *
 * Importing this module in the simulation is a design error -- all auth
 * concerns should be handled by the simulation's own profile layer.
 * This mock makes the mistake loud and obvious.
 */
throw new Error(
  'Cannot import @react-native-firebase/auth in simulation. Use SimAuth instead.',
);
