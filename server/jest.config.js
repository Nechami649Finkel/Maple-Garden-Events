/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/tests/integration/',
    '<rootDir>/tests/contract-lineItems.test.ts',
  ],
  setupFiles: ['<rootDir>/tests/setup.env.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist'],
  clearMocks: true,
  verbose: true,
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
