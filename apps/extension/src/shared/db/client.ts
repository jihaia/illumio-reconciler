import type { DbRequest, DbResponse, QueryResult, ExecuteResult, SeedResult } from './types';

const NATIVE_HOST_NAME = 'com.aperture.db';
const DEFAULT_TIMEOUT_MS = 30_000;
const SEED_TIMEOUT_MS = 120_000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1_000;

type PendingRequest = {
  resolve: (value: DbResponse) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class ApertureDb {
  private port: chrome.runtime.Port | null = null;
  private pending = new Map<string, PendingRequest>();
  private messageCounter = 0;
  private connecting = false;

  // ─── Connection Management ──────────────────────────────────

  private connect(): chrome.runtime.Port {
    if (this.port) return this.port;
    if (this.connecting) throw new Error('Connection in progress');

    this.connecting = true;
    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

      port.onMessage.addListener((msg: DbResponse) => {
        const pending = this.pending.get(msg.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(msg.id);
          pending.resolve(msg);
        }
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message || 'Native host disconnected';
        console.warn('[ApertureDb] Disconnected:', error);

        // Reject all pending requests
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`Connection lost: ${error}`));
        }
        this.pending.clear();
        this.port = null;
      });

      this.port = port;
      return port;
    } finally {
      this.connecting = false;
    }
  }

  private ensureConnection(): chrome.runtime.Port {
    if (this.port) return this.port;
    return this.connect();
  }

  // ─── Core Send/Receive ─────────────────────────────────────

  private send(action: string, params?: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<DbResponse> {
    const id = `msg_${++this.messageCounter}_${Date.now()}`;
    const port = this.ensureConnection();

    return new Promise<DbResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out after ${timeoutMs}ms: ${action}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      try {
        port.postMessage({ id, action, params } as DbRequest);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  private async request<T>(action: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      try {
        const response = await this.send(action, params, timeoutMs);
        if (!response.ok) {
          throw new Error(response.error?.message || 'Unknown database error');
        }
        return response.data as T;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        // If the connection was lost, try to reconnect
        if (error.message?.includes('Connection lost') || error.message?.includes('disconnected')) {
          this.port = null;
          if (attempt < MAX_RECONNECT_ATTEMPTS) {
            await new Promise(r => setTimeout(r, RECONNECT_DELAY_MS));
            continue;
          }
        }
        throw error;
      }
    }

    throw lastError || new Error('Failed after max reconnect attempts');
  }

  // ─── Public API ────────────────────────────────────────────

  /** Check if the native host is reachable and the DB is initialized */
  async ping(): Promise<{ pong: boolean; dbPath: string }> {
    return this.request('ping');
  }

  /** Run a SELECT query and return typed rows */
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.request('query', { sql, params });
  }

  /** Run an INSERT/UPDATE/DELETE statement */
  async execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
    return this.request('execute', { sql, params });
  }

  /** Run multiple statements in a single transaction */
  async executeBatch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<{ results: ExecuteResult[] }> {
    return this.request('executeBatch', { statements });
  }

  /** Bulk insert/upsert rows into a table */
  async seed(table: string, rows: Record<string, unknown>[], upsert = false): Promise<SeedResult> {
    return this.request('seed', { table, rows, upsert }, SEED_TIMEOUT_MS);
  }

  /** Get database schema (all tables and their DDL) */
  async getSchema(): Promise<{ tables: Array<{ name: string; sql: string }> }> {
    return this.request('getSchema');
  }

  /** Get migration history */
  async getMigrations(): Promise<{ migrations: Array<{ name: string; applied_at: string }> }> {
    return this.request('getMigrations');
  }

  /** Disconnect from native host */
  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }
}

/** Singleton instance — shared across the service worker */
export const db = new ApertureDb();
