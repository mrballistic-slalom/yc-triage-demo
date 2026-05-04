export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';
export type TicketType = 'bug' | 'feature' | 'task' | 'chore';
export type SprintStatus = 'active' | 'completed';

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
