# ModelRoute Audit

**Audit date:** 2026-09-30

**Mode:** Phase 1 read-only. No source files were changed. The only created file is this report.
**Runtime:** Next.js 16.2.12, despite the README describing Next.js 15.

## Implementation update

The following findings were addressed in the working tree after the audit (no git commit was created): `AUTH-003`, `API-001`, `API-002`, `POLICY-001`, `RES-002` (provider exhaustion now returns 503), `CORE-002` (bounded request signal), `CORE-003` (fabricated fallback removed), `LINT-001`, `TEST-001` (25 core tests, including HALF_OPEN probe behavior), `UI-002` (health endpoint), `DATA-001` (history/analytics/eval/key screens use API/empty states), and `REPO-001` (CI workflow and MIT license). `AUTH-001`, `AUTH-002`, `RATE-001`, `RES-001`, `RES-003`, and `SSRF-001` still require deployment-grade identity, distributed state, and infrastructure policy work.

## 1. Scorecard

| Area | Score | Justification |
|---|---:|---|
| Routing correctness | 4/10 | Basic weighted routing works, but the 31-case live probe scored 25/31 (80.6%); general intent collapsed to simple Q&A and policy persistence is absent. |
| Resilience | 2/10 | Breaker state is process-local, probe admission is not atomic, and provider failure can become a fabricated success. |
| Security | 2/10 | Production API auth is commented out, dashboard/API-key routes are unauthenticated, and Redis failure fails open. |
| Data/observability | 2/10 | Logs have correlation IDs, but analytics/history are seeded UI data, there is no health/metrics endpoint, and data access is mostly absent. |
| Frontend quality | 6/10 | The token direction and responsive shell are credible, but shadcn defaults remain in unused/secondary primitives and several surfaces are cosmetic. |
| UX completeness | 3/10 | Core routes render, but loading, empty, offline, destructive confirmation, cancellation, and durable mutation states are incomplete. |
| Performance | 3/10 | Fonts and motion tokens exist, but provider calls observed 4.5–38.9 seconds, one request took 111 seconds, and no bundle/Lighthouse evidence exists. |
| Test quality | 2/10 | `24/24` tests pass, but they cover only classifier/router behavior; no coverage run is configured and no API/security/provider integration tests exist. |
| DX/CI | 3/10 | Strict TypeScript and a build exist, but lint fails, there is no GitHub Actions workflow, no hooks, and no documented reproducible benchmark command. |
| Portfolio readiness | 2/10 | README contains placeholder clone URL, stale stack claims, unsupported benchmark claims, no screenshots, no limitations section, and no license file. |

## 2. Findings

Sorted by priority. Line references are source evidence; runtime results are identified as runtime evidence.

