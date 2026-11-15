# AETHER Agents

This document defines the agent system for AETHER: roles, capabilities, permissions, and execution rules.

## 1. Principles
- **Lightweight, in-process:** agents are orchestration profiles (prompts + policies + tool access), not separate services.
- **Least privilege:** each agent has an explicit allowlist of tools/actions; default deny.
- **User control:** memory saves, destructive actions, and sensitive exports require user approval.
- **Traceability:** agent runs, tool calls, model usage, and outcomes are auditable.
- **Safety:** never execute arbitrary AI-generated shell commands; all side effects go through validated tools.

## 2. Common Agent Contract
Each agent definition includes:
- **Identity:** `id`, `name`, `description`.
- **System prompt:** role, objectives, constraints, output style.
- **Capabilities:** allowed tool categories (chat, search, read, write-local-managed, planning, etc.).
- **Permissions policy:** per-tool allow/deny, approval requirements, scope limits (project/path).
- **Context policy:** what memory/knowledge sources may be retrieved and injected.
- **Model policy:** preferred model(s)/provider fallback via router (no hardcoded keys).

## 3. Specialist Agents

### 3.1 Personal Agent
- **Purpose:** general assistant for daily tasks, planning, and conversation grounded in user-approved memory.
- **Typical tasks:** summarize discussions, draft plans, recall preferences/facts, organize projects.
- **Tools:** chat/context, memory retrieval (read), propose memory saves (requires approval), project/task notes.
- **Restrictions:** cannot modify/delete memories or files without explicit user action/approval.

### 3.2 Research Agent
- **Purpose:** gather, synthesize, and cite information from ingested knowledge and (optionally) configured web/search tools if added later.
- **Typical tasks:** literature/doc summaries, comparisons, question answering with source references.
- **Tools:** knowledge search, document chunk retrieval, note drafting.
- **Restrictions:** must cite local sources when used; no external side effects without approval.

### 3.3 Design Agent
- **Purpose:** UX/UI, information architecture, and content/design planning for AETHER and user projects.
- **Typical tasks:** wireframe descriptions, component proposals, design critiques, copy/layout suggestions.
- **Tools:** read project knowledge/memory (scoped), generate artifacts as text/markdown in managed locations.
- **Restrictions:** no destructive file operations; changes proposed as diffs/plans unless explicitly approved.

### 3.4 Coding Agent
- **Purpose:** implementation planning and code changes within the local workspace following project conventions.
- **Typical tasks:** implement features, refactors, tests, bug fixes, documentation updates.
- **Tools:** code search/read/edit/write (scoped to workspace), run approved checks (typecheck/tests) via controlled commands.
- **Restrictions:** no arbitrary shell execution from model output; destructive operations require approval; respect architecture rules.

### 3.5 Marketing Agent
- **Purpose:** messaging, positioning, and content drafts for user projects/products.
- **Typical tasks:** landing copy, release notes, campaign ideas, audience framing.
- **Tools:** knowledge/memory retrieval (scoped), document drafting/export in managed paths.
- **Restrictions:** no external publishing actions; exports/saves require approval where applicable.

## 4. Task Planner
- **Role:** shared planning capability usable by agents to break goals into steps, track status, and request approvals.
- **Outputs:** structured plan (steps, dependencies, required tools/permissions, expected artifacts).
- **Behavior:** re-plans on failures/new info; pauses for user approval at gated actions.
- **Persistence:** plans and step states stored locally for resumability and audit.

## 5. Tool Permission System

### 5.1 Permission Model
- **Scopes:** global, project, path/glob, resource id (conversation/memory/document).
- **Decisions:** `allow`, `deny`, `require_approval`.
- **Evaluation order:** explicit deny > require approval > allow > default deny.

### 5.2 Tool Categories (initial)
- **Read-only:** search knowledge, retrieve memories, list projects/models/usage.
- **Write-managed:** create/update drafts, save approved memories, ingest documents to managed storage.
- **Destructive:** delete memory/document/project data, overwrite files, purge backups (always `require_approval`).
- **Execution:** run predefined validation commands (typecheck/tests) under Coding Agent policy only.

### 5.3 Approval & Auditing
- Approval prompts must describe action, scope, and impact.
- All tool invocations record: timestamp, agent, user/session, tool, inputs (redacted as needed), result/status.
- Failures and denied actions are logged for diagnostics and learning feedback (without leaking secrets).

## 6. Memory & Knowledge Interaction Rules
- Agents may **suggest** memory captures; persistence occurs only after user approval.
- Retrieval must respect project scoping and user intent; include provenance (source ids/references).
- Knowledge citations should reference document/chunk identifiers for traceability.

## 7. Model Routing Integration
- Agents request capabilities (chat/streaming/context size preference) rather than hardcoded providers.
- Router selects available free-tier/OpenAI-compatible models, applies fallback/retry/backoff, and records usage.
- On provider failure, agents degrade gracefully and report actionable status.

## 8. Extending the Agent System
- Add a new agent by creating a definition (prompt + capabilities + permission policy + context/model preferences) and registering it.
- Add tools via a typed interface with schema validation, permission metadata, and audit hooks.
- Prefer composition (shared planner/retrieval/tooling) over duplicating logic per agent.
