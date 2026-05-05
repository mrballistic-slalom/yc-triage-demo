/**
 * Seed the live DynamoDB tables with a realistic project snapshot.
 *
 *   AWS_REGION=us-west-2 \
 *   TICKETS_TABLE=TriageTickets \
 *   SPRINTS_TABLE=TriageSprints \
 *   SETTINGS_TABLE=TriageSettings \
 *     npx ts-node backend/scripts/seed.ts
 */
import { v4 as uuid } from 'uuid';
import {
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES, SETTINGS_KEY } from '../src/lib/ddb';
import type { Sprint, Ticket } from '../src/types';

const TEAM = [
  { name: 'Sam Ortiz', role: 'Engineering Lead' },
  { name: 'Alex Park', role: 'Senior Frontend Engineer' },
  { name: 'Jordan Reyes', role: 'Backend Engineer' },
  { name: 'Riley Chen', role: 'Product Designer' },
  { name: 'Morgan Patel', role: 'QA Engineer' },
  { name: 'Casey Bell', role: 'Mobile Engineer' },
];

const LABELS = [
  { name: 'auth', color: '#E84A1A' },
  { name: 'checkout', color: '#C8A24B' },
  { name: 'mobile', color: '#2848FF' },
  { name: 'billing', color: '#A33C9F' },
  { name: 'onboarding', color: '#0F766E' },
  { name: 'infra', color: '#475569' },
  { name: 'a11y', color: '#2F4A2A' },
  { name: 'analytics', color: '#B45309' },
  { name: 'perf', color: '#BE123C' },
];

interface Seed {
  title: string;
  description: string;
  priority: Ticket['priority'];
  labels: string[];
  assignee: string | null;
  type: Ticket['type'];
  status: Ticket['status'];
  inSprint?: boolean;
  daysAgo?: number;
}

