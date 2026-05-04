import {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  type UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES, SETTINGS_KEY } from './ddb';
import type { Settings, Sprint, Ticket } from '../types';

const DEFAULT_SETTINGS: Settings = {
  projectName: 'Triage',
  teamMembers: [],
  labels: [],
};

export async function listTickets(status?: string): Promise<Ticket[]> {
  const cmd = new ScanCommand({ TableName: TABLES.tickets });
  const result = await ddb.send(cmd);
  const tickets = (result.Items ?? []) as Ticket[];
  return status ? tickets.filter((t) => t.status === status) : tickets;
}

export async function getTicket(ticketId: string): Promise<Ticket | null> {
  const cmd = new GetCommand({ TableName: TABLES.tickets, Key: { ticketId } });
  const result = await ddb.send(cmd);
  return (result.Item as Ticket | undefined) ?? null;
}

export async function putTicket(ticket: Ticket): Promise<Ticket> {
  await ddb.send(new PutCommand({ TableName: TABLES.tickets, Item: ticket }));
  return ticket;
}

export async function updateTicket(ticketId: string, patch: Partial<Ticket>): Promise<Ticket> {
  const allowed: (keyof Ticket)[] = [
    'title',
    'description',
    'priority',
    'labels',
    'assignee',
    'type',
    'status',
    'sprintId',
    'sort_order',
    'ai_failed',
  ];
  const sets: string[] = ['#updated_at = :updated_at'];
  const values: Record<string, unknown> = { ':updated_at': new Date().toISOString() };
  const names: Record<string, string> = { '#updated_at': 'updated_at' };

  for (const key of allowed) {
    if (key in patch) {
      const placeholder = `:${key}`;
      const namePlaceholder = `#${key}`;
      sets.push(`${namePlaceholder} = ${placeholder}`);
      values[placeholder] = patch[key] ?? null;
      names[namePlaceholder] = key;
    }
  }

  const input: UpdateCommandInput = {
    TableName: TABLES.tickets,
    Key: { ticketId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: names,
    ReturnValues: 'ALL_NEW',
  };
  const result = await ddb.send(new UpdateCommand(input));
  return result.Attributes as Ticket;
}

export async function deleteTicket(ticketId: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TABLES.tickets, Key: { ticketId } }));
}

export async function listSprints(): Promise<Sprint[]> {
  const result = await ddb.send(new ScanCommand({ TableName: TABLES.sprints }));
  return (result.Items ?? []) as Sprint[];
}

export async function getSprint(sprintId: string): Promise<Sprint | null> {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLES.sprints, Key: { sprintId } }),
  );
  return (result.Item as Sprint | undefined) ?? null;
}

export async function putSprint(sprint: Sprint): Promise<Sprint> {
  await ddb.send(new PutCommand({ TableName: TABLES.sprints, Item: sprint }));
  return sprint;
}

export async function getSettings(): Promise<Settings> {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLES.settings, Key: { settingKey: SETTINGS_KEY } }),
  );
  if (!result.Item) return { ...DEFAULT_SETTINGS };
  const item = result.Item as Settings & { settingKey: string };
  return {
    projectName: item.projectName ?? DEFAULT_SETTINGS.projectName,
    teamMembers: item.teamMembers ?? [],
    labels: item.labels ?? [],
  };
}

export async function putSettings(settings: Settings): Promise<Settings> {
  await ddb.send(
    new PutCommand({
      TableName: TABLES.settings,
      Item: { settingKey: SETTINGS_KEY, ...settings },
    }),
  );
  return settings;
}
