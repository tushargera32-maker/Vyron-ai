# AETHER Development Plan (Authoritative Roadmap)

AETHER is a lightweight, local-first personal AI brain for Windows (Next.js + TypeScript + Tailwind + SQLite). **There must NEVER be more than 5 major phases in AETHER.**

**Constraints (all phases):** local-first, Windows-compatible, no QNAP dependency, no Docker, no PostgreSQL, no Redis, no mandatory paid API services, no microservices/heavy local LLMs, server-side secrets only, repository-based DB access, modular providers, and no automatic memory overwriting/training.

**Working agreement:** do not generate the entire application in one unreviewed operation; major architecture changes require approval. After each implementation phase run type checks, lint, tests, fix errors, document completed work, and pause for explicit approval before starting the next phase.

---

## Consolidated 5-Phase Roadmap

### Phase 1 — Architecture & Documentation
**Status: COMPLETE**

**Scope**
- System architecture
- Technical specifications
- Database schema
- Development guidelines

**Completed work (preserved)**
- Inspected environment (Windows local, Node `v22.22.3`, npm `11.17.0`, git `2.55.0.windows.4`).
- Created foundational documentation: `ARCHITECTURE.md`, `AGENTS.md`, `DATABASE_SCHEMA.md`, and this roadmap (`DEVELOPMENT_PLAN.md`).
- Defined module boundaries, local-first/security principles, repository/migration conventions, and phased quality gates.

---

### Phase 2 — Core Foundation
**Status: COMPLETE**

**Scope**
- Next.js App Router + TypeScript + Tailwind UI
- Premium dark dashboard
- SQLite persistence layer
- WAL + FTS5
- Database migrations and repositories
- AI provider abstraction
- OpenAI-compatible adapter
- Mock provider
- Streaming, retries and error handling
- Usage tracking foundation

**Consolidated completed work (preserved: existing 7-route dashboard + DB/AI infrastructure)**
- **UI foundation:** Scaffolded Next.js App Router app with Tailwind and shadcn/ui-compatible components; premium dark dashboard shell/sidebar/page headers and 7 routes: `/` (Chat), `/projects`, `/memory`, `/knowledge`, `/agents`, `/models`, `/usage` (UI scaffolds/placeholders, local-only).
- **SQLite persistence:** `better-sqlite3` server-only DB layer (`data/aether.db`, WAL, `foreign_keys=ON`), versioned SQL migrations (`src/lib/db/migrations/`, `schema_migrations`), initial schema + FTS5 tables (`messages_fts`, `memories_fts`, `document_chunks_fts`), health checks, backup/restore basics, repository interfaces/implementations for core entities (projects, conversations/messages, memories, documents, agents, feedback, usage, audit), and Vitest temp-DB tests.
- **AI provider foundation:** Interchangeable provider contract and server-side config (Zod, env-based, no hardcoded keys), OpenAI-compatible adapter (configurable base URL/model/API key, streaming + non-streaming), mock provider, standardized errors, timeout + retry/backoff handling, and SQLite `usage_events` tracking foundation with mocked API/failure/timeout/retry/stream tests.
- **Quality checks completed:** typecheck, lint, tests, and production build passed during implementation phases.

---

### Phase 3 — Intelligent AI Brain
**Status: COMPLETE**

**Scope**
- Functional Chat Engine
- Conversation and message persistence
- Streaming chat interface
- Persistent long-term memory
- Memory extraction, categorization and retrieval
- Knowledge base and document ingestion
- Semantic and keyword search
- RAG implementation
- Context management

