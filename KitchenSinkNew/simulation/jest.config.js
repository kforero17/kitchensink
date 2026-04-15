module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/../src/$1',
    '^@react-native-firebase/(.*)$': '<rootDir>/__mocks__/@react-native-firebase/$1',
    '^@react-native-async-storage/(.*)$': '<rootDir>/__mocks__/@react-native-async-storage/$1',
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
