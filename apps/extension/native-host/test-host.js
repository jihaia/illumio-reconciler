#!/usr/bin/env node
'use strict';

/**
 * Test harness for the Aperture native messaging host.
 * Simulates Chrome's native messaging protocol (4-byte length prefix + JSON).
 *
 * Usage:  node test-host.js
 */

const { spawn } = require('child_process');
const path = require('path');

const hostPath = path.join(__dirname, 'host.js');
const host = spawn(process.execPath, [hostPath], {
  stdio: ['pipe', 'pipe', 'inherit'], // stdin: pipe, stdout: pipe, stderr: inherit
});

let msgCounter = 0;

function send(action, params) {
  const id = `test_${++msgCounter}`;
  const msg = { id, action, params };
  const json = JSON.stringify(msg);
  const buf = Buffer.from(json, 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  host.stdin.write(header);
  host.stdin.write(buf);
  console.log(`→ [${id}] ${action}`, params ? JSON.stringify(params).slice(0, 80) : '');
  return id;
}

// Buffer for reading responses (handles partial reads)
let responseBuf = Buffer.alloc(0);

function processResponses() {
  while (responseBuf.length >= 4) {
    const msgLen = responseBuf.readUInt32LE(0);
    if (responseBuf.length < 4 + msgLen) break; // wait for more data

    const jsonBuf = responseBuf.slice(4, 4 + msgLen);
    responseBuf = responseBuf.slice(4 + msgLen);

    try {
      const msg = JSON.parse(jsonBuf.toString('utf-8'));
      if (msg.ok) {
        console.log(`← [${msg.id}] OK:`, JSON.stringify(msg.data).slice(0, 200));
      } else {
        console.log(`← [${msg.id}] ERROR:`, msg.error);
      }
    } catch (e) {
      console.error('Failed to parse response:', e.message);
    }
  }
}

host.stdout.on('data', (chunk) => {
  responseBuf = Buffer.concat([responseBuf, chunk]);
  processResponses();
});

host.on('close', (code) => {
  console.log(`\nHost exited with code ${code}`);
  process.exit(code);
});

// ─── Run tests sequentially ──────────────────────────────────

async function runTests() {
  // Give host time to start up and run migrations
  await sleep(500);

  console.log('\n═══ Test 1: Ping ═══');
  send('ping');
  await sleep(300);

  console.log('\n═══ Test 2: Get Migrations ═══');
  send('getMigrations');
  await sleep(300);

  console.log('\n═══ Test 3: Get Schema ═══');
  send('getSchema');
  await sleep(300);

  console.log('\n═══ Test 4: Query component_types ═══');
  send('query', { sql: 'SELECT id, class_name, label FROM component_types LIMIT 5' });
  await sleep(300);

  console.log('\n═══ Test 5: Count component_types ═══');
  send('query', { sql: 'SELECT COUNT(*) as count FROM component_types' });
  await sleep(300);

  console.log('\n═══ Test 6: Typeahead search (Tom%) ═══');
  send('query', {
    sql: "SELECT label, class_name FROM component_types WHERE label LIKE ? ORDER BY label LIMIT 10",
    params: ['Tom%'],
  });
  await sleep(300);

  console.log('\n═══ Test 7: Insert a test portfolio ═══');
  send('execute', {
    sql: "INSERT OR IGNORE INTO portfolios (name) VALUES (?)",
    params: ['Test Portfolio'],
  });
  await sleep(300);

  console.log('\n═══ Test 8: Query portfolios ═══');
  send('query', { sql: 'SELECT * FROM portfolios' });
  await sleep(300);

  console.log('\n═══ Test 9: Seed test data ═══');
  send('seed', {
    table: 'workloads',
    rows: [
      { hostname: 'testserver01', ip_address: '10.0.0.1', os: 'Linux', environment: 'Development' },
      { hostname: 'testserver02', ip_address: '10.0.0.2', os: 'Windows', environment: 'Production' },
    ],
    upsert: true,
  });
  await sleep(300);

  console.log('\n═══ Test 10: Query workloads ═══');
  send('query', { sql: 'SELECT * FROM workloads' });
  await sleep(300);

  console.log('\n═══ Test 11: Cleanup test data ═══');
  send('execute', { sql: "DELETE FROM portfolios WHERE name = 'Test Portfolio'" });
  send('execute', { sql: "DELETE FROM workloads WHERE hostname LIKE 'testserver%'" });
  await sleep(500);

  console.log('\n═══ Tests complete ═══\n');

  // Close stdin to signal host to exit
  host.stdin.end();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
