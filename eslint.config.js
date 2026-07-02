// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const securityPlugin = require('eslint-plugin-security');
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // Ignore JS output, node_modules, JS config files, and integration test runners (JS)
  {
    ignores: [
      '**/out/**',
      '**/node_modules/**',
      '**/.vscode-test/**',
      '**/*.d.ts',
      'eslint.config.js',
      'jest.config.js',
      '*.config.js',
      'test/integration/**',
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // Source TypeScript files (client + server)
  {
    files: ['client/src/**/*.ts', 'server/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./client/tsconfig.json', './server/tsconfig.json'],
        ecmaVersion: 2022,
      },
      globals: {
        ...globals.node,
        Thenable: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      security: securityPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended-type-checked'].rules,
      ...securityPlugin.configs.recommended.rules,

      // TypeScript handles no-undef; disable it to avoid false positives for VSCode types
      'no-undef': 'off',

      // Object injection false positives are pervasive in typed TS; disable
      'security/detect-object-injection': 'off',

      // Project rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      eqeqeq: ['error', 'always'],
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
    },
  },

  // Test TypeScript files (jest globals, relaxed rules)
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.test.json'],
        ecmaVersion: 2022,
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended-type-checked'].rules,

      'no-undef': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-shadow': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
    },
  },

  // Repository maintenance scripts run in Node.js but are not extension runtime code.
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
