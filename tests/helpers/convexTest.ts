import { convexTest } from 'convex-test';
import type { TestConvex } from 'convex-test';
import type { GenericSchema, SchemaDefinition } from 'convex/server';
import schema from '../../convex/schema';

// `import.meta.glob` is a Vite transform — present at runtime under Vitest.
// The call below must stay a literal `import.meta.glob('...')` so Vite can
// statically rewrite it. Next 16.3 types ImportMeta.glob already; do not
// redeclare it.

/**
 * Real-scheduler/real-DB Convex test harness.
 *
 * convex-test needs the function modules map. Its internal fallback calls
 * `import.meta.glob` from inside node_modules, which Vite does not transform —
 * that is the `(intermediate value).glob is not a function` blocker that
 * deferred convex-test in this repo. Passing the glob from a project file Vite
 * *does* transform fixes it. The glob must include `convex/_generated` so
 * convex-test can locate the modules root.
 */
const modules = import.meta.glob('../../convex/**/*.*s');

export type LinejamConvexTest = TestConvex<typeof schema>;

export function setupConvexTest() {
  return convexTest(schema, modules);
}

export function setupConvexTestWithSchema<Schema extends GenericSchema>(
  testSchema: SchemaDefinition<Schema, boolean>
) {
  return convexTest(testSchema, modules);
}
