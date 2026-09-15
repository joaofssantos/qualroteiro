import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint for `apps/web`.
 *
 * New in this unit: the `lint` script (`eslint src`) had never been runnable —
 * `eslint` was not a dependency of this package nor of the workspace root, so
 * `pnpm --filter @qualroteiro/web lint` failed with `sh: eslint: command not
 * found`. The config lives here, in the app that uses it, rather than at the
 * root, which this unit does not own.
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Unused arguments are often part of a signature a callback must satisfy;
      // an underscore prefix is the conventional way to say "deliberately unused".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    /*
     * `react-refresh/only-export-components` is a hot-reload ergonomics rule: a
     * file that exports both a component and something else loses fast refresh
     * for that file. Two places export a non-component on purpose and are not
     * going to change:
     *
     *  - `components/ui/*` follow shadcn's convention of exporting the component
     *    together with its `cva` variants, so a caller can compose the same
     *    classes (`buttonVariants`) onto a link.
     *  - `modules/<id>/index.tsx` exports the module's `ModuleDefinition`, which
     *    is the entire point of the registry: one file, one object.
     */
    files: ['src/components/ui/**/*.tsx', 'src/modules/*/index.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Tests reach for Node built-ins (fs, path) and Vitest globals-by-import.
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