| ID | Severity | Area | Evidence | Impact | Fix | Effort |
|---|---|---|---|---|---|---|
| AUTH-001 | P0 | API security | `src/app/api/route/route.ts:70-80`: `validateApiKey` runs, but the rejection branch is commented out. `src/app/api/keys/route.ts:1-18` imports no effective auth and returns keys. | Anyone who can reach the deployment can invoke the paid/free provider gateway, enumerate key metadata, or create keys. This is a production boundary failure. | Require Supabase session or API key auth in every protected route; return 401 before rate limiting/data access; add route tests for missing, invalid, revoked, and cross-user credentials. | M |
| AUTH-002 | P0 | Identity/data isolation | `src/app/api/keys/route.ts:34-40`: POST uses the hardcoded all-zero user UUID. `src/app/api/route/route.ts:80`: unauthenticated users become `anonymous`. `src/lib/db/schema.sql:44-46,85-91`: records are user-scoped. | Created keys and request logs cannot be reliably tied to the caller. With service-role queries, one user can receive another user's key list. | Establish Supabase Auth/session resolution, remove the demo UUID, use user-scoped queries, and test RLS plus route-level ownership. | L |
| RATE-001 | P0 | Abuse protection | `src/lib/middleware/rate-limiter.ts:115-145`: Redis errors are caught and requests are allowed. Runtime logs repeatedly reported `Rate limiting check failed — allowing request` with `fetch failed`. | A Redis outage disables the stated anti-abuse control exactly when an attacker can exploit degraded infrastructure. | Fail closed for authenticated production traffic, make fail-open an explicit local-only mode, emit a health signal, and test Redis timeout/error behavior. | M |
| RES-001 | P1 | Circuit breaker | `src/lib/core/circuit-breaker.ts:42-49,67-76,107-116`: breaker state is an in-memory `Map`; `isAvailable` allows every HALF_OPEN caller. | Vercel/serverless instances do not share breaker state, and concurrent probes can stampede a recovering provider. The README's stateful availability claim is not true across instances. | Store state/failure counters in Redis with atomic compare-and-set/lease for one probe; test multi-instance semantics and concurrent HALF_OPEN requests. | L |
| RES-002 | P1 | Failover correctness | `src/lib/core/router.ts:244-248`: when every candidate is unavailable, the router selects the first candidate anyway. `src/lib/core/router.ts:395-411`: exhausted execution returns simulated content with HTTP success. | An outage can be reported as a successful model response and pollute audit/cost metrics. A provider-down condition is hidden from clients. | Return a typed 503/provider-unavailable result after all candidates fail; expose fallback status separately; only enable demo mode behind an explicit development flag. | M |
| RES-003 | P1 | Streaming | `src/lib/core/router.ts:414-500`: stream fallback verifies only the first generator result; `src/app/api/route/route.ts:290-339`: a later provider error emits an SSE error and closes the stream without retrying or marking the request failed in the log. | Mid-stream provider failures lose partial-response semantics and do not attempt another provider. Clients cannot reliably distinguish a completed, partial, or failed response. | Define a resumable/partial-stream contract, cancel the failed generator, attempt fallback where safe, and persist an error/partial status. Add provider-generator tests. | L |
| AUTH-003 | P1 | API key verification | `src/lib/middleware/auth.ts:68-72`: hashes are compared with `===`; `src/lib/middleware/auth.ts:78-88`: `last_used_at` update is fire-and-forget and silently swallowed. | Hashing is correct but comparison is not constant-time, and usage auditing can silently disappear. | Use constant-time byte comparison and await or queue usage updates with observable failure handling. | S |
| API-001 | P1 | Error handling | `src/app/api/route/route.ts:247-258`: the catch response interpolates `error.message` into the client response. | Provider SDK messages can expose upstream URLs, configuration detail, or sensitive context. | Return a stable public error code/message; keep the detailed error only in sanitized structured logs. | S |
| API-002 | P1 | Idempotency | `src/app/api/route/route.ts:104-137`: idempotency returns a fabricated placeholder rather than the original content; `src/lib/db/schema.sql:105-108`: idempotency index is not unique. | Retries are not actually idempotent: the caller receives different content and concurrent duplicates can both execute. | Add a unique `(user_id,idempotency_key)` constraint, persist/retrieve response payloads, and handle in-flight conflicts transactionally. | M |
| POLICY-001 | P1 | Routing policy | `src/lib/core/router.ts:274-292`: `customRules` exists but the API call at `src/app/api/route/route.ts:165-170` never loads routing rules from Supabase. `src/app/dashboard/rules/page.tsx` keeps candidates in local React state and its Save action only clears `dirty`. | The Routing Policy screen looks durable but cannot change live routing. Portfolio claims of config-driven policy are false in the running app. | Add authenticated GET/PUT rule endpoints, load user/system rules into `selectRoute`, persist edits, and test policy precedence/ties/all-disabled behavior. | L |
| DATA-001 | P1 | Analytics truth | `src/app/dashboard/history/page.tsx:28-58`, `src/app/dashboard/stats/page.tsx:24-60`, and `src/app/dashboard/eval/page.tsx:21-58` contain fixed demo records/KPIs/results. | Users see data that is not derived from Supabase or live aggregation. This is misleading in a portfolio demo and makes operational decisions unsafe. | Back pages with authenticated queries/SQL aggregates; label demo mode conspicuously when no data source exists; add empty/loading/error states. | L |
| DATA-002 | P1 | Eval integrity | `src/app/api/eval/route.ts:23-40`: benchmark results use `Math.random()` for latency and a fixed quality score, and the POST ignores its `request` argument. | Eval results are non-reproducible and do not measure provider quality or latency. The UI can imply benchmark evidence that is fabricated. | Execute real provider calls behind a deterministic suite, persist runs, record actual usage/latency, and seed only declared fixtures. | L |
| ENV-001 | P1 | Configuration | `src/lib/env.ts` defines fail-fast validation, but `src/app/api/route/route.ts` reads `process.env` directly and does not import `env`. | Invalid production configuration is discovered lazily and inconsistently; deployment can start in a partially configured state. | Import the validated env object at server boundaries, separate build-safe validation from runtime validation, and add startup/config tests. | M |
| SSRF-001 | P1 | Provider security | `src/lib/env.ts` accepts any URL for `OLLAMA_BASE_URL`; `src/lib/providers/ollama.ts:43-48` passes it directly to the Ollama client. | A deployment operator or compromised config can direct server-side requests to internal metadata/services. | Enforce an explicit allowlist/private-network policy per deployment, block cloud metadata/link-local targets, and document the trust boundary. | M |
| UX-001 | P1 | Dashboard access | `src/app/page.tsx` redirects directly to `/dashboard`; `src/app/dashboard/layout.tsx` contains no auth gate. | The operational console is publicly reachable unless infrastructure protects it separately. | Add middleware/layout session enforcement and a public landing/onboarding route. | M |
| UX-002 | P1 | Destructive/mutation UX | `src/app/dashboard/keys/page.tsx` revokes locally with no confirmation and does not call `/api/keys`; `src/app/dashboard/rules/page.tsx` discards local state. | Users can believe a key was revoked or policy saved when nothing durable happened. | Wire mutations to authenticated APIs, add confirm dialogs, pending/error/success states, and refetch after mutation. | M |
| CORE-001 | P1 | Classifier calibration | Live 31-prompt probe through `/api/route` scored 25/31 (80.6%). Per class: code 5/5, summary 4/4, extraction 4/4, creative 3/3, reasoning 4/4, simple QA 4/4, translation 1/3, general 0/4. Confusion: translation→simple_qa 2; general→simple_qa 4. | The default rules classifier is overconfident on ambiguous/general questions and weak on multilingual phrasing. The hybrid threshold `0.5` in `src/lib/core/classifier.ts:300-306` is not calibrated to this measured error profile. | Add a versioned 30+ labeled suite to tests, calibrate confidence/reject-to-general behavior, add multilingual and injection cases, and report per-class metrics in CI. | M |
| CORE-002 | P1 | Retry budget | `src/lib/core/router.ts:341-390`: each candidate can receive three attempts with per-attempt timeout, but there is no global deadline; observed live requests took 29–38.9 seconds and one probe took 111 seconds. | `maxDuration=15` in `src/app/api/route/route.ts:35-36` conflicts with observed execution time and provider-level waits. Requests can outlive the route budget and consume provider quota. | Carry one deadline/AbortSignal through classification, retries, fallback, and streaming; cap total elapsed time and test it with fake timers. | M |
| CORE-003 | P1 | Cost/token accounting | `src/lib/core/router.ts:395-410` fabricates token counts and `$0.00001` cost in demo fallback; provider usage fields are allowed to default to zero in `src/lib/providers/ollama.ts:83-86`. | Analytics and cost controls can report false zero/near-zero spend or usage. | Centralize model pricing/version metadata, distinguish missing usage from zero, and mark simulated accounting explicitly. | M |
| LINT-001 | P1 | Code quality | `npm run lint` exits non-zero: `src/__tests__/core/router.test.ts:161` and `src/app/api/route/route.ts:332` use explicit `any`; 13 additional unused-symbol warnings remain. | CI cannot enforce the stated quality bar and dead code obscures operational paths. | Remove `any`, type the streaming classification object, and resolve unused imports/parameters before adding CI. | S |
| TEST-001 | P1 | Test coverage | `src/__tests__/core/router.test.ts` is the only test file and reports 24 passing tests. Coverage command could not run because `@vitest/coverage-v8` is not configured; no API, auth, rate-limit, persistence, provider, or stream tests exist. | The passing count does not protect the highest-risk behavior. | Add mocked-provider integration tests for route validation/auth/limits, breaker concurrency, retries, streaming failure, idempotency, and policy persistence; configure coverage thresholds. | L |
| PORT-001 | P1 | Portfolio claims | `README.md:91-104` claims 99.99% availability, `<50ms` failover, 1,000+ RPM, and sub-100ms TTFT without a reproducible benchmark. `README.md:128-130` still uses `https://github.com/your-username/ModelRoute.git`. | Hiring reviewers cannot distinguish demonstrated engineering from marketing claims; the clone command is not usable. | Replace claims with measured artifacts/scripts, add limitations and tradeoffs, fix repository URL, and include screenshots/GIFs. | S |
| UI-001 | P2 | Token compliance | `src/components/ui/*` still contains default shadcn `rounded-lg`, `shadow-md`, `duration-100`, and 3px rings; `src/components/design-system/TraceLine.tsx:68,89,112` uses hard-coded radius, shadow, and durations. | The documented token system is not universal; unused/secondary components can reintroduce the banned visual language. | Route all primitives through semantic tokens and motion constants, or delete unused legacy components. | M |
| UI-002 | P2 | Shell truthfulness | `src/app/dashboard/layout.tsx:171` renders `Healthy` for all providers and `:203` renders `CLOSED` unconditionally. | The shell presents provider and circuit state as live when it is cosmetic. | Add a server health/status endpoint and render actual per-provider breaker state with stale/error indicators. | M |
| UX-003 | P2 | Streaming UX | `src/app/dashboard/page.tsx:78-139` has no `AbortController`, reconnect, or explicit partial-failure state; response is plain text with no markdown/code rendering. | Long-running requests cannot be cancelled and partial output is easy to lose or misinterpret. | Add cancel/retry, preserve partial output with status, auto-scroll intentionally, and render trusted markdown/code safely. | M |
| UI-003 | P2 | Responsive/accessibility verification | Runtime route checks returned 200, but screenshots at 1440/1024/390, keyboard traversal, contrast, reduced-motion behavior, CLS, and Lighthouse were not captured because the browser tool was skipped. | These requirements remain UNVERIFIED rather than passing. | Run Playwright/Lighthouse at the three viewports and record screenshots/metrics in CI or the audit artifact. | M |
| REPO-001 | P2 | Repository hygiene | Inventory shows `.DS_Store` files under `src/`; no `.github` workflow, `LICENSE`, `CHANGELOG`, issue templates, or pre-commit hooks. | Noise and missing automation reduce trust and make regressions likely. | Remove OS artifacts, add MIT license if intended, add CI, commit conventions, templates, and a changelog. | S |
| DEP-001 | P1 | Dependencies | `npm audit --json` reports 13 vulnerabilities: 5 moderate, 7 high, 1 critical across 886 dependencies. | The dependency graph has known security exposure; exact remediation must be reviewed before forcing upgrades. | Run a dependency/CVE remediation pass, update lockfile safely, and re-run audit/build/tests. | M |

