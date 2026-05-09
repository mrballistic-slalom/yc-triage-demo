import type { APIGatewayProxyEventV2 } from 'aws-lambda';
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
  createRouter,
  noContent,
  notFound,
  ok,
  parseBody,
  pathParam,
} from '../lib/http';
import type { Sprint } from '../types';

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

export const handler = createRouter('sprints', {
  'GET /api/sprints': async () => ok(await listSprints()),
  'POST /api/sprints': createHandler,
  'PUT /api/sprints/{sprintId}': updateHandler,
  'POST /api/sprints/{sprintId}/complete': completeHandler,
});
