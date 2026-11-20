# Secure Gemini API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every Gemini operation behind validated Vercel Functions so no Gemini credential is included in browser assets.

**Architecture:** Browser code sends same-origin JSON requests to three operation-specific endpoints. Shared server-only modules own Gemini SDK access, request validation, normalized errors, and best-effort IP rate limiting.

**Tech Stack:** React 19, TypeScript, Vite 6, Vercel Node.js Functions, `@google/genai`, Vitest.

## Global Constraints

- `GEMINI_API_KEY` is read only under `api/`.
- No `VITE_` secret variable and no Vite `define` injection.
- Do not print or commit any secret value.
- Preserve existing UI behavior and browser-side response caching.
- Reject a declared body over 4,000,000 bytes before application parsing; enforce the same ceiling incrementally for raw request streams and conservatively for platform-parsed bodies.
- Keep imports at module scope.

---

### Task 1: API Validation and Rate-Limit Foundation

**Files:**
- Create: `api/_lib/http.ts`
- Create: `api/_lib/rate-limit.ts`
- Test: `api/_lib/http.test.ts`
- Test: `api/_lib/rate-limit.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: request parsing, JSON response, method guard, client-IP extraction, typed field validators, and `checkServerRateLimit(key, now?)`.
- Consumes: Web/Node request headers and bodies supplied by Vercel.

- [ ] Add Vitest and a `test` script.
- [ ] Write failing tests proving invalid methods, content types, oversized declared/raw/platform-parsed bodies, malformed fields, and exhausted rate-limit windows are rejected.
- [ ] Run the focused tests and confirm failures are caused by missing implementations.
- [ ] Implement only the shared utilities required by the tests.
- [ ] Run the focused tests and confirm all pass.

### Task 2: Server-Only Gemini Operations and Endpoints

**Files:**
- Create: `api/_lib/gemini.ts`
- Create: `api/analyze.ts`
- Create: `api/visualize.ts`
- Create: `api/shopping-list.ts`
- Test: `api/_lib/handlers.test.ts`

**Interfaces:**
- Consumes: validated analyze, visualization, and shopping-list payloads.
- Produces: `AnalysisResult`, image data URL, and `ShoppingList` JSON responses.

- [ ] Write failing handler tests for POST-only behavior, missing configuration, invalid input, and normalized errors.
- [ ] Run the tests and verify expected failures.
- [ ] Move prompts, schemas, SDK initialization, analysis, visualization generation, and shopping-list generation into `api/_lib/gemini.ts`; remove the invalid cross-model context-cache path so clients cannot supply shared-credential cache resource names.
- [ ] Implement three endpoint handlers using shared validation and rate limiting.
- [ ] Run handler and utility tests until all pass.

### Task 3: Browser API Client and Build Secret Removal

**Files:**
- Modify: `services/gemini.ts`
- Modify: `vite.config.ts`
- Modify: `App.tsx` only if exported client signatures require adaptation.
- Test: `services/gemini.test.ts`

**Interfaces:**
- Consumes: compressed base64 images and existing UI arguments.
- Produces: the same promises and result types currently consumed by `App.tsx`.

- [ ] Write failing client tests proving each operation calls the expected same-origin endpoint and surfaces JSON errors.
- [ ] Run the client tests and verify expected failures.
- [ ] Replace browser SDK calls with a shared `fetch` helper while retaining image compression.
- [ ] Remove `loadEnv` and all Vite `define` substitutions.
- [ ] Run client tests and type checking.

### Task 4: Repository and Deployment Hygiene

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: safe local and Vercel configuration instructions.

- [ ] Change `.gitignore` to ignore `.env*` and explicitly allow `.env.example`.
- [ ] Add a secret-free example containing only the variable name and placeholder.
- [ ] Document local `vercel dev` usage and the required Vercel project setting for `GEMINI_API_KEY`.
- [ ] Confirm no environment file containing a credential is tracked.

### Task 5: Full Verification and Shipping

**Files:**
- Review all changed files.

**Interfaces:**
- Produces: a committed branch and review-ready pull request.

- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Scan `dist/` for `AIza` and `GEMINI_API_KEY`; require zero matches.
- [ ] Scan non-history source to confirm Gemini SDK and secret access are server-only.
- [ ] Inspect the diff for accidental secret output.
- [ ] Commit logical changes, push the feature branch, and create a pull request whose description tells the owner to configure `GEMINI_API_KEY` in Vercel before merging.