## 3. Fake, Mocked, or Cosmetic Inventory

| Surface | Evidence | Actual behavior |
|---|---|---|
| Dashboard circuit breaker | `src/app/dashboard/layout.tsx:171,203` | Always displays Healthy/CLOSED; no status fetch. |
| Infrastructure latency | `src/app/dashboard/layout.tsx:145-163` | Fixed `210 ms`, `450 ms`, and `Ready` values. |
| Audit logs | `src/app/dashboard/history/page.tsx:28-58` | Three hardcoded rows; no API query, pagination, or date filter. |
| Analytics | `src/app/dashboard/stats/page.tsx:24-60` | Fixed KPI values, chart series, and provider percentages. |
| Eval results | `src/app/dashboard/eval/page.tsx:21-58` | Seeded results remain visible; API returns random latency and fixed quality. |
| API credentials | `src/app/dashboard/keys/page.tsx` | Create/revoke state is client-only; server route is not called by the page. |
| Routing Policy | `src/app/dashboard/rules/page.tsx` | Reorder/save only mutates local React state; live route never receives rules. |
| Provider-down response | `src/lib/core/router.ts:395-411` | Exhausted providers return fabricated demo content with success semantics. |
| Idempotency | `src/app/api/route/route.ts:115-132` | Returns a placeholder response, not the original response body. |
| README metrics | `README.md:91-104` | No benchmark script or evidence was found; claims are not reproducible. |

