export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';
export type TicketType = 'bug' | 'feature' | 'task' | 'chore';
export type SprintStatus = 'active' | 'completed';

export const VALID_PRIORITIES: readonly Priority[] = ['critical', 'high', 'medium', 'low'];
export const VALID_TYPES: readonly TicketType[] = ['bug', 'feature', 'task', 'chore'];
export const VALID_STATUSES: readonly TicketStatus[] = ['backlog', 'in_progress', 'in_review', 'done'];

export const MAX_TITLE = 80;
export const MAX_DESCRIPTION = 1000;
export const MAX_LABELS = 6;
export const MAX_LABEL_LEN = 30;
export const MAX_NAME_LEN = 60;
export const MAX_USER_INPUT = 4000;
export const MAX_QUESTION = 2000;
export const MAX_INSTRUCTION = 2000;

export interface Ticket {
  ticketId: string;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  assignee: string | null;
  type: TicketType;
  status: TicketStatus;
  sprintId: string | null;
  created_at: string;
  updated_at: string;
  sort_order: number;
  ai_failed?: boolean;
}

export interface TeamMember {
  name: string;
  role: string;
}

export interface Label {
  name: string;
  color: string;
}

export interface Settings {
  projectName: string;
  teamMembers: TeamMember[];
  labels: Label[];
}

export interface Sprint {
  sprintId: string;
  name: string;
  duration: 1 | 2;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  created_at: string;
  ticketIds: string[];
}

export interface AIDraftedTicket {
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  suggested_assignee: string | null;
  type: TicketType;
}

export interface GroomDuplicate {
  keepId: string;
  deleteId: string;
  rationale: string;
}

export interface GroomPriorityChange {
  ticketId: string;
  newPriority: Priority;
  rationale: string;
}

export interface GroomGroup {
  name: string;
  ticketIds: string[];
}

export interface GroomResult {
  duplicates: GroomDuplicate[];
  priorityChanges: GroomPriorityChange[];
  groups: GroomGroup[];
}
