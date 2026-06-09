import {
  dag,
  CacheVolume,
  Container,
  Directory,
  Secret,
  func,
  object,
} from '@dagger.io/dagger';

const NODE_IMAGE = 'node:22-bookworm';
const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.58.2-noble';
const PNPM_STORE_DIR = '/pnpm/store';

type AppEnv = {
  nextPublicConvexUrl?: string;
  nextPublicClerkPublishableKey?: string;
  clerkSecretKey?: Secret;
  clerkJwtIssuerDomain?: string;
  playwrightClerkTestEmail?: string;
  guestTokenSecret?: Secret;
  canaryEndpoint?: string;
  canaryApiKey?: Secret;
  nextPublicCanaryEndpoint?: string;
  nextPublicCanaryApiKey?: string;
  stagehandModel?: string;
  stagehandModelApiKey?: Secret;
};

function withOptionalEnv(
  container: Container,
  name: string,
  value: string | undefined
): Container {
  return value ? container.withEnvVariable(name, value) : container;
}

function withOptionalSecretEnv(
  container: Container,
  name: string,
  value: Secret | undefined
): Container {
  return value ? container.withSecretVariable(name, value) : container;
}

function requireSecret(
  name: string,
  value: Secret | undefined,
  operation: string
): Secret {
  if (!value) {
    throw new Error(
      `${name} is required for ${operation}. Set it in .env.local or export it before running Dagger CI.`
    );
  }

  return value;
}

function withAppEnv(container: Container, env: AppEnv): Container {
  const publicEnvEntries: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_CONVEX_URL', env.nextPublicConvexUrl],
    ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', env.nextPublicClerkPublishableKey],
    ['CLERK_PUBLISHABLE_KEY', env.nextPublicClerkPublishableKey],
    ['CLERK_JWT_ISSUER_DOMAIN', env.clerkJwtIssuerDomain],
    ['PLAYWRIGHT_CLERK_TEST_EMAIL', env.playwrightClerkTestEmail],
    ['CANARY_ENDPOINT', env.canaryEndpoint],
    ['NEXT_PUBLIC_CANARY_ENDPOINT', env.nextPublicCanaryEndpoint],
    ['NEXT_PUBLIC_CANARY_API_KEY', env.nextPublicCanaryApiKey],
    ['STAGEHAND_MODEL', env.stagehandModel],
  ];
  const withPublicEnv = publicEnvEntries.reduce(
    (current, [name, value]) => withOptionalEnv(current, name, value),
    container
  );

  const secretEnvEntries: Array<[string, Secret | undefined]> = [
    ['CLERK_SECRET_KEY', env.clerkSecretKey],
    ['GUEST_TOKEN_SECRET', env.guestTokenSecret],
    ['STAGEHAND_MODEL_API_KEY', env.stagehandModelApiKey],
  ];

  return secretEnvEntries.reduce(
    (current, [name, value]) => withOptionalSecretEnv(current, name, value),
    withPublicEnv
  );
}

function baseContainer(
  source: Directory,
  env: AppEnv,
  image: string,
  cacheName: string
): Container {
  const pnpmCache: CacheVolume = dag.cacheVolume(cacheName);

  return withAppEnv(
    dag
      .container()
      .from(image)
      .withEnvVariable('CI', '1')
      .withEnvVariable('COREPACK_ENABLE_DOWNLOAD_PROMPT', '0')
      .withEnvVariable('PNPM_HOME', '/pnpm')
      .withEnvVariable('PNPM_STORE_DIR', PNPM_STORE_DIR)
      .withEnvVariable('PLAYWRIGHT_BROWSERS_PATH', '/ms-playwright')
      .withMountedCache(PNPM_STORE_DIR, pnpmCache)
      .withMountedDirectory('/src', source)
      .withWorkdir('/src')
      .withExec(['corepack', 'enable'])
      .withExec(['pnpm', 'install', '--frozen-lockfile']),
    env
  );
}

async function runChecks(
  checks: Array<[name: string, run: () => Promise<string>]>
): Promise<string> {
  const results: string[] = [];

  for (const [name, run] of checks) {
    await run();
    results.push(`${name}: ok`);
  }

  return results.join('\n');
}

