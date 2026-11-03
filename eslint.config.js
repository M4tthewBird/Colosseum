// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    // supabase/functions runs on Deno (npm: imports), outside the app's lint and types.
    ignores: ['dist/*', 'design/*', 'node_modules/*', '.expo/*', 'supabase/functions/**'],
  },
]);
