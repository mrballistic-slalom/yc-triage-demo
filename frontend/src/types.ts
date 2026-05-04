export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';
export type TicketType = 'bug' | 'feature' | 'task' | 'chore';

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

export type SprintStatus = 'active' | 'completed';

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

export const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#F44336',
  high: '#FF9800',
  medium: '#2196F3',
  low: '#9E9E9E',
};

export const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const TYPE_ICONS: Record<TicketType, string> = {
  bug: 'mdi-bug',
  feature: 'mdi-lightbulb-on',
  task: 'mdi-checkbox-marked-outline',
  chore: 'mdi-wrench',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const STATUS_ORDER: TicketStatus[] = ['backlog', 'in_progress', 'in_review', 'done'];
