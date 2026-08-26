import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      /* ── Why eslint-plugin-react is here ──────────────────────────────────
         Without it, ESLint's core rules cannot see JSX at all. `<Foo />` parses
         to a JSXIdentifier, which core ESLint does not treat as a reference to
         the variable `Foo`. That broke the linter in BOTH directions and each
         one cost real time:

           • A component imported and used only inside JSX was reported as
             "defined but never used" — dozens of false errors across the
             codebase, which trained us to skim past lint output.

           • A component used in JSX but NEVER IMPORTED was reported as
             nothing at all. `no-undef` never saw the reference. esbuild does
             not do scope analysis either, so `vite build` passed cleanly and
             the error only appeared as a ReferenceError in the browser — which
             unmounts the React tree and shows a blank white page. That is
             exactly how a missing `Check` import shipped to production.

         These two rules close both gaps. jsx-no-undef is the one that matters:
         it is the difference between a lint error and a white screen. */
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-no-undef': 'error',
    },
  },
])
