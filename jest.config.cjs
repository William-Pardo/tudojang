// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/$1',
    '^../servicios/geminiService$': '<rootDir>/__mocks__/geminiService.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
};
