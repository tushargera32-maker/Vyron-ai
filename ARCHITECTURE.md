# AETHER Architecture

## 1. Overview
AETHER is a lightweight, local-first personal AI brain built as a single Next.js application. It provides chat, memory, knowledge ingestion/search, specialist agents, feedback/evaluation, and model routing with free-tier/OpenAI-compatible providers. All private data remains on the local filesystem.

**Primary goals**
- Modular, maintainable codebase with clear boundaries.
- Zero mandatory paid infrastructure (no QNAP, no GPU, no paid APIs, no Redis/PostgreSQL/microservices/heavy local LLMs).
- Secure-by-default local data handling and explicit user approval for sensitive/destructive actions.

**Non-goals (initial)**
- Automatic model fine-tuning or training.
- Automatic memory overwriting without user approval.
- Distributed services or background worker clusters.
- Multi-user/cloud sync.

## 2. High-level Architecture

```text
Next.js App Router (UI + Route Handlers)
├─ app/                    # Pages/layouts and API routes (HTTP boundary, Zod validation)
│  ├─ api/chat/            # Streaming chat endpoint (SSE)
│  ├─ api/conversations/   # Conversation CRUD/search
│  ├─ api/memories/        # Memory list/propose/approve/reject/edit/archive/delete
│  ├─ api/knowledge/       # Document upload/list/search/reprocess/delete
│  ├─ api/usage/           # Local usage totals/events
│  └─ api/models/          # Server-side provider config (no secrets exposed)
├─ components/             # UI (shadcn/ui + Tailwind), dashboard and feature clients
├─ lib/
│  ├─ ai/                  # Provider abstraction, OpenAI-compatible + mock, streaming, retries/errors, usage tracking
│  ├─ chat/                # Chat orchestration/persistence (streaming, retries-safe behavior)
│  ├─ context/             # Unified context builder (history + memory + knowledge + ranking/dedupe/limits)
│  ├─ memory/              # Memory extraction/proposal/retrieval/service
│  ├─ knowledge/           # Extraction, chunking, embeddings fallback, hybrid search, ingestion service
│  ├─ storage/             # Managed local file storage and path safety
│  ├─ db/                  # SQLite client, migrations, repositories (data access layer)
│  └─ utils/               # Shared utilities
├─ data/
│  ├─ aether.db            # SQLite database (gitignored)
│  ├─ uploads/             # Ingested knowledge files (gitignored)
│  └─ backups/             # DB backups (gitignored)
└─ tests/                  # Vitest unit/integration tests (DB, AI, chat, memory, knowledge, context)
```

## 3. Runtime & Deployment Model
- **Runtime:** Local Node.js process running Next.js (dev/prod) on Windows.
- **Server-only secrets:** API keys and provider configs loaded from environment variables / local config files read server-side only; never sent to browser.
- **Storage:** SQLite for structured data + FTS5 for full-text search; local filesystem for documents/blobs.
- **No external dependencies required:** App must function (UI + local data management) without any configured AI provider; AI features degrade gracefully.

## 4. Core Modules (Phase 3 implemented)

### 4.1 AI Chat (implemented)
- **Responsibilities:** Conversation CRUD/search, streaming assistant responses, model/provider selection, system prompt management, persistent history and recovery.
- **Key pieces:** `app/api/chat/route.ts` (SSE streaming), `app/api/conversations/*`, `src/lib/chat/service.ts`, `src/lib/ai/*`.
- **Streaming:** Server streams JSON events (`delta`, `done`, `error`) over SSE; client supports stop, incremental render, and retry-safe handling (no duplicate user messages on naive retry).
- **Persistence:** User/assistant messages and conversation metadata stored in SQLite with token/latency/error tracking hooks.

### 4.2 Memory Engine (implemented)
- **Memory types:** working, episodic, semantic, procedural.
- **Lifecycle:** deterministic/cost-conscious candidate extraction from messages -> **proposed** -> user approve/reject/edit/archive/delete (no automatic overwrite/save of every message).
- **Quality controls:** normalized dedupe hash detection, importance/confidence, provenance links, metadata/tags, `memory_events`, and retrieval event tracking.
- **Retrieval:** approved-memory search via FTS5/filters and injection into chat context (ranked/limited).