const SEEDS: Seed[] = [
  // —— Done (recently shipped)
  {
    title: 'Ship the new pricing page',
    description:
      'Replaced the legacy /pricing route with the new tiered layout. **Done:** copy, illustrations, mobile breakpoints, A/B harness wired through analytics.',
    priority: 'high',
    labels: ['analytics'],
    assignee: 'Riley Chen',
    type: 'feature',
    status: 'done',
    daysAgo: 6,
  },
  {
    title: 'Migrate Stripe SDK to v15',
    description:
      'Upgraded `stripe` from 11.x to 15.x. Confirmed the new “Confirmation Tokens” flow works against test mode. No production traffic affected.',
    priority: 'medium',
    labels: ['billing', 'checkout'],
    assignee: 'Jordan Reyes',
    type: 'chore',
    status: 'done',
    daysAgo: 5,
  },
  {
    title: 'Fix flaky “invite teammate” end-to-end test',
    description:
      'The test was racing against a fixture that seeded users in a non-deterministic order. Sorted the seed and pinned the assertion to a specific email.',
    priority: 'low',
    labels: ['onboarding'],
    assignee: 'Morgan Patel',
    type: 'bug',
    status: 'done',
    daysAgo: 4,
  },
  {
    title: 'Add OpenTelemetry traces to checkout',
    description:
      'Instrumented `POST /checkout/intent` and the downstream Stripe call. Traces flow into Honeycomb under the `checkout-prod` dataset.',
    priority: 'medium',
    labels: ['checkout', 'infra'],
    assignee: 'Jordan Reyes',
    type: 'task',
    status: 'done',
    daysAgo: 2,
  },
  {
    title: 'Dark-mode toggle in settings',
    description:
      'Added the toggle behind a `ff_dark_mode` flag. Currently rolling out to internal users only.',
    priority: 'low',
    labels: [],
    assignee: 'Alex Park',
    type: 'feature',
    status: 'done',
    daysAgo: 2,
  },

  // —— In Review
  {
    title: 'Refactor onboarding wizard to a state machine',
    description:
      'Replaced the tangle of `useEffect`s with an XState machine. Each step is now a distinct state with explicit guards. Awaiting design QA.',
    priority: 'high',
    labels: ['onboarding'],
    assignee: 'Alex Park',
    type: 'task',
    status: 'in_review',
    inSprint: true,
    daysAgo: 1,
  },
  {
    title: 'Apple Pay support on the mobile checkout',
    description:
      'Wired Apple Pay through Stripe Payment Sheet. Tested on iOS 18.4 / 18.5 simulators. Reviewer: Sam.',
    priority: 'high',
    labels: ['mobile', 'checkout', 'billing'],
    assignee: 'Casey Bell',
    type: 'feature',
    status: 'in_review',
    inSprint: true,
    daysAgo: 0,
  },

  // —— In Progress
  {
    title: 'Single sign-on via Google Workspace',
    description:
      'Implementing the OIDC handshake with Workspace. Currently stuck on domain-restricted sign-in for the `acme-customers` org.',
    priority: 'critical',
    labels: ['auth'],
    assignee: 'Jordan Reyes',
    type: 'feature',
    status: 'in_progress',
    inSprint: true,
    daysAgo: 3,
  },
  {
    title: 'Magic-link email rendering broken in Outlook',
    description:
      'The CTA button collapses to a thin line in Outlook 365. Probably the table-based fallback. Need to add MSO conditional comments.',
    priority: 'high',
    labels: ['auth', 'onboarding'],
    assignee: 'Alex Park',
    type: 'bug',
    status: 'in_progress',
    inSprint: true,
    daysAgo: 1,
  },
  {
    title: 'Reduce homepage Largest Contentful Paint to under 1.5s',
    description:
      'Currently at 2.6s on a 4G profile. Ship the deferred-hero variant and pre-warm the marketing CDN edge.',
    priority: 'medium',
    labels: ['perf'],
    assignee: 'Riley Chen',
    type: 'task',
    status: 'in_progress',
    inSprint: true,
    daysAgo: 2,
  },

  // —— Backlog
  {
    title: 'Signup form silently rejects “+” in email addresses',
    description:
      'Users with sub-addressed emails (`name+tag@…`) tap Sign up and nothing happens. The validator is too strict; replace with the RFC-5322 regex from `email-validator`.',
    priority: 'critical',
    labels: ['auth', 'onboarding'],
    assignee: null,
    type: 'bug',
    status: 'backlog',
    daysAgo: 0,
  },
  {
    title: 'Apple Pay button does nothing on Safari iOS 18',
    description:
      'Tap registers but the Payment Sheet never appears. Reproduces on iPhone 15, iOS 18.5. Suspect the merchant validation request is failing silently.',
    priority: 'critical',
    labels: ['mobile', 'checkout'],
    assignee: null,
    type: 'bug',
    status: 'backlog',
    daysAgo: 0,
  },
  {
    title: 'Bulk-invite teammates via CSV upload',
    description:
      'Customers with 50+ seats are pasting a list into the share dialog one at a time. CSV upload + preview + confirm.',
    priority: 'high',
    labels: ['onboarding'],
    assignee: null,
    type: 'feature',
    status: 'backlog',
    daysAgo: 1,
  },
  {
    title: 'Move auth tokens out of localStorage into httpOnly cookies',
    description:
      'Legal flagged this in the SOC 2 prep — XSS surface is too wide. Plan: rotate to a refresh-cookie + short-lived access token pattern. Coordinate the cutover so existing sessions don’t blink.',
    priority: 'high',
    labels: ['auth', 'infra'],
    assignee: null,
    type: 'task',
    status: 'backlog',
    daysAgo: 1,
  },
  {
    title: 'Keyboard navigation broken in the ticket drawer',
    description:
      'Tab order skips the Priority and Type selects. Screen-reader users can’t reach them at all.',
    priority: 'high',
    labels: ['a11y'],
    assignee: null,
    type: 'bug',
    status: 'backlog',
    daysAgo: 2,
  },
  {
    title: 'Audit color contrast across the new pricing page',
    description:
      'Several CTAs are at 3.8:1 against the cream background. Targeting WCAG AA (4.5:1) for body text and 3:1 for large.',
    priority: 'medium',
    labels: ['a11y'],
    assignee: null,
    type: 'chore',
    status: 'backlog',
    daysAgo: 2,
  },
  {
    title: 'Slack-style /commands in the composer',
    description:
      'Let users type `/standup`, `/risks`, `/whoowns` to invoke AI flows directly from the composer instead of clicking through menus.',
    priority: 'medium',
    labels: [],
    assignee: null,
    type: 'feature',
    status: 'backlog',
    daysAgo: 3,
  },
  {
    title: 'Dashboard loads twice on first paint',
    description:
      'Both `useDashboard` and `useDashboardLazy` fire on mount in dev. Likely a stale `useEffect` left over from the route refactor.',
    priority: 'low',
    labels: ['perf'],
    assignee: null,
    type: 'bug',
    status: 'backlog',
    daysAgo: 3,
  },
  {
    title: 'Add weekly billing-anomaly digest email',
    description:
      'Finance asks for a Monday-morning digest of MRR changes, refunds over $500, and trial-to-paid conversions. Generate and send via SES.',
    priority: 'low',
    labels: ['billing', 'analytics'],
    assignee: null,
    type: 'feature',
    status: 'backlog',
    daysAgo: 4,
  },
  {
    title: 'Replace the old Webpack build with Vite',
    description:
      'Cold start is 32s. Vite dev server should bring it under 1s and unblock the team. Two days of grunt work.',
    priority: 'low',
    labels: ['infra', 'perf'],
    assignee: null,
    type: 'chore',
    status: 'backlog',
    daysAgo: 5,
  },
];

