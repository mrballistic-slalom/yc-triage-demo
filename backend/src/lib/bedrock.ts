import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import {
  VALID_PRIORITIES,
  VALID_TYPES,
  type AIDraftedTicket,
  type GroomResult,
  type Priority,
  type TicketType,
} from '../types';

const region = process.env.AWS_REGION ?? 'us-west-2';
const inferenceProfile = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

const client = new BedrockRuntimeClient({ region });

interface BedrockResponse {
  content: { type: 'text'; text: string }[];
  stop_reason: string;
}

export const TYPOGRAPHY_RULE =
  'TYPOGRAPHY: in every user-visible string, use proper smart punctuation: curly apostrophes (’), curly quotes (“ ”), em dashes (—), en dashes (–), ellipses (…). Never use straight foot-marks ("), straight apostrophes (\'), or double-hyphens (--).';

export async function invokeBedrock(
  system: string,
  prompt: string,
  options: { maxTokens?: number; temperature?: number; abortSignal?: AbortSignal } = {},
): Promise<string> {
  const body = {
    anthropic_version: 'bedrock-2023-05-31' as const,
    max_tokens: options.maxTokens ?? 1500,
    system,
    temperature: options.temperature ?? 0.2,
    messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: prompt }] }],
  };

  const cmd = new InvokeModelCommand({
    modelId: inferenceProfile,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(JSON.stringify(body)),
  });

  const result = await client.send(cmd, { abortSignal: options.abortSignal });
  const parsed = JSON.parse(new TextDecoder().decode(result.body)) as BedrockResponse;
  return parsed.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const objStart = candidate.indexOf('{');
  const arrStart = candidate.indexOf('[');
  const starts = [objStart, arrStart].filter((i) => i !== -1);
  if (starts.length === 0) throw new Error('No JSON in response');
  const first = Math.min(...starts);
  const opener = candidate[first];
  const closer = opener === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = first; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(first, i + 1));
    }
  }
  throw new Error('Unterminated JSON in response');
}

interface BacklogContextEntry {
  ticketId: string;
  title: string;
  priority: Priority;
}

export async function draftTicket(args: {
  input: string;
  backlog: BacklogContextEntry[];
  team: { name: string; role: string }[];
  labels: string[];
  abortSignal?: AbortSignal;
}): Promise<AIDraftedTicket> {
  const system = [
    'You are Triage, a project tracker that turns natural-language descriptions of work into structured tickets.',
    'You always respond with a single valid JSON object. No prose, no markdown fences.',
    'Match labels to existing labels when possible. Choose priorities calibrated against the existing backlog.',
    'TYPOGRAPHY: in every user-visible string (title and description), use proper smart punctuation: curly apostrophes (’) and quotes (“ ”), em dashes (—), en dashes for ranges (–), and ellipses (…). Never use straight foot-marks ("), straight apostrophes (\'), or double-hyphens (--).',
  ].join(' ');

  const backlogSummary =
    args.backlog.length === 0
      ? '(empty backlog)'
      : args.backlog
          .slice(0, 30)
          .map((b) => `- [${b.priority}] ${b.title}`)
          .join('\n');

  const teamSummary =
    args.team.length === 0
      ? '(no team members yet)'
      : args.team.map((m) => `- ${m.name} (${m.role})`).join('\n');

  const labelSummary = args.labels.length === 0 ? '(none)' : args.labels.join(', ');

  const prompt = `Existing backlog (for priority calibration & dedup awareness):\n${backlogSummary}\n\nTeam members:\n${teamSummary}\n\nExisting labels: ${labelSummary}\n\nUser input: """${args.input}"""\n\nRespond with JSON of shape: {"title": string (≤80 chars), "description": string (markdown, ≤500 chars), "priority": "critical"|"high"|"medium"|"low", "labels": string[] (≤3, prefer existing), "suggested_assignee": string|null (must match team member name), "type": "bug"|"feature"|"task"|"chore"}`;

  const raw = await invokeBedrock(system, prompt, { maxTokens: 1024, abortSignal: args.abortSignal });
  const parsed = extractJson(raw) as Record<string, unknown>;

  const priority = (VALID_PRIORITIES as readonly string[]).includes(String(parsed.priority))
    ? (parsed.priority as Priority)
    : 'medium';
  const type = (VALID_TYPES as readonly string[]).includes(String(parsed.type))
    ? (parsed.type as TicketType)
    : 'task';
  const labels = Array.isArray(parsed.labels) ? parsed.labels.map(String).slice(0, 3) : [];
  const teamNames = new Set(args.team.map((m) => m.name));
  const assignee =
    typeof parsed.suggested_assignee === 'string' && teamNames.has(parsed.suggested_assignee)
      ? parsed.suggested_assignee
      : null;

  return {
    title: String(parsed.title ?? args.input).slice(0, 80),
    description: String(parsed.description ?? args.input).slice(0, 500),
    priority,
    labels,
    suggested_assignee: assignee,
    type,
  };
}

