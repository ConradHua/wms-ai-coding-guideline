'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { redact } = require('./redact-prompt.cjs');

const POLICY_VERSION = '2026-11-05.1';
const LOG_DIR = path.resolve('logs/copilot/governance');

const preview = value => {
  const text = redact(typeof value === 'string' ? value : JSON.stringify(value ?? null));
  return { text: text.slice(0, 2000), length: text.length, truncated: text.length > 2000 };
};

function repository() {
  try {
    const git = args => redact(execFileSync('git', args, { encoding: 'utf8', timeout: 1000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    const [root, branch] = git(['rev-parse', '--show-toplevel', '--abbrev-ref', 'HEAD']).split(/\r?\n/u);
    return { root, branch, commit: git(['rev-parse', 'HEAD']) };
  } catch { return null; }
}

function createRecorder(input, sessionId, state, level, enforce) {
  const record = (event, details = {}) => {
    const line = { schema_version: 2, policy_version: POLICY_VERSION, event_id: randomUUID(),
      timestamp: new Date().toISOString(), source_timestamp: typeof input.timestamp === 'string' ? redact(input.timestamp) : input.timestamp ?? null,
      event, session_id: redact(sessionId), request_id: state.active?.request_id ?? null,
      cwd: redact(process.cwd()), reported_cwd: input.cwd ? redact(String(input.cwd)) : null,
      agent_id: input.agentId || input.agent_id ? redact(String(input.agentId ?? input.agent_id)) : null,
      governance_level: level, enforcement_enabled: enforce, ...details };
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'audit.log'), JSON.stringify(line) + '\n', { mode: 0o600 });
    state.counters[event] = (state.counters[event] ?? 0) + 1;
  };
  return record;
}

function recordError(event, kind) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'audit.log'), JSON.stringify({ schema_version: 2,
      policy_version: POLICY_VERSION, event_id: randomUUID(), timestamp: new Date().toISOString(),
      event: 'hook_error', session_id: typeof (event?.sessionId ?? event?.session_id) === 'string' ? redact(event.sessionId ?? event.session_id) : null,
      hook: ['session-start', 'prompt', 'transformed', 'pre-tool', 'post-tool', 'tool-failure', 'turn-end', 'session-end'].includes(kind) ? kind : 'unknown',
      action: 'error', error_code: 'GOVERNANCE_HOOK_FAILED',
    }) + '\n', { mode: 0o600 });
  } catch { /* A log storage failure can only be surfaced on stderr. */ }
}

module.exports = { LOG_DIR, preview, repository, createRecorder, recordError };
