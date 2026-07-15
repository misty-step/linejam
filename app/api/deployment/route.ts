import { resolveDeploymentId } from '@/lib/deploymentId';

export async function GET() {
  return Response.json(
    {
      deployment: {
        id: resolveDeploymentId(process.env.NEXT_DEPLOYMENT_ID) ?? null,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
