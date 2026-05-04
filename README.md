# Triage

AI-native project tracker. Describe the work, the system files the ticket.

Vue 3 + Vuetify front end, AWS CDK + Lambda + DynamoDB back end, Amazon Bedrock (Claude Sonnet 4.5 via inference profile `us.anthropic.claude-sonnet-4-5`) for ticket structuring and backlog grooming.

## Workspace

```
build/
  frontend/         Vue 3 + Vite + Vuetify
  backend/          Node.js Lambda handlers
  infrastructure/   AWS CDK stack
  docs/             Source PRD
```

## Run the front end

```sh
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

By default the dev server proxies `/api/*` to `http://localhost:3001`. Set `VITE_API_URL` to point at a deployed API Gateway URL instead.

## Quality gates

- `npm run lint` — ESLint, zero warnings
- `npm run typecheck` — `vue-tsc --noEmit` (strict)
- `npm run test` — Vitest with v8 coverage, 80% line threshold

## Deployment

The CDK stack provisions everything in `us-west-2`: three DynamoDB tables, the Lambda handlers, an HTTP API Gateway, and the IAM policy granting `bedrock:InvokeModel` on the Sonnet 4.5 inference profile.
