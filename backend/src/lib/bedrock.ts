import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { AIDraftedTicket, GroomResult, Priority, TicketType } from '../types';

const region = process.env.AWS_REGION ?? 'us-west-2';
const inferenceProfile = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-5';

const client = new BedrockRuntimeClient({ region });

const VALID_PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];
const VALID_TYPES: TicketType[] = ['bug', 'feature', 'task', 'chore'];

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string }[];
}

interface BedrockBody {
  anthropic_version: 'bedrock-2023-05-31';
  max_tokens: number;
  system?: string;
  messages: BedrockMessage[];
  temperature?: number;
}

interface BedrockResponse {
  content: { type: 'text'; text: string }[];
  stop_reason: string;
}

async function invoke(system: string, prompt: string, maxTokens = 1500): Promise<string> {
  const body: BedrockBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system,
    temperature: 0.2,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  };

  const cmd = new InvokeModelCommand({
    modelId: inferenceProfile,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(JSON.stringify(body)),
  });

  const result = await client.send(cmd);
  const text = new TextDecoder().decode(result.body);
  const parsed = JSON.parse(text) as BedrockResponse;
  return parsed.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const arrayStart = candidate.indexOf('[');
  const first =
    start === -1 ? arrayStart : arrayStart === -1 ? start : Math.min(start, arrayStart);
  const lastClose = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  if (first === -1 || lastClose === -1) throw new Error('No JSON in response');
  return JSON.parse(candidate.slice(first, lastClose + 1));
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

  const raw = await invoke(system, prompt, 1024);
  const parsed = extractJson(raw) as Record<string, unknown>;

  const title = String(parsed.title ?? args.input).slice(0, 80);
  const description = String(parsed.description ?? args.input).slice(0, 500);
  const priority = (VALID_PRIORITIES as string[]).includes(String(parsed.priority))
    ? (parsed.priority as Priority)
    : 'medium';
  const type = (VALID_TYPES as string[]).includes(String(parsed.type))
    ? (parsed.type as TicketType)
    : 'task';
  const labels = Array.isArray(parsed.labels)
    ? parsed.labels.map(String).slice(0, 3)
    : [];
  const assigneeRaw = parsed.suggested_assignee;
  const teamNames = new Set(args.team.map((m) => m.name));
  const assignee =
    typeof assigneeRaw === 'string' && teamNames.has(assigneeRaw) ? assigneeRaw : null;

  return { title, description, priority, labels, suggested_assignee: assignee, type };
}

interface GroomTicketSummary {
  ticketId: string;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  type: TicketType;
}

export async function groomBacklog(tickets: GroomTicketSummary[]): Promise<GroomResult> {
  const system =
    'You are Triage, a backlog-grooming assistant. You analyze a list of tickets and respond with a single JSON object that surfaces likely duplicates, priority adjustments, and natural groupings (epics). Always respond with valid JSON. No prose, no markdown fences. In every user-visible string (rationale, group name) use smart punctuation: curly apostrophes (’), curly quotes (“ ”), em dashes (—), en dashes (–), ellipses (…). Never use straight foot-marks or apostrophes.';

  const lines = tickets
    .map(
      (t) =>
        `- ${t.ticketId} [${t.priority}/${t.type}] ${t.title} :: ${t.description.slice(0, 160)} :: labels=${t.labels.join(',') || '∅'}`,
    )
    .join('\n');

  const prompt = `Backlog:\n${lines}\n\nReturn JSON: {"duplicates":[{"keepId":string,"deleteId":string,"rationale":string}],"priorityChanges":[{"ticketId":string,"newPriority":"critical"|"high"|"medium"|"low","rationale":string}],"groups":[{"name":string,"ticketIds":string[]}]}`;

  const raw = await invoke(system, prompt, 2000);
  const parsed = extractJson(raw) as {
    duplicates?: unknown;
    priorityChanges?: unknown;
    groups?: unknown;
  };

  const ids = new Set(tickets.map((t) => t.ticketId));

  const duplicates = Array.isArray(parsed.duplicates)
    ? parsed.duplicates
        .map((d) => d as { keepId?: string; deleteId?: string; rationale?: string })
        .filter(
          (d): d is { keepId: string; deleteId: string; rationale: string } =>
            !!d.keepId && !!d.deleteId && d.keepId !== d.deleteId &&
            ids.has(d.keepId) && ids.has(d.deleteId),
        )
        .map((d) => ({ keepId: d.keepId, deleteId: d.deleteId, rationale: d.rationale ?? '' }))
    : [];

  const priorityChanges = Array.isArray(parsed.priorityChanges)
    ? parsed.priorityChanges
        .map((p) => p as { ticketId?: string; newPriority?: string; rationale?: string })
        .filter(
          (p): p is { ticketId: string; newPriority: Priority; rationale: string } =>
            !!p.ticketId &&
            ids.has(p.ticketId) &&
            (VALID_PRIORITIES as string[]).includes(String(p.newPriority)),
        )
        .map((p) => ({
          ticketId: p.ticketId,
          newPriority: p.newPriority,
          rationale: p.rationale ?? '',
        }))
    : [];

  const groups = Array.isArray(parsed.groups)
    ? parsed.groups
        .map((g) => g as { name?: string; ticketIds?: unknown })
        .filter((g): g is { name: string; ticketIds: string[] } => !!g.name && Array.isArray(g.ticketIds))
        .map((g) => ({
          name: g.name,
          ticketIds: g.ticketIds.map(String).filter((id) => ids.has(id)),
        }))
        .filter((g) => g.ticketIds.length >= 2)
    : [];

  return { duplicates, priorityChanges, groups };
}