@object()
export class Ci {
  @func()
  base(
    source: Directory,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Container {
    return baseContainer(
      source,
      {
        nextPublicConvexUrl,
        nextPublicClerkPublishableKey,
        clerkSecretKey,
        clerkJwtIssuerDomain,
        playwrightClerkTestEmail,
        guestTokenSecret,
        canaryEndpoint,
        canaryApiKey,
        nextPublicCanaryEndpoint,
        nextPublicCanaryApiKey,
      },
      NODE_IMAGE,
      'linejam-pnpm'
    );
  }

  @func()
  async formatCheck(
    source: Directory,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return this.base(
      source,
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      clerkSecretKey,
      clerkJwtIssuerDomain,
      playwrightClerkTestEmail,
      guestTokenSecret,
      canaryEndpoint,
      canaryApiKey,
      nextPublicCanaryEndpoint,
      nextPublicCanaryApiKey
    )
      .withExec(['pnpm', 'format:check'])
      .stdout();
  }

  @func()
  async lint(
    source: Directory,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return this.base(
      source,
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      clerkSecretKey,
      clerkJwtIssuerDomain,
      playwrightClerkTestEmail,
      guestTokenSecret,
      canaryEndpoint,
      canaryApiKey,
      nextPublicCanaryEndpoint,
      nextPublicCanaryApiKey
    )
      .withExec(['pnpm', 'lint'])
      .stdout();
  }

  @func()
  async typecheck(
    source: Directory,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return this.base(
      source,
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      clerkSecretKey,
      clerkJwtIssuerDomain,
      playwrightClerkTestEmail,
      guestTokenSecret,
      canaryEndpoint,
      canaryApiKey,
      nextPublicCanaryEndpoint,
      nextPublicCanaryApiKey
    )
      .withExec(['pnpm', 'typecheck'])
      .stdout();
  }

  @func()
  async unitTest(
    source: Directory,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return this.base(
      source,
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      clerkSecretKey,
      clerkJwtIssuerDomain,
      playwrightClerkTestEmail,
      guestTokenSecret,
      canaryEndpoint,
      canaryApiKey,
      nextPublicCanaryEndpoint,
      nextPublicCanaryApiKey
    )
      .withExec(['pnpm', 'test:ci'])
      .stdout();
  }

  @func()
  async buildCheck(
    source: Directory,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return this.base(
      source,
      nextPublicConvexUrl,
      nextPublicClerkPublishableKey,
      clerkSecretKey,
      clerkJwtIssuerDomain,
      playwrightClerkTestEmail,
      requireSecret('GUEST_TOKEN_SECRET', guestTokenSecret, 'build-check'),
      canaryEndpoint,
      canaryApiKey,
      nextPublicCanaryEndpoint,
      nextPublicCanaryApiKey
    )
      .withExec(['pnpm', 'build:check'])
      .stdout();
  }

  @func()
  async audit(source: Directory): Promise<string> {
    // Replaces `pnpm audit --audit-level=high`: npm retired the legacy audit
    // endpoint pnpm still calls (HTTP 410). osv-scanner reads pnpm-lock.yaml
    // directly against OSV.dev. We filter to HIGH/CRITICAL to preserve the
    // prior gate semantics.
    const script = [
      '/osv-scanner scan source --lockfile=pnpm-lock.yaml --format=json --output=/tmp/osv.json || true',
      '/osv-scanner scan source --lockfile=pnpm-lock.yaml --format=table || true',
      'if grep -qE \'"severity":[[:space:]]*"(HIGH|CRITICAL)"\' /tmp/osv.json; then',
      '  echo "Found HIGH or CRITICAL advisories — failing build."',
      '  exit 1',
      'fi',
      'echo "osv-scanner: no HIGH or CRITICAL advisories (MODERATE/LOW ignored to match prior pnpm audit --audit-level=high)"',
    ].join('\n');
    return dag
      .container()
      .from('ghcr.io/google/osv-scanner:v2.0.2')
      .withMountedDirectory('/src', source)
      .withWorkdir('/src')
      .withExec(['sh', '-c', script])
      .stdout();
  }

  @func()
  async secretScan(source: Directory): Promise<string> {
    return dag
      .container()
      .from('ghcr.io/gitleaks/gitleaks:v8.21.2')
      .withMountedDirectory('/src', source)
      .withWorkdir('/src')
      .withExec([
        'gitleaks',
        'dir',
        '.',
        '--config',
        '.gitleaks.toml',
        '--redact',
        '--no-banner',
      ])
      .stdout();
  }

  @func()
  async e2e(
    source: Directory,
    playwrightRequireAuthE2e?: string,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return withOptionalEnv(
      baseContainer(
        source,
        {
          nextPublicConvexUrl,
          nextPublicClerkPublishableKey,
          clerkSecretKey,
          clerkJwtIssuerDomain,
          playwrightClerkTestEmail,
          guestTokenSecret: requireSecret(
            'GUEST_TOKEN_SECRET',
            guestTokenSecret,
            'e2e'
          ),
          canaryEndpoint,
          canaryApiKey,
          nextPublicCanaryEndpoint,
          nextPublicCanaryApiKey,
        },
        NODE_IMAGE,
        'linejam-pnpm-playwright'
      ),
      'PLAYWRIGHT_REQUIRE_AUTH_E2E',
      playwrightRequireAuthE2e
    )
      .withExec([
        'pnpm',
        'exec',
        'playwright',
        'install',
        '--with-deps',
        'chromium',
      ])
      .withExec([
        'sh',
        '-c',
        [
          'set -eu',
          'log=/tmp/linejam-e2e.log',
          'if pnpm build:check >"$log" 2>&1 && pnpm test:e2e >>"$log" 2>&1; then',
          "  printf 'e2e: ok\\n'",
          'else',
          '  status=$?',
          '  tail -n 200 "$log"',
          '  exit "$status"',
          'fi',
        ].join('\n'),
      ])
      .stdout();
  }

  @func()
  async smoke(
    source: Directory,
    baseUrl: string,
    playwrightRequireAuthSmoke?: string,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return withOptionalEnv(
      withOptionalEnv(
        baseContainer(
          source,
          {
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey,
          },
          PLAYWRIGHT_IMAGE,
          'linejam-pnpm-playwright'
        ),
        'PLAYWRIGHT_BASE_URL',
        baseUrl
      ),
      'PLAYWRIGHT_REQUIRE_AUTH_SMOKE',
      playwrightRequireAuthSmoke
    )
      .withExec(['pnpm', 'test:e2e:smoke'])
      .stdout();
  }

  @func()
  async agenticQa(
    source: Directory,
    baseUrl: string,
    mission = 'guest-host-signed-in-join',
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string,
    stagehandModel?: string,
    stagehandModelApiKey?: Secret
  ): Promise<string> {
    return baseContainer(
      source,
      {
        nextPublicConvexUrl,
        nextPublicClerkPublishableKey,
        clerkSecretKey,
        clerkJwtIssuerDomain,
        playwrightClerkTestEmail,
        guestTokenSecret,
        canaryEndpoint,
        canaryApiKey,
        nextPublicCanaryEndpoint,
        nextPublicCanaryApiKey,
        stagehandModel,
        stagehandModelApiKey,
      },
      PLAYWRIGHT_IMAGE,
      'linejam-pnpm-playwright'
    )
      .withExec([
        'pnpm',
        'qa:agentic:preview',
        '--mission',
        mission,
        '--base-url',
        baseUrl,
      ])
      .stdout();
  }

  @func()
  async allNoE2e(
    source: Directory,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return runChecks([
      [
        'format-check',
        () =>
          this.formatCheck(
            source,
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey
          ),
      ],
      [
        'lint',
        () =>
          this.lint(
            source,
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey
          ),
      ],
      [
        'typecheck',
        () =>
          this.typecheck(
            source,
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey
          ),
      ],
      ['secret-scan', () => this.secretScan(source)],
      ['audit', () => this.audit(source)],
      [
        'unit-test',
        () =>
          this.unitTest(
            source,
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey
          ),
      ],
      [
        'build-check',
        () =>
          this.buildCheck(
            source,
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey
          ),
      ],
    ]);
  }

  @func()
  async all(
    source: Directory,
    playwrightRequireAuthE2e?: string,
    nextPublicConvexUrl?: string,
    nextPublicClerkPublishableKey?: string,
    clerkSecretKey?: Secret,
    clerkJwtIssuerDomain?: string,
    playwrightClerkTestEmail?: string,
    guestTokenSecret?: Secret,
    canaryEndpoint?: string,
    canaryApiKey?: Secret,
    nextPublicCanaryEndpoint?: string,
    nextPublicCanaryApiKey?: string
  ): Promise<string> {
    return runChecks([
      [
        'all-no-e2e',
        () =>
          this.allNoE2e(
            source,
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey
          ),
      ],
      [
        'e2e',
        () =>
          this.e2e(
            source,
            playwrightRequireAuthE2e,
            nextPublicConvexUrl,
            nextPublicClerkPublishableKey,
            clerkSecretKey,
            clerkJwtIssuerDomain,
            playwrightClerkTestEmail,
            guestTokenSecret,
            canaryEndpoint,
            canaryApiKey,
            nextPublicCanaryEndpoint,
            nextPublicCanaryApiKey
          ),
      ],
    ]);
  }
}
