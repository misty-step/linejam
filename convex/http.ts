import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { getConvexEnvHealthReport } from './lib/env';

const http = httpRouter();

http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpAction(async () => {
    const report = getConvexEnvHealthReport();

    return Response.json(report, {
      status: report.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }),
});

export default http;
