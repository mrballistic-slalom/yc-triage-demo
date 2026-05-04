import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { v4 as uuid } from 'uuid';
import {
  getSprint,
  listSprints,
  listTickets,
  putSprint,
  updateTicket,
} from '../lib/repo';
import {
  badRequest,
  noContent,
  notFound,
  ok,
  parseBody,
  pathParam,
  preflight,
  serverError,
} from '../lib/http';
import type { Sprint } from '../types';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const e = event as APIGatewayProxyEventV2;
  const method = e.requestContext.http.method;
  const route = e.routeKey ?? `${method} ${e.rawPath}`;

  if (method === 'OPTIONS') return preflight();

  try {
    if (route === 'GET /api/sprints') return ok(await listSprints());
    if (route === 'POST /api/sprints') return await createHandler(e);
    if (route === 'PUT /api/sprints/{sprintId}') return await updateHandler(e);
    if (route === 'POST /api/sprints/{sprintId}/complete') return await completeHandler(e);
    return notFound(`Route ${route} not implemented`);
  } catch (err) {
    console.error('sprints handler error', err);
    return serverError((err as Error).message);
  }
};

async function createHandler(e: APIGatewayProxyEventV2) {
  const body = parseBody<{ name?: string; duration?: number }>(e);
  if (!body.name?.trim()) return badRequest('name is required');
  const duration = body.duration === 1 ? 1 : 2;

  const existing = await listSprints();
  if (existing.some((s) => s.status === 'active')) {
    return badRequest('Complete the current sprint first');
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + duration * 7);

  const sprint: Sprint = {
    sprintId: uuid(),
    name: body.name.trim().slice(0, 40),
    duration,
    start_date: now.toISOString(),
    end_date: end.toISOString(),
    status: 'active',
    created_at: now.toISOString(),
    ticketIds: [],
  };
  await putSprint(sprint);
  return ok(sprint);
}

async function updateHandler(e: APIGatewayProxyEventV2) {
  const id = pathParam(e, 'sprintId');
  if (!id) return badRequest('sprintId is required');
  const sprint = await getSprint(id);
  if (!sprint) return notFound('sprint not found');
  const patch = parseBody<Partial<Sprint>>(e);
  const next: Sprint = {
    ...sprint,
    ...patch,
    sprintId: sprint.sprintId,
    created_at: sprint.created_at,
  };
  await putSprint(next);
  return ok(next);
}

async function completeHandler(e: APIGatewayProxyEventV2) {
  const id = pathParam(e, 'sprintId');
  if (!id) return badRequest('sprintId is required');
  const sprint = await getSprint(id);
  if (!sprint) return notFound('sprint not found');

  const tickets = await listTickets();
  await Promise.all(
    tickets
      .filter((t) => t.sprintId === id && t.status !== 'done')
      .map((t) => updateTicket(t.ticketId, { status: 'backlog', sprintId: null })),
  );
  await putSprint({ ...sprint, status: 'completed' });
  return noContent();
}
