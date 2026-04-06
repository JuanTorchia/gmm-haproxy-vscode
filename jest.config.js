/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.test.json',
    }],
  },
  moduleNameMapper: {
    '^vscode-languageserver/node$': '<rootDir>/test/__mocks__/vscode-languageserver.ts',
    '^vscode-languageserver-textdocument$': '<rootDir>/test/__mocks__/vscode-languageserver-textdocument.ts',
  },
  collectCoverageFrom: [
    'server/src/parser/**/*.ts',
    'server/src/validation/**/*.ts',
    'server/src/registry/**/*.ts',
    'server/src/completion/**/*.ts',
    'server/src/hover/**/*.ts',
    'server/src/formatting/**/*.ts',
    'server/src/symbols/**/*.ts',
    'server/src/definition/**/*.ts',
    'server/src/codeactions/**/*.ts',
    'server/src/folding/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
    },
  },
};
