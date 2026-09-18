import { resolveDeploymentId } from '@/lib/deploymentId';
import { APP_VERSION } from '@/lib/appVersion';

export async function GET() {
  return Response.json(
    {
      version: APP_VERSION,
      deployment: {
        id: resolveDeploymentId(process.env.NEXT_DEPLOYMENT_ID) ?? null,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
