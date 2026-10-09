import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The cPanel package (built output) and its CommonJS startup files.
    "deploy/**",
    "scripts/cpanel/**",
    "scripts/test-env/**",
    "src/generated/**",
    // The PHP version: its browser scripts are plain ES5, served as they are.
    "php/**",
  ]),
]);

export default eslintConfig;
