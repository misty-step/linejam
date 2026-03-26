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
    // Generated files
    "convex/_generated/**",
    // Test coverage output
    "coverage/**",
  ]),
  // Catch stray console.* calls — use structured logger instead.
  // Allowed in logger.ts (implements the logger), error.ts (dev fallback),
  // and errors.ts (Convex structured output).
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Relax no-console in files that legitimately need it
  {
    files: [
      "lib/logger.ts",
      "lib/error.ts",
      "convex/lib/errors.ts",
      "scripts/**",
      "tests/**",
    ],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