### 4.3 Knowledge Engine + RAG (implemented)
- **Ingestion:** upload/import PDF, TXT, Markdown, DOCX with validation, size/type checks, and managed local storage (`data/uploads`).
- **Processing:** extract/clean text, chunking, document/chunk persistence in SQLite, FTS5 indexing (`document_chunks_fts`).
- **Semantic/hybrid search:** provider-independent local embedding fallback (hash vectors in `chunk_embeddings`, SQLite-only) combined with keyword search for hybrid retrieval.
- **RAG:** relevant chunks retrieved with source references (document/chunk) for context and UI display; supports delete/reprocess and safe failure states.

### 4.4 Context Intelligence (implemented)
- **Unified builder:** `src/lib/context/builder.ts` loads recent conversation history, retrieves relevant approved memories and knowledge chunks, ranks/dedupes/truncates, and constructs structured prompts.
- **Prompt composition:** separates system instructions, retrieved memories, retrieved knowledge, and conversation messages/current user input; respects lightweight context limits.

### 4.5 Model/Provider Layer (implemented foundation)
- **Provider abstraction:** interchangeable adapters (`openai-compatible`, `mock`) with server-side config (env/Zod), no hardcoded/browser-exposed keys.
- **Reliability:** streaming/non-streaming, timeout/retry/backoff, standardized errors, and SQLite `usage_events` tracking.

### 4.6 Agent System (planned, Phase 4)
- **Specialists:** personal, research, design, coding, marketing agents with scoped prompts/capabilities.
- **Planner/tools:** task decomposition, tool registry/execution, least-privilege permissions/approvals, auditable multi-step runs.

### 4.7 Learning, Security & Production (planned/ongoing hardening, Phase 5)
- **Learning:** feedback, evaluation, adaptive routing/optimization (no automatic training/memory overwrite).
- **Hardening:** security/privacy, performance, backup/restore reliability, comprehensive testing, monitoring, and production-ready local deployment.

### 4.8 Dashboard
- **Premium dark UI** using Tailwind + shadcn/ui.
- **Functional sections (Phase 3):** chat, projects (preserved), memory explorer, knowledge library, agent manager (scaffold), model settings, usage dashboard.

## 5. Data & Persistence
- **SQLite (single file)** with migrations; WAL mode for local concurrency.
- **FTS5** virtual tables for message/memory/knowledge search (kept in sync via app-level writes or triggers where appropriate).
- **Repository layer:** all DB access behind repositories/interfaces to keep schema changes localized and testable.
- **Backups:** versioned migrations and on-demand/scheduled local backup/export of DB and referenced files manifest.

## 6. Security Architecture
- **Validation:** Zod schemas on every API request/route handler input and file upload metadata.
- **Uploads:** allowlisted MIME/types, strict size limits, randomized storage names, path normalization, traversal prevention.
- **Content safety:** sanitize/escape rendered document content; store raw + sanitized forms as needed.
- **Execution safety:** never execute arbitrary AI-generated shell commands; tool execution mediated and permission-checked.
- **Approvals & audit:** require approval for destructive actions (delete/overwrite/export of sensitive data as applicable); append-only audit logs for key actions.

## 7. Error Handling & Resilience
- Typed error boundaries between UI/API/domain/infrastructure layers.
- Provider failures surfaced with actionable, non-sensitive messages; automatic fallback/retry per policy.
- Graceful degradation when AI/providers unavailable (local browse/search/manage still works).

## 8. Testing Strategy
- **Unit tests:** repositories (with temp SQLite), retrieval/ranking, dedupe, validators, router retry/fallback logic.
- **Integration tests:** API route handlers for chat/memory/knowledge flows; provider failure simulations/mocks.
- **Required focus areas:** memory retrieval correctness and provider failure handling (rate limits, timeouts, malformed responses).
- **Quality gates per phase:** type checks, tests, lint/format (when configured), and documentation updates.

## 9. Extensibility Guidelines
- Add providers by implementing the provider interface and registering in router config.
- Add agents/tools by defining capability descriptors and permission policies.
- Add ingestion types via pluggable extractors behind a common interface.
- Keep modules dependency-directed: `app -> lib/services -> repositories/storage/ai adapters`.