## 4. Missing Features and Recommended Build Order

| Feature | Status | Effort | Impact | Build order |
|---|---|---:|---:|---:|
| OpenAI-compatible `/v1/chat/completions` | MISSING | L | High | 5 |
| Model catalog with pricing/context/latency | MISSING | M | Medium | 9 |
| Per-key budgets and quotas | MISSING | M | High | 4 |
| Request replay from audit logs | MISSING | M | Medium | 8 |
| Exact/semantic response caching | MISSING | L | Medium | 11 |
| A/B routing and shadow traffic | MISSING | L | High | 12 |
| Automatic policy tuning from evals | MISSING | L | Medium | 13 |
| Breaker-trip webhooks/alerts | MISSING | M | Medium | 10 |
| CSV/JSON export | PARTIAL | S | Medium | 7 |
| Team/workspace plus Supabase Auth | PARTIAL | L | Critical | 1 |
| Per-request tracing timeline | PARTIAL | M | High | 3 |
| OpenTelemetry export | MISSING | M | Medium | 6 |
| Public status page | MISSING | M | Low | 14 |
| k6 load-test benchmark and published results | MISSING | M | High | 2 |
| Typed SDK or UI curl/TS/Python snippets | MISSING | M | High | 6 |
| Onboarding/empty-dashboard flow | PARTIAL | M | High | 1 |
| Docs site or `/docs` page | MISSING | M | Medium | 7 |

Recommended sequence: enforce identity and safe failure first; establish reproducible load/eval evidence; add request tracing and quotas; then expose integrations and portfolio-facing documentation.

