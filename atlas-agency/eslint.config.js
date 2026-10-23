// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Zod idiom: `export const Country = z.object(...)` + `export type Country = z.infer<...>`.
      '@typescript-eslint/no-redeclare': 'off',
    },
  },
  {
    ignores: ['dist/*', 'content/countries/dist/*', 'src/content/flagAssets.ts', 'src/features/map/glyphAssets.ts'],
  },
]);
