# PRD: Triage — AI-Native Project Tracker

## 1. Overview

Triage is an AI-native project tracker that replaces tools like Linear and Jira. Instead of manually creating tickets, assigning priorities, and grooming backlogs, the user describes work in natural language and the system generates structured tickets, suggests priorities based on project context, and auto-groups related work. There are zero external integrations — all data lives in the app. The only external call is Amazon Bedrock for AI features.

**Deployment target:** AWS us-west-2
**Primary persona:** Engineering team lead at a 5–20 person startup
**Core value proposition:** Eliminate ticket grooming overhead. Describe the work, and the tracker structures it for you.

---

## 2. Goals & Non-Goals

### Goals

- Accept natural language input ("the checkout flow is broken on mobile when using Apple Pay") and generate a structured ticket with title, description, priority, labels, and suggested assignee
- Display tickets in a Kanban board (Backlog → In Progress → In Review → Done)
- Allow the user to create a project, add team members (name + role only — no auth), and assign tickets
- Use Bedrock Claude to auto-prioritize tickets (Critical / High / Medium / Low) based on the full backlog context
- Support a "Groom Backlog" action that analyzes all Backlog tickets, identifies duplicates, suggests merges, and re-ranks priorities
- Provide a sprint view that groups tickets into a time-boxed sprint with a capacity estimate

### Non-Goals

- Real user authentication or login (single-user app with a simple name entry for MVP)
- Git integration, PR linking, or CI/CD status
- Real-time collaboration or websocket-based live updates
- Notifications, email, or Slack integration
- Time tracking or burndown charts
- Import/export from Jira, Linear, or any other tool
- Mobile-responsive design (desktop-first)

---

## 3. User Stories & Personas

### Persona: Sam — Engineering Team Lead

Sam runs a 12-person engineering team at a seed-stage startup. They spend 3–4 hours per week grooming tickets, re-prioritizing the backlog, and writing up bug reports that engineers filed as one-liners. Sam wants to describe work quickly and have the system handle the structure.

### User Stories

**US-001:** As Sam, I want to type a natural language description of a task or bug and have the system generate a structured ticket so that I spend zero time on formatting.
- **Acceptance criteria:** Sam types free text into an input bar, presses Enter, and a fully structured ticket appears in the Backlog column within 3 seconds. The ticket includes a generated title (max 80 chars), a formatted description (markdown), a suggested priority, and up to 3 suggested labels.

**US-002:** As Sam, I want to view all tickets on a Kanban board so that I can see project status at a glance.
- **Acceptance criteria:** Four columns are displayed (Backlog, In Progress, In Review, Done). Tickets are draggable between columns. Each ticket card shows title, priority badge, labels, and assignee avatar/initials.

**US-003:** As Sam, I want to click "Groom Backlog" and have the AI analyze my entire backlog so that duplicates are flagged, priorities are re-assessed, and related tickets are grouped.
- **Acceptance criteria:** A modal displays the AI's recommendations: duplicate pairs with a "Merge" button, priority change suggestions with "Accept / Dismiss" actions, and a suggested grouping of related tickets. Sam can accept or dismiss each recommendation individually.

**US-004:** As Sam, I want to create a sprint by selecting tickets from the backlog and setting a duration so that my team knows what to focus on.
- **Acceptance criteria:** Sam clicks "New Sprint," sets a name and duration (1 or 2 weeks), and drags tickets into the sprint. The system displays a capacity estimate based on historical velocity (or a default if no history exists). The sprint view shows only sprint tickets in the Kanban layout.

**US-005:** As Sam, I want to add team members with a name and role so that I can assign tickets to them.
- **Acceptance criteria:** A Settings page allows adding team members (name + role string). The AI uses role information when suggesting assignees (e.g., a "frontend engineer" is suggested for UI bugs). No login or authentication is required for team members.

---

## 4. Functional Requirements

### Natural Language Ticket Creation

**FR-001:** The application shall display a persistent input bar at the top of the Kanban board with placeholder text: "Describe a task, bug, or feature…"

**FR-002:** When the user presses Enter (or clicks a "Create" button) with non-empty text, the system shall send the input to Bedrock Claude with the following context: the full list of existing ticket titles and priorities (for deduplication and priority calibration), the list of team members and their roles (for assignee suggestion), and the list of existing labels.

**FR-003:** The Bedrock prompt shall instruct Claude to return JSON with the following fields: `title` (string, max 80 chars), `description` (string, markdown formatted, max 500 chars), `priority` (one of: critical, high, medium, low), `labels` (array of up to 3 strings, reusing existing labels where possible), `suggested_assignee` (string matching a team member name, or null), and `type` (one of: bug, feature, task, chore).

