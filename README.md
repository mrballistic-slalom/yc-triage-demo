# Triage

> Describe the work in plain language. Triage drafts the title, calibrates priority, picks labels, and suggests an assignee — so you can stop grooming and start shipping.

**Live demo:** https://d3gr0x649404r1.cloudfront.net (gated by a passphrase — ask the demo runner)

An AI-native project tracker built end-to-end from a written PRD: Vue 3 + Vuetify front end, AWS CDK + Lambda + DynamoDB back end, Amazon Bedrock (Claude Sonnet 4.5 via inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0`) for every AI surface in the product. Hosted on CloudFront in front of S3, with HTTP API Gateway routing to three TypeScript Lambdas and one DynamoDB table per domain (Tickets / Sprints / Settings).

## What's AI-native about it

This isn't a normal tracker with a chat sidebar bolted on. The AI is in every load-bearing surface:

- **Natural-language ticket creation.** Type *"the signup form silently rejects emails with a + in them"* and Triage drafts the title, picks `bug` over `feature`, calibrates the priority against the existing backlog, reaches for existing labels first, and suggests an assignee from the team roster.
- **Slash commands in the composer.** `/ask <question>`, `/standup`, `/risks`, `/groom` — the same input bar is the universal AI surface.
- **Ask Triage.** A conversational panel that has the entire project state in context. *"What's most at risk right now?"* / *"Who's overloaded?"* / *"Summarize the backlog by theme."*
- **Standup digest.** A one-line pulse rendered at the top of the board on every load — "5 in flight, 2 in review, 2 critical bugs unassigned in backlog" — generated fresh each session.
- **Sprint risk gauge.** A passive widget on the sprint hero: *"medium · critical SSO work still in progress with 10 days left, plus Alex Park split across two high-priority items."*
- **Conversational ticket editing.** Open the drawer, type *"bump to high, assign Alex, label as auth"* and the LLM emits a structured patch the tracker applies.
- **Backlog grooming pass.** The "Groom" button surfaces likely duplicates, priority adjustments with rationales, and natural epic-shaped groupings — each with one-click accept / dismiss.

Every user-visible string the model produces uses smart typography (curly apostrophes, em dashes, ellipses) — the system prompts demand it, the front end never hand-edits the result.

## Workspace layout

```
build/
  frontend/         Vue 3 + Vite + Vuetify — editorial design, served from CloudFront
  backend/          Node.js 22 Lambda handlers — tickets, sprints, settings, ai
  backend/scripts/  Operational scripts (seed.ts re-fills DynamoDB with realistic data)
  infrastructure/   AWS CDK stack — DynamoDB × 3, Lambdas, HTTP API, S3, CloudFront, IAM
  docs/             Source PRD
```

## Quickstart (local)

```sh
npm install                          # installs all workspaces from the root lockfile
npm --workspace frontend run dev     # http://localhost:5173 — proxies /api to the live backend
```

The dev server reads `VITE_API_URL` from `frontend/.env.local` if you want to point at a different API.

## Quality gates

All run from the repo root:

```sh
npm --workspace frontend run lint typecheck test build
npm --workspace backend  run lint typecheck test build
npm --workspace infrastructure run lint typecheck synth
```

CI (`.github/workflows/ci.yml`) runs the full set on every push to `main` and every PR.

## Deploy

The CDK stack provisions everything in `us-west-2`:

```sh
npm --workspace frontend run build           # build first so BucketDeployment has fresh assets
npm --workspace infrastructure run deploy    # cdk deploy --require-approval never
```

The stack outputs `ApiUrl`, `SiteUrl`, and `SiteBucketName`. CloudFront `/*` is invalidated automatically.

## Seed realistic project data

```sh
AWS_REGION=us-west-2 npm --workspace backend run seed
```

This wipes the three tables, writes the team roster + label palette, creates an active 2-week sprint, and inserts ~20 tickets spread across all four columns (recent ships in Done, two reviews waiting, three in flight, ten or so in backlog with a couple of unassigned criticals to make the AI features sing).

## Bedrock notes

All Claude calls go through the cross-region inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0` — never a raw model id, never a direct Anthropic API key. The PRD's shorthand (`us.anthropic.claude-sonnet-4-5`) is **not** a valid id; the dated suffix is required.
