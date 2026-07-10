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
    "dagger/**",
    // Design-lab artifacts (static sketches, not product code)
    "explorations/**",
    // Test coverage output
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  // Catch stray console.* calls — use structured logger instead.
  // Allowed in logger.ts (implements the logger), error.ts (dev fallback),
  // and errors.ts (Convex structured output).
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // Player-path Convex functions must throw ConvexError, never plain Error:
  // Convex redacts plain Error messages in production ("Server Error"), which
  // silently breaks every friendly mapping in lib/errorFeedback.ts
  // (linejam-941). Top-level convex/*.ts modules hold all public
  // mutations/queries; the listed lib modules throw on player paths. Internal
  // lib code (guestToken, canary, AI providers) may keep plain Error — for
  // genuinely internal invariants, prod redaction is a feature.
  {
    files: [
      "convex/*.ts",
      "convex/lib/room.ts",
      "convex/lib/auth.ts",
      "convex/lib/rateLimit.ts",
      "convex/lib/abuseRateLimit.ts",
      "convex/lib/assignPoemReaders.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message:
            "Convex redacts plain Error in production, so lib/errorFeedback.ts mappings never fire. Throw ConvexError (from 'convex/values') on player-facing paths instead.",
        },
        {
          selector: "ThrowStatement > CallExpression[callee.name='Error']",
          message:
            "Convex redacts plain Error in production, so lib/errorFeedback.ts mappings never fire. Throw ConvexError (from 'convex/values') on player-facing paths instead.",
        },
      ],
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