**Completed work**
- **Chat engine:** Connected Chat UI to existing provider abstraction (mock + OpenAI-compatible), real-time SSE streaming, persistent conversations/messages in SQLite, create/rename/delete/switch/search/recover conversations, recent history context, model/provider/session prompt selection, stop generation, interrupted/error handling, retry without duplicating user messages, loading/error/empty states, and server-side usage/latency tracking.
- **Long-term memory:** Structured memories (working/episodic/semantic/procedural) with deterministic/cost-conscious candidate extraction and proposal flow, tags/importance/confidence, dedupe hash detection, approval/rejection/edit/archive/delete controls, FTS-backed retrieval, retrieval event tracking, and context injection of approved memories only (no auto-save of every message as permanent approved memory).
- **Knowledge base + RAG:** Local ingestion for PDF/TXT/Markdown/DOCX (upload validation/size/type limits, safe managed storage), text extraction/cleaning/chunking, SQLite storage for documents/chunks/metadata, FTS5 keyword search, provider-independent local semantic embeddings fallback (hash vectors stored in SQLite), hybrid keyword+semantic retrieval, source-referenced context/results, and document list/view/delete/reprocess with safe handling of unsupported/empty/corrupted/oversized files.
- **Context intelligence:** Unified context builder loads recent history, retrieves relevant approved memories and knowledge chunks, ranks/dedupes/limits context, separates system instructions, retrieved memories, retrieved knowledge, history, and current user message, and sends structured prompts through existing provider interface.
- **UI integration:** Functional Chat, Memory, Knowledge, Models, and Usage pages integrated with APIs/SQLite while preserving premium dark dashboard and existing routes (Projects preserved). Reusable components and clear feedback states added.
- **Technical:** Reused existing SQLite/WAL/FTS5, migrations/repositories, AI provider interface/mock provider, server-side API-key handling, Zod-validated APIs, TypeScript conventions, local-first Windows-compatible design.

**Checks (Phase 3)**
- [x] `npm run typecheck` — passed
- [x] `npm run lint` — passed (0 errors, warnings only)
- [x] `npm test` — passed (**6 files, 25 tests**)
- [x] `npm run build` — passed (Next.js 16.4.6; UI + API routes built)

**Exit criteria**
- Functional, persistent, streaming chat with memory and knowledge/RAG retrieval integrated; tests and docs updated. Phase 4 not started (awaiting explicit approval).

---

### Phase 4 — Autonomous Agent System
**Status: PLANNED**

**Scope**
- Multi-agent architecture
- Specialist agents (Research, Coding, Design, Marketing, Personal Assistant)
- Tool registry and execution
- Permission and approval system
- Task planning and orchestration
- Multi-step task execution
- Workflow automation
- Execution history and audit logs

**Planned outcomes**
- In-process multi-agent framework with specialist profiles, planner/orchestrator, validated tool registry, least-privilege permissions and approval gates.
- Auditable multi-step execution history for agent runs and tool invocations, integrated with existing memory/knowledge/chat foundations.

**Exit criteria (high level)**
- Specialist agents can plan and execute approved multi-step workflows safely with auditability; tests and docs updated; explicit approval required before Phase 5.

---

### Phase 5 — Learning, Security & Production
**Status: PLANNED**

**Scope**
- Feedback collection
- Evaluation and quality measurement
- Adaptive model/provider routing
- Memory optimization
- Security hardening
- Data privacy and backup/restore
- Performance optimization
- Comprehensive testing
- Error monitoring and reliability
- Final production-ready local deployment
- Complete technical documentation

**Planned outcomes**
- Feedback/evaluation loops and adaptive routing/optimization informed by local metrics (no automatic training/memory overwrite).
- Hardened security/privacy controls, robust backup/restore and reliability, performance tuning, comprehensive test coverage, and complete operational/technical documentation for production-ready local use.

**Exit criteria (high level)**
- Production-ready, secure, reliable, well-documented local AETHER release meeting roadmap goals within the 5-phase limit.

---

## Progress Summary
- **Phase 1:** COMPLETE
- **Phase 2:** COMPLETE (consolidated foundation: 7-route dashboard, SQLite/WAL/FTS5/migrations/repos, AI provider abstraction/OpenAI-compatible+mock/streaming/retries/errors/usage tracking)
- **Phase 3:** COMPLETE (chat engine, long-term memory, knowledge base/RAG, context intelligence, UI/API integration, tests/docs)
- **Phase 4:** PLANNED (awaiting explicit approval before implementation)
- **Phase 5:** PLANNED

**Roadmap rule:** this document is the authoritative roadmap; do not introduce additional major phases.
