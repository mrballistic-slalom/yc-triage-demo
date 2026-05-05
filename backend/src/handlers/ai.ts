import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  answerQuestion,
  generateDigest,
  assessSprintRisk,
  applyConversationalEdit,
} from '../lib/ai';
import {
  getSettings,
  getTicket,
  listSprints,
  listTickets,
  updateTicket,
} from '../lib/repo';
import {
  badRequest,
  notFound,
  ok,
  parseBody,
  pathParam,
  preflight,
  serverError,
} from '../lib/http';

async function loadContext() {
  const [tickets, sprints, settings] = await Promise.all([
    listTickets(),
    listSprints(),
    getSettings(),
  ]);
  const sprint = sprints.find((s) => s.status === 'active') ?? null;
  return { tickets, sprint, settings };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const e = event as APIGatewayProxyEventV2;
  const method = e.requestContext.http.method;
  const route = e.routeKey ?? `${method} ${e.rawPath}`;

  if (method === 'OPTIONS') return preflight();

  try {
    if (route === 'POST /api/ai/ask') return await askHandler(e);
    if (route === 'POST /api/ai/digest') return await digestHandler();
    if (route === 'POST /api/ai/risk') return await riskHandler();
    if (route === 'POST /api/tickets/{ticketId}/ai-edit') return await editHandler(e);
    return notFound(`Route ${route} not implemented`);
  } catch (err) {
    console.error('ai handler error', err);
    return serverError((err as Error).message);
  }
};

async function askHandler(e: APIGatewayProxyEventV2) {
  const body = parseBody<{ question?: string }>(e);
  if (!body.question?.trim()) return badRequest('question is required');
  const ctx = await loadContext();
  const answer = await answerQuestion(body.question.trim(), ctx);
  return ok({ answer });
}

async function digestHandler() {
  const ctx = await loadContext();
  if (ctx.tickets.length === 0) return ok({ digest: 'A clean slate — no tickets yet.' });
  const digest = await generateDigest(ctx);
  return ok({ digest });
}

async function riskHandler() {
  const ctx = await loadContext();
  const risk = await assessSprintRisk(ctx);
  return ok(risk);
}

async function editHandler(e: APIGatewayProxyEventV2) {
  const id = pathParam(e, 'ticketId');
  if (!id) return badRequest('ticketId is required');
  const body = parseBody<{ instruction?: string }>(e);
  if (!body.instruction?.trim()) return badRequest('instruction is required');
  const ticket = await getTicket(id);
  if (!ticket) return notFound('ticket not found');
  const ctx = await loadContext();
  const patch = await applyConversationalEdit(ticket, body.instruction.trim(), ctx);
  if (Object.keys(patch).length === 0) {
    return ok({ ticket, patch });
  }
  const updated = await updateTicket(id, patch);
  return ok({ ticket: updated, patch });
}
