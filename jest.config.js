/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  testMatch: ['<rootDir>/**/*.(test|spec).(ts|tsx)'],
  testPathIgnorePatterns: [
    '<rootDir>/functions/',
    '<rootDir>/scripts/.*\\.test\\.js$',
    '<rootDir>/cypress/',
    '<rootDir>/node_modules/',
  ],
  moduleNameMapper: {
    'framer-motion': '<rootDir>/__mocks__/framer-motion.tsx',
    '^d3-(.*)$': '<rootDir>/node_modules/d3-$1',
    '^\\./pdfWorkerConfig$': '<rootDir>/components/academico/pdfWorkerConfig.mock.ts',
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!d3-array|d3-scale|d3-shape|d3-interpolate|d3-format|d3-time|d3-path|d3-selection|d3-transition|d3-ease)'
  ],
};
