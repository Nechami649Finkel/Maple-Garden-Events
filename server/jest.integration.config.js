/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup.env.ts', '<rootDir>/tests/integration/setup.integration.env.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist'],
  clearMocks: true,
  verbose: true,
  // בדיקות DB אינטגרציה — קובץ אחד בכל פעם מונע התנגשויות setup
  maxWorkers: 1,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tests/tsconfig.json',
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
};
