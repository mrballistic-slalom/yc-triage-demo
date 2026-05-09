# Claude collaboration notes

Project context for future Claude sessions in this repo. The README is for humans; this is for you.

## What this is

AI-native project tracker. Three workspaces:

- `frontend/` — Vue 3 + Vite + Vuetify + Pinia. Editorial design system in `src/styles/`.
- `backend/` — Node 22 Lambda handlers (tickets, sprints, settings, ai). DynamoDB via AWS SDK v3 doc client. Amazon Bedrock for every AI surface.
- `infrastructure/` — AWS CDK v2 stack. Single stack: 3 tables, 4 Lambdas, HTTP API, S3, CloudFront. Region `us-west-2`.

## Commands

Each workspace has its own `package.json`. Don't run from the root unless using `--workspace`.

```sh
# Per workspace:
npm test            # vitest run --coverage  (backend, frontend)
npm run lint        # eslint --max-warnings 0
npm run typecheck   # tsc --noEmit  (or vue-tsc for frontend)
npm run build       # frontend only — produces dist/ for the BucketDeployment

# Deploy:
npm --workspace frontend run build           # required before deploy — BucketDeployment uses dist/
npm --workspace infrastructure run deploy    # cdk deploy --require-approval never
npm --workspace infrastructure run diff      # always preview before deploying
```

`infrastructure` has no real tests — `npm test` exits non-zero with "no test files found." That's expected; don't try to "fix" it.

## Branch policy

`main` is protected. Direct push is blocked by a permission rule. **Always**:

1. Create a feature branch
2. Open a PR with `gh pr create`
3. Let the user merge
4. Pull main, then deploy

Recent commits use squash merges with `feat:` / `fix:` / `chore:` prefixes.

## Bedrock model id is load-bearing

The model id `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (a cross-region inference profile) appears in **three** places that must stay aligned:

1. `backend/src/lib/bedrock.ts` — `inferenceProfile` constant (env override: `BEDROCK_MODEL_ID`)
2. `infrastructure/lib/triage-stack.ts` — `BEDROCK_INFERENCE_PROFILE` constant
3. The IAM policy resource ARNs in the same file — both the inference-profile ARN and the foundation-model ARN (the latter is derived by stripping the `us.` prefix)

Never use the shorthand `us.anthropic.claude-sonnet-4-5` — the dated suffix is required. Direct Anthropic API keys are not used; everything goes through Bedrock.

## Smart-typography rule

System prompts demand curly quotes (' " "), em dashes (—), en dashes (–), ellipses (…). Never straight quotes / apostrophes / double-hyphens in user-visible AI output. The rule is exported as `TYPOGRAPHY_RULE` in `backend/src/lib/bedrock.ts` — reuse it, don't redefine it.

## Known design constraints (don't "fix" without asking)

- **CORS `Access-Control-Allow-Origin: *`** in `infrastructure/lib/triage-stack.ts` and `backend/src/lib/http.ts`. The frontend's `PasswordGate` (`slalom2026` in `localStorage`) is **cosmetic only** — there is no real auth at the API boundary. This is intentional for the workshop demo.
- **`sort_order` collision on Kanban move** (`frontend/src/stores/board.ts`). When a card is moved, only that card's `sort_order` is updated (to the new index), so it can collide with siblings. A real fix needs fractional indexing (LexoRank-style) or batch-renumbering siblings on every move. Known issue, not currently scheduled.
- **DynamoDB table names hardcoded** (`TriageTickets`, `TriageSprints`, `TriageSettings`). Two stacks in the same account would collide. Fine for single-deploy.

## Code conventions

- Validation lives in `backend/src/types.ts`: `VALID_PRIORITIES`, `VALID_STATUSES`, `VALID_TYPES`, `MAX_*` constants. Use them instead of redefining.
- Shared HTTP plumbing is in `backend/src/lib/http.ts`: `createRouter()`, `parseBody()` (throws `BadRequestError` → 400), `ok/created/badRequest/notFound/serverError`.
- Bedrock calls go through `invokeBedrock(system, prompt, { maxTokens, temperature, abortSignal })` in `backend/src/lib/bedrock.ts`. JSON extraction goes through `extractJson()` (paired-bracket walker — handles `[…] {…}` and string-escaped braces).
- Long-running Bedrock calls in handlers use the local `withTimeout((signal) => …, ms)` helper in `handlers/tickets.ts` — pass the signal into `invokeBedrock` so the Bedrock call actually cancels on timeout.
- Frontend AI output is rendered via `frontend/src/lib/markdown.ts`. The `marked` renderer's `html()` is overridden to escape raw HTML — this is the XSS guard for prompt-injectable AI output. Don't bypass it with `v-html` of unsanitized strings.
- Frontend stores are Pinia composition-API (setup stores). Optimistic updates snapshot prev state and roll back on error — see `board.ts` for the pattern.

## Tests

- Backend: `backend/tests/bedrock.spec.ts` — covers `draftTicket`, `groomBacklog`, and `extractJson` regression cases. Mocks `BedrockRuntimeClient.send`.
- Frontend: `frontend/tests/board.spec.ts` (board store), `frontend/tests/stores.spec.ts` (other stores). Mocks `@/api/client`.

When changing AI behavior or HTTP contracts, add a test alongside. The bar is low — these are just sanity checks, not exhaustive coverage.
