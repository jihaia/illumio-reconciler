#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

// ─── Configuration ───────────────────────────────────────────
const DB_DIR = path.join(os.homedir(), '.aperture');
const DB_PATH = path.join(DB_DIR, 'aperture.db');
// Shared migrations live in packages/migrations/sql/ at the monorepo root.
// __dirname is apps/extension/native-host, so walk up 3 levels.
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'packages', 'migrations', 'sql');

// ─── Chrome Native Messaging Protocol ───────────────────────
// Messages are length-prefixed: 4-byte LE uint32 + JSON payload

function readMessage() {
  return new Promise((resolve, reject) => {
    let headerBuf = Buffer.alloc(4);
    let headerRead = 0;

    function onReadable() {
      // Read 4-byte header
      while (headerRead < 4) {
        const chunk = process.stdin.read(4 - headerRead);
        if (!chunk) return;
        chunk.copy(headerBuf, headerRead);
        headerRead += chunk.length;
      }

      const msgLen = headerBuf.readUInt32LE(0);
      if (msgLen === 0 || msgLen > 1024 * 1024) {
        reject(new Error(`Invalid message length: ${msgLen}`));
        return;
      }

      // Now read the JSON payload
      let payloadBuf = Buffer.alloc(msgLen);
      let payloadRead = 0;

      function readPayload() {
        while (payloadRead < msgLen) {
          const chunk = process.stdin.read(msgLen - payloadRead);
          if (!chunk) return;
          chunk.copy(payloadBuf, payloadRead);
          payloadRead += chunk.length;
        }
        process.stdin.removeListener('readable', readPayload);
        try {
          resolve(JSON.parse(payloadBuf.toString('utf-8')));
        } catch (e) {
          reject(new Error('Invalid JSON in message'));
        }
      }

      process.stdin.removeListener('readable', onReadable);
      process.stdin.on('readable', readPayload);
      readPayload();
    }

    process.stdin.on('readable', onReadable);
  });
}

function sendMessage(obj) {
  const json = JSON.stringify(obj);
  const buf = Buffer.from(json, 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

function sendResult(id, data) {
  sendMessage({ id, ok: true, data });
}

function sendError(id, message, code = 'ERROR') {
  sendMessage({ id, ok: false, error: { code, message } });
}

// ─── Database Initialization ─────────────────────────────────

function openDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function runMigrations(db) {
  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map(r => r.name)
  );

  const applyMigration = db.transaction((name, sql) => {
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
  });

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    try {
      applyMigration(file, sql);
    } catch (err) {
      // Send error to extension and exit — migration failure is fatal
      sendMessage({
        id: '__init__',
        ok: false,
        error: { code: 'MIGRATION_ERROR', message: `Migration ${file} failed: ${err.message}` },
      });
      process.exit(1);
    }
  }
}

// ─── Message Handlers ────────────────────────────────────────

const HANDLERS = {
  ping(_db, _params) {
    return { pong: true, dbPath: DB_PATH };
  },

  query(db, params) {
    const stmt = db.prepare(params.sql);
    const rows = params.params ? stmt.all(...params.params) : stmt.all();
    return { rows, count: rows.length };
  },

  execute(db, params) {
    const stmt = db.prepare(params.sql);
    const result = params.params ? stmt.run(...params.params) : stmt.run();
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  },

  executeBatch(db, params) {
    const runBatch = db.transaction(() => {
      const results = [];
      for (const item of params.statements) {
        const stmt = db.prepare(item.sql);
        const result = item.params ? stmt.run(...item.params) : stmt.run();
        results.push({
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid),
        });
      }
      return results;
    });
    return { results: runBatch() };
  },

  seed(db, params) {
    const { table, rows, upsert } = params;
    if (!rows || rows.length === 0) return { inserted: 0 };

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');

    // Build upsert clause if requested
    const conflict = upsert
      ? `ON CONFLICT(${columns[0]}) DO UPDATE SET ${columns.slice(1).map(c => `${c}=excluded.${c}`).join(', ')}, updated_at=datetime('now')`
      : '';

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ${conflict}`;
    const stmt = db.prepare(sql);

    const insertAll = db.transaction(() => {
      let count = 0;
      for (const row of rows) {
        stmt.run(...columns.map(c => row[c] ?? null));
        count++;
      }
      return count;
    });

    return { inserted: insertAll() };
  },

  getSchema(db) {
    const tables = db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    return { tables };
  },

  getMigrations(db) {
    const migrations = db.prepare('SELECT * FROM migrations ORDER BY applied_at').all();
    return { migrations };
  },
};

// ─── Main Loop ───────────────────────────────────────────────

async function main() {
  let db;
  try {
    db = openDatabase();
    runMigrations(db);
  } catch (err) {
    sendMessage({
      id: '__init__',
      ok: false,
      error: { code: 'INIT_ERROR', message: err.message },
    });
    process.exit(1);
  }

  // Process messages until stdin closes
  while (true) {
    let msg;
    try {
      msg = await readMessage();
    } catch (err) {
      // stdin closed or protocol error — exit gracefully
      break;
    }

    const { id, action, params } = msg;

    const handler = HANDLERS[action];
    if (!handler) {
      sendError(id, `Unknown action: ${action}`, 'UNKNOWN_ACTION');
      continue;
    }

    try {
      const result = handler(db, params || {});
      sendResult(id, result);
    } catch (err) {
      sendError(id, err.message, 'QUERY_ERROR');
    }
  }

  if (db) db.close();
  process.exit(0);
}

main();
