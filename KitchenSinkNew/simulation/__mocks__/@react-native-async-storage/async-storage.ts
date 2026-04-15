/**
 * Jest mock for @react-native-async-storage/async-storage.
 *
 * Importing this module in the simulation is a design error -- all persistent
 * storage should go through the simulation's own data layer.
 * This mock makes the mistake loud and obvious.
 */
throw new Error(
  'Cannot import AsyncStorage in simulation. Use SimFirestore.getHistory() instead.',
);
