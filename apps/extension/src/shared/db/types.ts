// ─── Native Messaging Protocol Types ─────────────────────────

export interface DbRequest {
  id: string;
  action: 'ping' | 'query' | 'execute' | 'executeBatch' | 'seed' | 'getSchema' | 'getMigrations';
  params?: Record<string, unknown>;
}

export interface DbResponse {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  count: number;
}

export interface ExecuteResult {
  changes: number;
  lastInsertRowid: number;
}

export interface SeedResult {
  inserted: number;
}

// ─── DB Row Types (mirror SQLite schema) ─────────────────────

export interface PortfolioRow {
  id: number;
  name: string;
  snow_sys_id: string | null;
  state: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  id: number;
  name: string;
  portfolio_id: number;
  snow_sys_id: string | null;
  full_name: string | null;
  description: string | null;
  criticality: string | null;
  environment: string | null;
  category: string | null;
  infrastructure: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppGroupingRow {
  id: number;
  name: string;
  asset_id: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: number;
  name: string;
  app_grouping_id: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComponentTypeRow {
  id: number;
  class_name: string;
  label: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ComponentRow {
  id: number;
  name: string;
  application_id: number;
  component_type_id: number | null;
  snow_sys_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkloadRow {
  id: number;
  hostname: string;
  snow_sys_id: string | null;
  ip_address: string | null;
  fqdn: string | null;
  os: string | null;
  environment: string | null;
  class_type: string | null;
  is_virtual: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}