**FR-004:** The system shall create a new ticket in DynamoDB with status `backlog`, the AI-generated fields, and a `created_at` timestamp. The ticket shall immediately appear in the Backlog column without a page refresh.

**FR-005:** If the Bedrock request fails, the system shall create the ticket with the raw input as both title and description, priority set to `medium`, empty labels, no assignee, and type `task`. An inline warning shall display: "AI structuring failed — ticket created with defaults. Click to edit."

**FR-006:** The input bar shall be disabled and show a spinner while the Bedrock request is in flight. The spinner shall display for a minimum of 500ms and a maximum of 10 seconds (timeout).

### Kanban Board

**FR-007:** The board shall display four columns: Backlog, In Progress, In Review, Done. Column headers shall include a ticket count badge.

**FR-008:** Tickets shall be draggable between columns via drag-and-drop. When a ticket is dropped in a new column, the system shall update the ticket's `status` field in DynamoDB and optimistically update the UI.

**FR-009:** Each ticket card shall display: title (truncated to 2 lines), priority badge (color-coded: critical = red, high = orange, medium = blue, low = gray), up to 3 label chips, assignee initials in a circle avatar, and type icon (bug = bug icon, feature = lightbulb, task = checkbox, chore = wrench).

**FR-010:** Clicking a ticket card shall open a detail drawer (right side panel) displaying all ticket fields. All fields shall be inline-editable. Changes shall auto-save on blur with a debounce of 500ms.

**FR-011:** The ticket detail drawer shall include a "Delete" button with a confirmation dialog: "Delete this ticket? This cannot be undone."

**FR-012:** The Backlog column shall sort tickets by priority (critical first) then by `created_at` (newest first). Other columns shall preserve manual drag-and-drop ordering.

### AI Backlog Grooming

**FR-013:** A "Groom Backlog" button shall be visible above the Kanban board. It shall be disabled if the Backlog column contains fewer than 3 tickets.

**FR-014:** When clicked, the system shall send all Backlog tickets (title, description, priority, labels, type) to Bedrock Claude with instructions to: (a) identify duplicate or near-duplicate ticket pairs, (b) suggest priority adjustments with a one-sentence rationale for each, and (c) suggest groupings of related tickets (epics).

**FR-015:** The response shall be displayed in a modal with three sections: "Duplicates" (pairs with a "Merge" button that combines descriptions and deletes one ticket), "Priority Changes" (each with "Accept" / "Dismiss" buttons), and "Suggested Groups" (each with a group name and a list of tickets — informational only for MVP, no epic entity).

**FR-016:** Accepting a priority change shall update the ticket in DynamoDB and re-sort the Backlog column. Dismissing shall close the suggestion with no side effects.

**FR-017:** If the Bedrock grooming request fails, the modal shall display: "Grooming failed — try again in a moment." with a "Retry" button.

### Sprint Management

**FR-018:** A "Sprints" tab shall be available alongside the main "Board" tab. The Sprints tab displays the active sprint (if one exists) or a "New Sprint" button.

**FR-019:** Clicking "New Sprint" shall open a dialog with fields: Sprint Name (text, required, max 40 chars) and Duration (radio: "1 week" or "2 weeks").

**FR-020:** After creating a sprint, the user shall drag tickets from a Backlog sidebar into the sprint. The sprint view shall display a Kanban board filtered to only sprint tickets.

**FR-021:** The sprint header shall display: sprint name, date range, ticket count, and a "Complete Sprint" button. Completing a sprint shall move all non-Done tickets back to Backlog and archive the sprint.

**FR-022:** Only one sprint may be active at a time. The "New Sprint" button shall be disabled while a sprint is active with the tooltip: "Complete the current sprint first."

### Team & Settings

**FR-023:** The Settings page shall display a "Team Members" section with an "Add Member" form: Name (text, required, max 60 chars) and Role (text, required, max 60 chars, e.g., "Frontend Engineer," "Designer," "QA").

**FR-024:** Each team member shall be displayed in a list with a "Remove" button. Removing a member shall not unassign them from existing tickets — their name remains on those tickets as plain text.

**FR-025:** The Settings page shall display a "Labels" section showing all labels currently in use across tickets. The user may add new labels (text, max 30 chars, color auto-assigned from a preset palette) or delete unused labels.

**FR-026:** The Settings page shall display a "Project Name" text field (max 80 chars) shown in the app header.

---

## 5. Technical Stack

### Frontend

- Vue 3 + TypeScript (Composition API, `<script setup>`)
- Vuetify 3 (Material Design component library) — v-card for tickets, v-chip for labels, v-navigation-drawer for ticket detail, v-dialog for modals
- Pinia for state management (stores: boardStore, sprintStore, settingsStore)
- Vue Router for navigation (routes: /board, /sprints, /settings)
- vuedraggable (or native HTML5 drag-and-drop) for Kanban drag-and-drop

