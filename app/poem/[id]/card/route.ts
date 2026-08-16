import { createCardRouteHandlers } from './handler';

export const runtime = 'edge';

export const { GET, POST } = createCardRouteHandlers();
