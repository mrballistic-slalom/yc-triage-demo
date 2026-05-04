import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getSettings, putSettings } from '../lib/repo';
import { notFound, ok, parseBody, preflight, serverError } from '../lib/http';
import type { Settings } from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const e = event as APIGatewayProxyEventV2;
  const method = e.requestContext.http.method;
  const route = e.routeKey ?? `${method} ${e.rawPath}`;

  if (method === 'OPTIONS') return preflight();

  try {
    if (route === 'GET /api/settings') return ok(await getSettings());
    if (route === 'PUT /api/settings') {
      const current = await getSettings();
      const patch = parseBody<Partial<Settings>>(e);
      const next: Settings = {
        projectName: patch.projectName ?? current.projectName,
        teamMembers: patch.teamMembers ?? current.teamMembers,
        labels: patch.labels ?? current.labels,
      };
      const saved = await putSettings(next);
      return ok(saved);
    }
    return notFound(`Route ${route} not implemented`);
  } catch (err) {
    console.error('settings handler error', err);
    return serverError((err as Error).message);
  }
};
