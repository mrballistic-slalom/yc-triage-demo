import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  answerQuestion,
  applyConversationalEdit,
  assessSprintRisk,
  generateDigest,
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
  createRouter,
  notFound,
  ok,
  parseBody,
  pathParam,
} from '../lib/http';
import { MAX_INSTRUCTION, MAX_QUESTION } from '../types';

async function loadContext() {
  const [tickets, sprints, settings] = await Promise.all([
    listTickets(),
    listSprints(),
    getSettings(),
  ]);
  const sprint = sprints.find((s) => s.status === 'active') ?? null;
  return { tickets, sprint, settings };
}

async function askHandler(e: APIGatewayProxyEventV2) {
  const body = parseBody<{ question?: string }>(e);
  const question = body.question?.trim();
  if (!question) return badRequest('question is required');
  if (question.length > MAX_QUESTION) return badRequest(`question must be ≤ ${MAX_QUESTION} characters`);
  const ctx = await loadContext();
  const answer = await answerQuestion(question, ctx);
  return ok({ answer });
}

async function digestHandler() {
  const ctx = await loadContext();
  if (ctx.tickets.length === 0) return ok({ digest: 'A clean slate — no tickets yet.' });
  const digest = await generateDigest(ctx);
  return ok({ digest });
}

async function riskHandler() {
  return ok(await assessSprintRisk(await loadContext()));
}

async function editHandler(e: APIGatewayProxyEventV2) {
  const id = pathParam(e, 'ticketId');
  if (!id) return badRequest('ticketId is required');
  const body = parseBody<{ instruction?: string }>(e);
  const instruction = body.instruction?.trim();
  if (!instruction) return badRequest('instruction is required');
  if (instruction.length > MAX_INSTRUCTION) return badRequest(`instruction must be ≤ ${MAX_INSTRUCTION} characters`);
  const ticket = await getTicket(id);
  if (!ticket) return notFound('ticket not found');
  const ctx = await loadContext();
  const patch = await applyConversationalEdit(ticket, instruction, ctx);
  if (Object.keys(patch).length === 0) return ok({ ticket, patch });
  const updated = await updateTicket(id, patch);
  return ok({ ticket: updated, patch });
}

export const handler = createRouter('ai', {
  'POST /api/ai/ask': askHandler,
  'POST /api/ai/digest': digestHandler,
  'POST /api/ai/risk': riskHandler,
  'POST /api/tickets/{ticketId}/ai-edit': editHandler,
});
