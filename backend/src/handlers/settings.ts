import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { getSettings, putSettings } from '../lib/repo';
import { badRequest, createRouter, ok, parseBody } from '../lib/http';
import {
  MAX_LABEL_LEN,
  MAX_NAME_LEN,
  type Label,
  type Settings,
  type TeamMember,
} from '../types';

const MAX_TEAM_SIZE = 50;
const MAX_LABEL_COUNT = 50;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function validateTeam(input: unknown): TeamMember[] | { error: string } {
  if (!Array.isArray(input)) return { error: 'teamMembers must be an array' };
  if (input.length > MAX_TEAM_SIZE) return { error: `teamMembers must be ≤ ${MAX_TEAM_SIZE}` };
  const out: TeamMember[] = [];
  for (const m of input) {
    if (!m || typeof m !== 'object') return { error: 'each team member must be an object' };
    const r = m as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.role !== 'string') {
      return { error: 'team member name and role must be strings' };
    }
    out.push({ name: r.name.slice(0, MAX_NAME_LEN), role: r.role.slice(0, MAX_NAME_LEN) });
  }
  return out;
}

function validateLabels(input: unknown): Label[] | { error: string } {
  if (!Array.isArray(input)) return { error: 'labels must be an array' };
  if (input.length > MAX_LABEL_COUNT) return { error: `labels must be ≤ ${MAX_LABEL_COUNT}` };
  const out: Label[] = [];
  for (const l of input) {
    if (!l || typeof l !== 'object') return { error: 'each label must be an object' };
    const r = l as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.color !== 'string') {
      return { error: 'label name and color must be strings' };
    }
    if (!HEX_COLOR.test(r.color)) return { error: `label color must be #RRGGBB hex` };
    out.push({ name: r.name.slice(0, MAX_LABEL_LEN), color: r.color });
  }
  return out;
}

async function updateHandler(e: APIGatewayProxyEventV2) {
  const current = await getSettings();
  const patch = parseBody<Record<string, unknown>>(e);

  let teamMembers = current.teamMembers;
  if (patch.teamMembers !== undefined) {
    const result = validateTeam(patch.teamMembers);
    if ('error' in result) return badRequest(result.error);
    teamMembers = result;
  }

  let labels = current.labels;
  if (patch.labels !== undefined) {
    const result = validateLabels(patch.labels);
    if ('error' in result) return badRequest(result.error);
    labels = result;
  }

  let projectName = current.projectName;
  if (patch.projectName !== undefined) {
    if (typeof patch.projectName !== 'string') return badRequest('projectName must be a string');
    projectName = patch.projectName.slice(0, MAX_NAME_LEN);
  }

  const next: Settings = { projectName, teamMembers, labels };
  return ok(await putSettings(next));
}

export const handler = createRouter('settings', {
  'GET /api/settings': async () => ok(await getSettings()),
  'PUT /api/settings': updateHandler,
});
