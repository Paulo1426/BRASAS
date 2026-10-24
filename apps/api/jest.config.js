/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  testTimeout: 20000,
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/shared/swagger/**'],
  coverageReporters: ['text-summary', 'lcov', 'html'],
};
