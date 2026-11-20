# Secure Gemini API Design

## Goal

Prevent the Gemini API key from reaching browser code while preserving image analysis, paint visualization, shopping-list generation, caching, loading states, and user-facing errors.

## Approaches Considered

1. **Three operation-specific Vercel Functions (selected).** Each Gemini operation gets a narrow POST endpoint and explicit request validation. This adds a few small files but provides the clearest security boundary.
2. **One action-based Vercel Function.** This reduces endpoint count, but creates a broad union payload and makes per-operation limits and validation easier to get wrong.
3. **A separate backend service.** This offers stronger centralized rate limiting but adds hosting and operational dependencies that are unnecessary for this focused fix.

## Architecture

- `services/gemini.ts` remains browser-safe. It retains image compression and exports same-origin API client functions.
- `api/analyze.ts`, `api/visualize.ts`, and `api/shopping-list.ts` accept only POST requests.
- `api/_lib/gemini.ts` is the only module that imports `@google/genai` or reads `process.env.GEMINI_API_KEY`.
- Shared API utilities enforce a request body ceiling below Vercel's platform limit, validate every field, normalize errors, and apply a best-effort fixed-window rate limit by forwarded client IP.
- The existing client-side limiter remains for UX and cost feedback, but is not treated as a security control.
- The previous context-cache path is removed: it created a cache for the analysis model but attempted to consume it with the image model, and exposing cache resource names to the browser would let callers reference resources under the shared server credential. Existing browser response caching remains unchanged.

## Data Flow

1. The browser validates and compresses an uploaded image exactly as it does today.
2. The browser sends JSON to a same-origin `/api/*` endpoint.
3. The endpoint validates method, content length, rate limit, JSON shape, and field bounds.
4. Server-only code creates a Gemini client from `GEMINI_API_KEY` and performs the operation.
5. The endpoint returns the same typed result the UI currently consumes.
6. Errors return a stable JSON `{ "error": "..." }` shape without exposing credentials or provider internals.

## Abuse Protection

- POST-only endpoints with `Allow: POST` on method failures.
- JSON content type required.
- Four-megabyte application request ceiling: declared lengths are rejected before application parsing, raw streams are bounded while reading, and platform-parsed bodies receive a conservative serialized-size fallback.
- Image payloads must be bounded base64 strings.
- Text, color, cache-name, and area fields are constrained.
- Best-effort in-memory fixed-window limiting per client IP. This intentionally adds no paid service; because serverless instances do not share memory, it complements rather than replaces Vercel Firewall rate limiting.

## Secret Hygiene

- Remove Vite `define` substitutions and unrestricted `loadEnv`.
- Ignore `.env*` while explicitly allowing a secret-free `.env.example`.
- Do not commit an actual `.env` or secret.
- Document `GEMINI_API_KEY` as a Vercel server environment variable and local `vercel dev` setup.
- Scan source, built output, tracked files, and git history without printing matching secret values.

## Verification

- Unit tests cover method enforcement, payload validation, API error behavior, and rate limiting.
- Type checking covers both browser and server modules.
- `npm run build` must exit successfully.
- `dist/` must contain neither `AIza` nor `GEMINI_API_KEY`.
- Source imports of `@google/genai` and reads of `GEMINI_API_KEY` must be confined to `api/`.
