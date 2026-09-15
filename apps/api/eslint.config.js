import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint for `apps/api`.
 *
 * New in this unit: the `lint` script (`eslint src`) had never been runnable —
 * `eslint` was not a dependency of this package nor of the workspace root, so
 * `pnpm --filter @qualroteiro/api lint` failed (ESLint 9, hoisted from
 * `apps/web`, requires a flat config and aborted with exit 2). The config
 * lives here, in the app that uses it, rather than at the root, which this
 * unit does not own. Mirrors `apps/web/eslint.config.js` minus the
 * React-specific plugins — this is a Fastify/Node backend, not a React app.
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
      // Unused arguments are often part of a signature a callback must satisfy
      // (e.g. Fastify route handlers); an underscore prefix is the
      // conventional way to say "deliberately unused".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
