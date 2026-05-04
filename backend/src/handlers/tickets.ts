import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { v4 as uuid } from 'uuid';
import { draftTicket, groomBacklog } from '../lib/bedrock';
import {
  deleteTicket,
  getSettings,
  getTicket,
  listTickets,
  putTicket,
  updateTicket,
} from '../lib/repo';
import {
  badRequest,
  created,
  noContent,
  notFound,
  ok,
  parseBody,
  pathParam,
  preflight,
  queryParam,
  serverError,
} from '../lib/http';
import type { Ticket } from '../types';

const TIMEOUT_MS = 9500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const e = event as APIGatewayProxyEventV2;
  const method = e.requestContext.http.method;
  const route = e.routeKey ?? `${method} ${e.rawPath}`;

  if (method === 'OPTIONS') return preflight();

  try {
    if (route === 'GET /api/tickets') return await listHandler(e);
    if (route === 'POST /api/tickets') return await createHandler(e);
    if (route === 'PUT /api/tickets/{ticketId}') return await updateHandler(e);
    if (route === 'DELETE /api/tickets/{ticketId}') return await deleteHandler(e);
    if (route === 'POST /api/tickets/groom') return await groomHandler();
    if (route === 'POST /api/tickets/merge') return await mergeHandler(e);
    return notFound(`Route ${route} not implemented`);
  } catch (err) {
    console.error('tickets handler error', err);
    return serverError((err as Error).message);
  }
};

async function listHandler(e: APIGatewayProxyEventV2) {
  const status = queryParam(e, 'status');
  const tickets = await listTickets(status);
  return ok(tickets);
}

async function createHandler(e: APIGatewayProxyEventV2) {
  const body = parseBody<{ input?: string }>(e);
  const input = body.input?.trim();
  if (!input) return badRequest('input is required');

  const [backlog, settings] = await Promise.all([listTickets(), getSettings()]);
  const now = new Date().toISOString();
  const ticketId = uuid();

  let drafted: Awaited<ReturnType<typeof draftTicket>> | null = null;
  let aiFailed = false;

  try {
    drafted = await withTimeout(
      draftTicket({
        input,
        backlog: backlog.map((b) => ({
          ticketId: b.ticketId,
          title: b.title,
          priority: b.priority,
        })),
        team: settings.teamMembers,
        labels: settings.labels.map((l) => l.name),
      }),
      TIMEOUT_MS,
    );
  } catch (err) {
    console.warn('Bedrock drafting failed', err);
    aiFailed = true;
  }

  const ticket: Ticket = {
    ticketId,
    title: drafted?.title ?? input.slice(0, 80),
    description: drafted?.description ?? input,
    priority: drafted?.priority ?? 'medium',
    labels: drafted?.labels ?? [],
    assignee: drafted?.suggested_assignee ?? null,
    type: drafted?.type ?? 'task',
    status: 'backlog',
    sprintId: null,
    created_at: now,
    updated_at: now,
    sort_order: Date.now(),
    ai_failed: aiFailed || undefined,
  };

  await putTicket(ticket);
  return created(ticket);
}

async function updateHandler(e: APIGatewayProxyEventV2) {
  const id = pathParam(e, 'ticketId');
  if (!id) return badRequest('ticketId is required');
  const patch = parseBody<Partial<Ticket>>(e);
  const updated = await updateTicket(id, patch);
  return ok(updated);
}

async function deleteHandler(e: APIGatewayProxyEventV2) {
  const id = pathParam(e, 'ticketId');
  if (!id) return badRequest('ticketId is required');
  await deleteTicket(id);
  return noContent();
}

async function groomHandler() {
  const tickets = await listTickets('backlog');
  if (tickets.length < 3) return badRequest('Need at least 3 backlog tickets');
  try {
    const result = await withTimeout(
      groomBacklog(
        tickets.map((t) => ({
          ticketId: t.ticketId,
          title: t.title,
          description: t.description,
          priority: t.priority,
          labels: t.labels,
          type: t.type,
        })),
      ),
      15000,
    );
    return ok(result);
  } catch (err) {
    console.error('groom failed', err);
    return serverError('Grooming failed');
  }
}

async function mergeHandler(e: APIGatewayProxyEventV2) {
  const body = parseBody<{ keepId?: string; deleteId?: string }>(e);
  if (!body.keepId || !body.deleteId) return badRequest('keepId and deleteId required');
  const [keep, drop] = await Promise.all([getTicket(body.keepId), getTicket(body.deleteId)]);
  if (!keep || !drop) return notFound('ticket not found');
  const merged = await updateTicket(keep.ticketId, {
    description: `${keep.description}\n\n---\n\n_Merged from ${drop.title}_\n\n${drop.description}`.slice(0, 1000),
    labels: Array.from(new Set([...keep.labels, ...drop.labels])).slice(0, 6),
  });
  await deleteTicket(drop.ticketId);
  return ok(merged);
}
