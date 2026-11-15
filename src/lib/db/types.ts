export type ID = string;

export interface Project {
  id: ID;
  name: string;
  description: string | null;
  settings_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Conversation {
  id: ID;
  project_id: ID | null;
  agent_id: ID | null;
  title: string | null;
  system_prompt: string | null;
  model_provider: string | null;
  model_id: string | null;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at?: string | null;
}

export interface Message {
  id: ID;
  conversation_id: ID;
  role: string;
  content: string;
  content_json: string | null;
  parent_message_id: ID | null;
  status: string;
  error_json: string | null;
  token_input: number | null;
  token_output: number | null;
  created_at: string;
}

export interface Memory {
  id: ID;
  project_id: ID | null;
  type: string;
  content: string;
  summary: string | null;
  importance: number;
  confidence: number;
  status: string;
  source_conversation_id: ID | null;
  source_message_id: ID | null;
  dedupe_hash: string | null;
  embedding_ref: string | null;
  metadata_json: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentRecord {
  id: ID;
  project_id: ID | null;
  title: string;
  source_type: string;
  mime_type: string;
  storage_path: string;
  file_size_bytes: number;
  checksum_sha256: string | null;
  status: string;
  error_json: string | null;
  metadata_json: string;
  ingested_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DocumentChunk {
  id: ID;
  document_id: ID;
  chunk_index: number;
  content: string;
  content_raw: string | null;
  token_estimate: number | null;
  page_start: number | null;
  page_end: number | null;
  metadata_json: string;
  created_at: string;
}

export interface ChunkEmbedding {
  id: ID;
  document_id: ID;
  chunk_id: ID;
  provider: string;
  model: string;
  dims: number;
  vector_json: string;
  created_at: string;
}

export interface Agent {
  id: ID;
  name: string;
  description: string | null;
  system_prompt: string;
  config_json: string;
  is_builtin: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: ID;
  target_type: string;
  target_id: string;
  rating: number | null;
  label: string | null;
  comment: string | null;
  correction_text: string | null;
  metadata_json: string;
  created_at: string;
}

export interface UsageEvent {
  id: ID;
  conversation_id: ID | null;
  message_id: ID | null;
  agent_run_id: ID | null;
  provider_id: string | null;
  model_id: string | null;
  token_input: number | null;
  token_output: number | null;
  latency_ms: number | null;
  status: string;
  error_json: string | null;
  created_at: string;
}

export interface AuditLog {
  id: ID;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: ID | null;
  severity: string;
  details_json: string;
  created_at: string;
}
