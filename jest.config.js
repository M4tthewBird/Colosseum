/** Pure-function unit tests (formulas, dates). UI is checked visually on web. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, isolatedModules: true, resolveJsonModule: true, rootDir: '.', types: ['jest'] } }],
  },
};
