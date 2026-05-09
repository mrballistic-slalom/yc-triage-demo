import { extractJson, invokeBedrock, TYPOGRAPHY_RULE } from './bedrock';
import {
  MAX_DESCRIPTION,
  MAX_LABELS,
  MAX_TITLE,
  VALID_PRIORITIES,
  VALID_STATUSES,
  VALID_TYPES,
  type Settings,
  type Sprint,
  type Ticket,
} from '../types';

interface ProjectContext {
  tickets: Ticket[];
  sprint: Sprint | null;
  settings: Settings;
}

function summarizeContext(ctx: ProjectContext): string {
  const ticketLines = ctx.tickets
    .slice(0, 60)
    .map((t) => {
      const sprintTag = ctx.sprint && t.sprintId === ctx.sprint.sprintId ? ' [in-sprint]' : '';
      return `- ${t.ticketId.slice(0, 6)} [${t.status}/${t.priority}/${t.type}]${sprintTag} ${t.title} :: assignee=${t.assignee ?? '∅'} :: labels=${t.labels.join(',') || '∅'}`;
    })
    .join('\n');

  const sprintLine = ctx.sprint
    ? `Active sprint: "${ctx.sprint.name}" — ${ctx.sprint.duration} week(s), ${new Date(ctx.sprint.start_date).toISOString().slice(0, 10)} → ${new Date(ctx.sprint.end_date).toISOString().slice(0, 10)}, ${ctx.sprint.ticketIds.length} tickets`
    : 'No active sprint.';

  const teamLine =
    ctx.settings.teamMembers.length === 0
      ? 'Team: (none yet)'
      : `Team: ${ctx.settings.teamMembers.map((m) => `${m.name} (${m.role})`).join('; ')}`;

  return `${sprintLine}\n${teamLine}\n\nTickets:\n${ticketLines}`;
}

export async function answerQuestion(question: string, ctx: ProjectContext): Promise<string> {
  const system = [
    'You are Triage, an AI project tracker. Answer questions about the project state in a calm, editorial voice.',
    'Keep answers tight: one or two short paragraphs OR a markdown bullet list, never both. Never include preamble like "Based on the data…". Open with the substance.',
    'When you reference tickets, cite them by short id in parentheses like (a1b2c3) — six lower-case characters. Do not invent ids.',
    'Markdown is allowed: bold, italic, lists, inline code. Do not use headings (# / ##) — keep it inline.',
    TYPOGRAPHY_RULE,
  ].join(' ');
  const prompt = `Project state:\n${summarizeContext(ctx)}\n\nQuestion: ${question}\n\nAnswer:`;
  return invokeBedrock(system, prompt, { maxTokens: 600, temperature: 0.3 });
}

export async function generateDigest(ctx: ProjectContext): Promise<string> {
  const system = [
    'You are Triage. Produce a one-line standup-style digest that captures the project pulse right now.',
    'Output exactly one sentence under 200 characters. No preamble, no markdown, no lists. Editorial tone.',
    'Reference concrete numbers from the data (counts, priorities) and call out anything notable (critical without owner, sprint nearly over, mass of bugs).',
    TYPOGRAPHY_RULE,
  ].join(' ');
  const prompt = `Project state:\n${summarizeContext(ctx)}\n\nWrite the digest now:`;
  const raw = await invokeBedrock(system, prompt, { maxTokens: 200, temperature: 0.3 });
  return raw.replace(/^[*•\-\s]+/, '').trim().slice(0, 240);
}

export interface SprintRisk {
  level: 'low' | 'medium' | 'high';
  summary: string;
  unavailable?: boolean;
}

