import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint for `services/data-ingest`.
 *
 * Mirrors `apps/api/eslint.config.js` verbatim (same reasoning: ESLint 9
 * needs a flat config, and it isn't hoisted to the workspace root) — this is
 * a Node/BullMQ background job, same runtime shape as the API.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      // Unused arguments are often part of a signature a callback must
      // satisfy (e.g. a BullMQ job processor); an underscore prefix is the
      // conventional way to say "deliberately unused".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