async function clearTable(tableName: string, keyName: string) {
  const items = await ddb.send(new ScanCommand({ TableName: tableName }));
  for (const item of items.Items ?? []) {
    await ddb.send(
      new DeleteCommand({ TableName: tableName, Key: { [keyName]: item[keyName] } }),
    );
  }
}

async function seedTickets(sprintId: string) {
  const now = Date.now();
  const tickets: Ticket[] = SEEDS.map((s, idx) => {
    const createdAt = new Date(now - (s.daysAgo ?? 0) * 24 * 60 * 60 * 1000).toISOString();
    return {
      ticketId: uuid(),
      title: s.title,
      description: s.description,
      priority: s.priority,
      labels: s.labels,
      assignee: s.assignee,
      type: s.type,
      status: s.status,
      sprintId: s.inSprint ? sprintId : null,
      created_at: createdAt,
      updated_at: createdAt,
      sort_order: idx,
    };
  });

  for (let i = 0; i < tickets.length; i += 25) {
    const batch = tickets.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLES.tickets]: batch.map((t) => ({ PutRequest: { Item: t } })),
        },
      }),
    );
  }
  return tickets;
}

async function main() {
  console.log('Clearing tables…');
  await Promise.all([
    clearTable(TABLES.tickets, 'ticketId'),
    clearTable(TABLES.sprints, 'sprintId'),
    clearTable(TABLES.settings, 'settingKey'),
  ]);

  console.log('Writing settings…');
  await ddb.send(
    new PutCommand({
      TableName: TABLES.settings,
      Item: {
        settingKey: SETTINGS_KEY,
        projectName: 'Triage',
        teamMembers: TEAM,
        labels: LABELS,
      },
    }),
  );

  console.log('Writing active sprint…');
  const sprintId = uuid();
  const start = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const sprint: Sprint = {
    sprintId,
    name: 'Auth & checkout polish',
    duration: 2,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    status: 'active',
    created_at: start.toISOString(),
    ticketIds: [],
  };

  console.log('Writing tickets…');
  const tickets = await seedTickets(sprintId);
  sprint.ticketIds = tickets.filter((t) => t.sprintId === sprintId).map((t) => t.ticketId);

  await ddb.send(new PutCommand({ TableName: TABLES.sprints, Item: sprint }));

  console.log(`Done. Wrote ${tickets.length} tickets and 1 active sprint.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