export async function assessSprintRisk(ctx: ProjectContext): Promise<SprintRisk> {
  if (!ctx.sprint) return { level: 'low', summary: 'No active sprint.' };
  const system = [
    'You are Triage. Assess the risk of the active sprint completing successfully.',
    'Respond with a single JSON object: {"level": "low"|"medium"|"high", "summary": string}.',
    'The summary must be one short clause under 120 characters explaining the dominant risk factor (or "on track" if low). No leading verbs like "the sprint" — start mid-sentence, terse.',
    TYPOGRAPHY_RULE,
  ].join(' ');
  const sprintTickets = ctx.tickets.filter((t) => t.sprintId === ctx.sprint?.sprintId);
  const lines = sprintTickets
    .map(
      (t) =>
        `- ${t.ticketId.slice(0, 6)} [${t.status}/${t.priority}] ${t.title} :: assignee=${t.assignee ?? '∅'}`,
    )
    .join('\n');
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(ctx.sprint.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const prompt = `Sprint "${ctx.sprint.name}" · ${daysLeft} day(s) left · ${sprintTickets.length} tickets:\n${lines}\n\nRespond with JSON now.`;

  const raw = await invokeBedrock(system, prompt, { maxTokens: 200, temperature: 0.3 });
  try {
    const parsed = extractJson(raw) as { level?: string; summary?: string };
    const level: SprintRisk['level'] =
      parsed.level === 'high' || parsed.level === 'medium' ? parsed.level : 'low';
    const summary = String(parsed.summary ?? 'on track').slice(0, 160);
    return { level, summary };
  } catch (err) {
    console.warn('assessSprintRisk: parse failed', err);
    return { level: 'medium', summary: 'risk assessment unavailable', unavailable: true };
  }
}

export async function applyConversationalEdit(
  ticket: Ticket,
  instruction: string,
  ctx: ProjectContext,
): Promise<Partial<Ticket>> {
  const system = [
    'You are Triage. Translate a human instruction into a JSON patch for a single ticket.',
    'Respond with one JSON object whose keys are a subset of: title, description, priority, labels, assignee, type, status.',
    'Allowed values — priority: critical|high|medium|low. type: bug|feature|task|chore. status: backlog|in_progress|in_review|done. labels: array of strings. assignee: must match an existing team-member name exactly, or null to unassign.',
    'Only include keys the user actually asked to change. Never invent label or assignee values.',
    TYPOGRAPHY_RULE,
  ].join(' ');

  const teamNames = ctx.settings.teamMembers.map((m) => m.name);
  const labelNames = ctx.settings.labels.map((l) => l.name);
  const prompt = `Existing ticket:\n${JSON.stringify(
    {
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      labels: ticket.labels,
      assignee: ticket.assignee,
      type: ticket.type,
      status: ticket.status,
    },
    null,
    2,
  )}\n\nTeam: ${teamNames.join(', ') || '(none)'}\nExisting labels: ${labelNames.join(', ') || '(none)'}\n\nInstruction: ${instruction}\n\nRespond with the patch JSON now.`;

  const raw = await invokeBedrock(system, prompt, { maxTokens: 400, temperature: 0.3 });
  const parsed = extractJson(raw) as Record<string, unknown>;
  const patch: Partial<Ticket> = {};

  if (typeof parsed.title === 'string') patch.title = parsed.title.slice(0, MAX_TITLE);
  if (typeof parsed.description === 'string') patch.description = parsed.description.slice(0, MAX_DESCRIPTION);
  if (typeof parsed.priority === 'string' && (VALID_PRIORITIES as readonly string[]).includes(parsed.priority)) {
    patch.priority = parsed.priority as Ticket['priority'];
  }
  if (typeof parsed.type === 'string' && (VALID_TYPES as readonly string[]).includes(parsed.type)) {
    patch.type = parsed.type as Ticket['type'];
  }
  if (typeof parsed.status === 'string' && (VALID_STATUSES as readonly string[]).includes(parsed.status)) {
    patch.status = parsed.status as Ticket['status'];
  }
  if (Array.isArray(parsed.labels)) {
    patch.labels = parsed.labels.map(String).slice(0, MAX_LABELS);
  }
  if (parsed.assignee === null) {
    patch.assignee = null;
  } else if (typeof parsed.assignee === 'string' && teamNames.includes(parsed.assignee)) {
    patch.assignee = parsed.assignee;
  }
  return patch;
}
