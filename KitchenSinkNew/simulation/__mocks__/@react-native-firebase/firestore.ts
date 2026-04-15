/**
 * Jest mock for @react-native-firebase/firestore.
 *
 * Importing this module in the simulation is a design error -- all Firestore
 * access should go through the simulation's own data layer (SimFirestore).
 * This mock makes the mistake loud and obvious.
 */
throw new Error(
  'Cannot import @react-native-firebase/firestore in simulation. Use SimFirestore instead.',
);