interface GroomTicketSummary {
  ticketId: string;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  type: TicketType;
}

export async function groomBacklog(
  tickets: GroomTicketSummary[],
  options: { abortSignal?: AbortSignal } = {},
): Promise<GroomResult> {
  const system =
    'You are Triage, a backlog-grooming assistant. You analyze a list of tickets and respond with a single JSON object that surfaces likely duplicates, priority adjustments, and natural groupings (epics). Always respond with valid JSON. No prose, no markdown fences. In every user-visible string (rationale, group name) use smart punctuation: curly apostrophes (’), curly quotes (“ ”), em dashes (—), en dashes (–), ellipses (…). Never use straight foot-marks or apostrophes.';

  const lines = tickets
    .map(
      (t) =>
        `- ${t.ticketId} [${t.priority}/${t.type}] ${t.title} :: ${t.description.slice(0, 160)} :: labels=${t.labels.join(',') || '∅'}`,
    )
    .join('\n');

  const prompt = `Backlog:\n${lines}\n\nReturn JSON: {"duplicates":[{"keepId":string,"deleteId":string,"rationale":string}],"priorityChanges":[{"ticketId":string,"newPriority":"critical"|"high"|"medium"|"low","rationale":string}],"groups":[{"name":string,"ticketIds":string[]}]}`;

  const raw = await invokeBedrock(system, prompt, { maxTokens: 2000, abortSignal: options.abortSignal });
  const parsed = extractJson(raw) as {
    duplicates?: unknown;
    priorityChanges?: unknown;
    groups?: unknown;
  };

  const ids = new Set(tickets.map((t) => t.ticketId));

  const rawDuplicates = Array.isArray(parsed.duplicates) ? parsed.duplicates : [];
  const duplicates = rawDuplicates
    .map((d) => d as { keepId?: string; deleteId?: string; rationale?: string })
    .filter(
      (d): d is { keepId: string; deleteId: string; rationale?: string } =>
        !!d.keepId && !!d.deleteId && d.keepId !== d.deleteId &&
        ids.has(d.keepId) && ids.has(d.deleteId),
    )
    .map((d) => ({ keepId: d.keepId, deleteId: d.deleteId, rationale: d.rationale ?? '' }));

  const rawPriorityChanges = Array.isArray(parsed.priorityChanges) ? parsed.priorityChanges : [];
  const priorityChanges = rawPriorityChanges
    .map((p) => p as { ticketId?: string; newPriority?: string; rationale?: string })
    .filter(
      (p): p is { ticketId: string; newPriority: Priority; rationale?: string } =>
        !!p.ticketId &&
        ids.has(p.ticketId) &&
        (VALID_PRIORITIES as readonly string[]).includes(String(p.newPriority)),
    )
    .map((p) => ({ ticketId: p.ticketId, newPriority: p.newPriority, rationale: p.rationale ?? '' }));

  const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
  const groups = rawGroups
    .map((g) => g as { name?: string; ticketIds?: unknown })
    .filter((g): g is { name: string; ticketIds: string[] } => !!g.name && Array.isArray(g.ticketIds))
    .map((g) => ({
      name: g.name,
      ticketIds: g.ticketIds.map(String).filter((id) => ids.has(id)),
    }))
    .filter((g) => g.ticketIds.length >= 2);

  return { duplicates, priorityChanges, groups };
}
