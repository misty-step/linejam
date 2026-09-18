export interface DevelopmentDiagnosticTarget {
  url: string;
  deploymentEnvironment?: string;
  localFlag?: string;
  publicLocalFlag?: string;
}

/** An environment flag cannot make a hosted target a local development server. */
export function allowsLocalDevelopmentDiagnostics({
  url,
  deploymentEnvironment,
  localFlag,
  publicLocalFlag,
}: DevelopmentDiagnosticTarget): boolean {
  if (
    deploymentEnvironment !== 'development' ||
    localFlag !== '1' ||
    publicLocalFlag !== '1'
  )
    return false;
  const target = new URL(url);
  return (
    (target.protocol === 'http:' || target.protocol === 'https:') &&
    !target.username &&
    !target.password &&
    ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  );
}
