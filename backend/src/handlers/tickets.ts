import type { APIGatewayProxyEventV2 } from 'aws-lambda';
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
  createRouter,
  noContent,
  notFound,
  ok,
  parseBody,
  pathParam,
  queryParam,
  serverError,
} from '../lib/http';
import {
  MAX_DESCRIPTION,
  MAX_LABELS,
  MAX_LABEL_LEN,
  MAX_NAME_LEN,
  MAX_TITLE,
  MAX_USER_INPUT,
  VALID_PRIORITIES,
  VALID_STATUSES,
  VALID_TYPES,
  type Ticket,
} from '../types';

const TIMEOUT_MS = 9500;

async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, ms);
  });
  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function validateTicketPatch(patch: Record<string, unknown>): Partial<Ticket> {
  const out: Partial<Ticket> = {};
  if (typeof patch.title === 'string') out.title = patch.title.slice(0, MAX_TITLE);
  if (typeof patch.description === 'string') out.description = patch.description.slice(0, MAX_DESCRIPTION);
  if (typeof patch.priority === 'string' && (VALID_PRIORITIES as readonly string[]).includes(patch.priority)) {
    out.priority = patch.priority as Ticket['priority'];
  }
  if (typeof patch.type === 'string' && (VALID_TYPES as readonly string[]).includes(patch.type)) {
    out.type = patch.type as Ticket['type'];
  }
  if (typeof patch.status === 'string' && (VALID_STATUSES as readonly string[]).includes(patch.status)) {
    out.status = patch.status as Ticket['status'];
  }
  if (Array.isArray(patch.labels)) {
    out.labels = patch.labels
      .filter((l): l is string => typeof l === 'string')
      .map((l) => l.slice(0, MAX_LABEL_LEN))
      .slice(0, MAX_LABELS);
  }
  if (patch.assignee === null) out.assignee = null;
  else if (typeof patch.assignee === 'string') out.assignee = patch.assignee.slice(0, MAX_NAME_LEN);
  if (patch.sprintId === null) out.sprintId = null;
  else if (typeof patch.sprintId === 'string') out.sprintId = patch.sprintId;
  if (typeof patch.sort_order === 'number' && Number.isFinite(patch.sort_order)) {
    out.sort_order = patch.sort_order;
  }
  if (typeof patch.ai_failed === 'boolean') out.ai_failed = patch.ai_failed;
  return out;
}

async function listHandler(e: APIGatewayProxyEventV2) {
  return ok(await listTickets(queryParam(e, 'status')));
}

async function createHandler(e: APIGatewayProxyEventV2) {
  const body = parseBody<{ input?: string }>(e);
  const input = body.input?.trim();
  if (!input) return badRequest('input is required');
  if (input.length > MAX_USER_INPUT) return badRequest(`input must be ≤ ${MAX_USER_INPUT} characters`);

  const [backlog, settings] = await Promise.all([listTickets(), getSettings()]);
  const now = new Date().toISOString();

  let drafted: Awaited<ReturnType<typeof draftTicket>> | null = null;
  let aiFailed = false;

  try {
    drafted = await withTimeout(
      (signal) =>
        draftTicket({
          input,
          backlog: backlog.map((b) => ({
            ticketId: b.ticketId,
            title: b.title,
            priority: b.priority,
          })),
          team: settings.teamMembers,
          labels: settings.labels.map((l) => l.name),
          abortSignal: signal,
        }),
      TIMEOUT_MS,
    );
  } catch (err) {
    console.warn('Bedrock drafting failed', err);
    aiFailed = true;
  }

  const ticket: Ticket = {
    ticketId: uuid(),
    title: drafted?.title ?? input.slice(0, MAX_TITLE),
    description: drafted?.description ?? input.slice(0, MAX_DESCRIPTION),
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
  const raw = parseBody<Record<string, unknown>>(e);
  const patch = validateTicketPatch(raw);
  return ok(await updateTicket(id, patch));
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
      (signal) =>
        groomBacklog(
          tickets.map((t) => ({
            ticketId: t.ticketId,
            title: t.title,
            description: t.description,
            priority: t.priority,
            labels: t.labels,
            type: t.type,
          })),
          { abortSignal: signal },
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
    description: `${keep.description}\n\n---\n\n_Merged from ${drop.title}_\n\n${drop.description}`.slice(0, MAX_DESCRIPTION),
    labels: Array.from(new Set([...keep.labels, ...drop.labels])).slice(0, MAX_LABELS),
  });
  await deleteTicket(drop.ticketId);
  return ok(merged);
}

export const handler = createRouter('tickets', {
  'GET /api/tickets': listHandler,
  'POST /api/tickets': createHandler,
  'PUT /api/tickets/{ticketId}': updateHandler,
  'DELETE /api/tickets/{ticketId}': deleteHandler,
  'POST /api/tickets/groom': groomHandler,
  'POST /api/tickets/merge': mergeHandler,
});
