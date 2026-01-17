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
    "dist/**",
    "next-env.d.ts",
    // Data directories
    "data/**",
    "archive/**",
    "archive_2/**",
    "scripts/**",
    // Other
    "*.csv",
    "*.json",
    "!package.json",
    "!tsconfig.json",
  ]),
]);

export default eslintConfig;
