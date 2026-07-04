import { convexTest } from 'convex-test';
import type { GenericSchema, SchemaDefinition } from 'convex/server';
import schema from '../../convex/schema';

// `import.meta.glob` is a Vite transform — present at runtime under Vitest but
// not typed by the app tsconfig (which omits vite/client types). Declare just
// the method here rather than widen the whole app typecheck. The call below
// must stay a literal `import.meta.glob('...')` so Vite can statically rewrite it.
declare global {
  interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
}

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

export function setupConvexTest() {
  return convexTest(schema, modules);
}

export function setupConvexTestWithSchema<Schema extends GenericSchema>(
  testSchema: SchemaDefinition<Schema, boolean>
) {
  return convexTest(testSchema, modules);
}