## 5. Top 10 Highest-ROI Changes

1. Enforce authentication and user ownership on dashboard, `/api/route`, `/api/keys`, and every future mutation.
2. Remove fabricated success/demo fallback from production semantics; return typed 503s and make demo mode explicit.
3. Move breaker state to Redis with an atomic single-probe lease and test concurrent transitions.
4. Make Redis rate-limit failure fail closed in production and add observable health/degraded headers.
5. Persist routing rules and wire the Policy UI to the live selector with precedence/tie tests.
6. Add one 30+ case classifier suite to CI; fix general/translation confusion and calibrate confidence.
7. Add a global deadline/AbortController across retries, provider calls, and streaming.
8. Replace seeded analytics/eval/history numbers with authenticated SQL-backed data and truthful empty states.
9. Add API/security/provider integration tests plus coverage thresholds; make lint pass.
10. Rewrite README claims around reproducible benchmark scripts, screenshots, limitations, architecture accuracy, and a working clone URL.

## 6. Verification Log

| Check | Result | Evidence |
|---|---|---|
| `npm run lint` | FAIL | Exit non-zero: 2 errors (`no-explicit-any` at the test and route streaming cast) and 13 warnings. |
| `npx tsc --noEmit` | PASS | Exit 0 after clearing generated `.next` declarations. |
| `npm test` | PASS | 1 test file, 24 tests passed. |
| `npm test -- --coverage` | UNAVAILABLE | Vitest reported missing `@vitest/coverage-v8` and prompted to install it; no coverage report was produced. The prompted package was removed afterward to preserve the read-only dependency baseline. |
| `npm run build` | PASS | Next 16.2.12 build completed; 10 routes generated. |
| `npm audit` | FAIL/RISK | 13 vulnerabilities: 5 moderate, 7 high, 1 critical; 886 total dependencies. |
| Page GETs | PASS | `/`, `/dashboard`, `/dashboard/history`, `/dashboard/stats`, `/dashboard/rules`, `/dashboard/eval`, `/dashboard/keys` returned 200; `/` redirected to dashboard before final 200. |
| API GETs | PASS | `/api/eval` and `/api/keys` returned 200. `/api/keys` returned `{"keys":[]}` in the current environment. |
| Valid route POST | PASS with risk | `POST /api/route` with a valid prompt returned 200, but runtime took 7.0s and emitted a rate-limit Redis failure that allowed the request. |
| Invalid JSON | PASS | Returned 400 with `INVALID_JSON`. |
| Empty prompt | PASS | Returned 400 with `VALIDATION_ERROR`. |
| 100,001-character prompt | PASS | Returned 400 with `VALIDATION_ERROR`/max-length issue. |
| Streaming route | PASS with risk | Returned 200 SSE routing/content events; later live probes showed provider 503s followed by fallback and long 5.8–38.9s responses. |
| Rate-limit rejection | UNVERIFIED | Current Redis failure path always allowed; no reachable healthy Upstash instance was available to produce a real 429. |
| Provider-down path | PARTIAL | Runtime logs captured Gemini 503 and stream fallback; Ollama-down behavior was not isolated from the configured live providers. |
| 31-case classifier probe | FAIL | 25/31 correct (80.6%): general 0/4, translation 1/3; all general cases became simple_qa. |
| Browser screenshots | UNVERIFIED | Browser tool invocation was skipped; no 1440/1024/390 screenshots captured. |
| Lighthouse | UNVERIFIED | No Lighthouse runner or browser session was available after the screenshot tool was skipped. |

## Solid Areas

- Zod validation catches malformed JSON, empty prompts, and oversized prompts at the main route boundary (`src/app/api/route/route.ts:44-68`).
- API keys are generated with 32 random bytes and SHA-256 storage intent (`src/lib/middleware/auth.ts:104-124`).
- The routing unit suite covers basic classifier, priority, fallback-list, and breaker behavior, and all 24 tests currently pass.
- Structured logs include correlation IDs in the main route (`src/app/api/route/route.ts:39-41`) and the logger sanitizes common secret/prompt keys (`src/lib/logger.ts:86-112`).

## Hiring-Manager Stories to Build

1. **Multi-instance resilience:** prove a Redis-backed breaker with atomic HALF_OPEN leases, concurrent probe tests, and a k6 outage benchmark.
2. **Truthful failover and streaming:** show a provider 503 during SSE, preserve partial output, retry safely, and emit a trace timeline with a typed terminal status.
3. **Cost and policy correctness:** show persisted per-user policies, model-versioned pricing, token fallback semantics, and reproducible cost/latency evaluation data.