### Backend / Infrastructure

- AWS CDK (TypeScript) for all infrastructure-as-code
- Node.js Lambda functions (TypeScript) for all API handlers
- API Gateway (HTTP API)
- DynamoDB tables:
  - `Tickets` — PK: `ticketId`, GSI on `status` + `priority` for column queries, attributes: title, description, priority, labels, assignee, type, status, sprintId (nullable), created_at, updated_at, sort_order
  - `Sprints` — PK: `sprintId`, attributes: name, duration, start_date, end_date, status (active/completed), created_at
  - `Settings` — PK: `settingKey` (singleton pattern), attributes: projectName, teamMembers (list of {name, role}), labels (list of {name, color})

### AI / LLM

- Amazon Bedrock — Claude via inference profile `us.anthropic.claude-sonnet-4-5`
- Two prompt patterns:
  1. **Ticket creation**: single user input + backlog context → structured ticket JSON
  2. **Backlog grooming**: full backlog payload → duplicates, priority suggestions, groupings

### ⚠️ DEVIATION: None — standard stack.

---

## 6. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets?status={status}` | List tickets, optionally filtered by status |
| POST | `/api/tickets` | Create a ticket from natural language input (triggers Bedrock) |
| PUT | `/api/tickets/:ticketId` | Update a ticket (any field) |
| DELETE | `/api/tickets/:ticketId` | Delete a ticket |
| POST | `/api/tickets/groom` | Run AI backlog grooming (triggers Bedrock) |
| POST | `/api/tickets/merge` | Merge two tickets (body: {keepId, deleteId}) |
| GET | `/api/sprints` | List all sprints |
| POST | `/api/sprints` | Create a new sprint |
| PUT | `/api/sprints/:sprintId` | Update sprint (add/remove tickets) |
| POST | `/api/sprints/:sprintId/complete` | Complete the active sprint |
| GET | `/api/settings` | Get project settings |
| PUT | `/api/settings` | Update project settings |

---

## 7. UI/UX Notes

**Layout:** Vuetify app shell — v-app-bar with project name and tab navigation (Board / Sprints / Settings). No navigation drawer. Full-width content area.

**Board view:** Input bar spanning full width at the top. Four Kanban columns below, equal width, scrollable independently. Ticket cards are compact (approx. 120px height). Priority badge is a small colored dot on the left edge of the card.

**Ticket detail drawer:** Right-side v-navigation-drawer, 400px wide. Opens on ticket click. All fields are editable inline. Close button (X) in the top right.

**Groom modal:** Full-width v-dialog. Three collapsible sections. Each recommendation has clear Accept/Dismiss affordances. A "Done" button closes the modal.

**Sprint view:** Same Kanban layout but filtered to sprint tickets only. Sprint header bar above the columns with sprint metadata.

**Color palette for priorities:** Critical = `#F44336` (red), High = `#FF9800` (orange), Medium = `#2196F3` (blue), Low = `#9E9E9E` (gray).

**Loading states:** Skeleton loader for Kanban columns on initial load. Spinner inside ticket cards during AI generation. Progress overlay on the groom modal while Bedrock processes.

**Empty states:** Board with no tickets: centered illustration + "Describe your first task above to get started." Backlog with < 3 tickets: groom button disabled with tooltip "Add at least 3 backlog tickets to enable AI grooming."

---

## 8. CI/CD & Quality Gates

1. **Linting:** ESLint configured and passing with zero errors (`npm run lint`)
2. **Test Coverage:** Minimum 80% coverage with 100% of tests passing (`npm run test`) — Vitest + Vue Test Utils
3. **TypeScript Strict:** `tsc --noEmit` passes with zero errors (strict mode enabled in tsconfig)
4. **GitHub Actions:** CI pipeline runs lint, type-check, and test on every push/PR
5. **Bedrock Inference Profiles:** All Claude API calls use Bedrock inference profile `us.anthropic.claude-sonnet-4-5` — never direct model IDs, never direct Anthropic API keys

---

## 9. Out of Scope

- User authentication, login, or session management
- Git/GitHub integration, PR linking, or commit references
- Real-time collaboration or multi-user live cursors
- Notifications (in-app, email, Slack, or otherwise)
- Time tracking, story points, or burndown/velocity charts
- Import/export to/from Jira, Linear, Asana, or any other tool
- File attachments or image uploads on tickets
- Comments or activity history on tickets
- Custom workflows or user-defined columns beyond the four defaults
- Mobile-responsive design
- Recurring tickets or automation rules
- Keyboard shortcuts
- Undo/redo for ticket operations
