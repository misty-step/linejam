/**
 * Vitest 5 compatibility shim for @testing-library/jest-dom@7.0.1 types.
 *
 * Vitest 5 changed the assertion interface to `Assertion<R, T>`
 * (vitest-dev/vitest#10221). jest-dom's `declare module 'vitest'` block in
 * `types/vitest.d.ts` still declares `Assertion<T = any>` (one parameter), so
 * TypeScript refuses to merge the augmentation. `skipLibCheck` hides the
 * TS2428 error and every jest-dom matcher silently disappears from the
 * assertion type. Upstream: testing-library/jest-dom#738.
 *
 * Augmenting `Matchers` reaches both `Assertion` (which extends
 * `Matchers<R, T>`) and the global `ExpectStatic` (which extends
 * `Matchers<any>`). The type parameter list must repeat Vitest's own
 * declaration exactly or TypeScript rejects the merge.
 *
 * Remove this file once @testing-library/jest-dom ships vitest-5-aware types.
 */
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars --
   Declaration merging requires an empty interface body, and the type parameter
   list must repeat Vitest's own `Matchers` declaration (T is unused by design). */
declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
