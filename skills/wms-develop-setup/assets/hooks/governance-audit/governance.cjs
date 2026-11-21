#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const { redact } = require('./redact-prompt.cjs');

const { LOG_DIR, preview, repository, createRecorder, recordError } = require('./audit-log.cjs');
const { scan } = require('./threat-scan.cjs');
const { hash, instruction, acceptPrompt } = require('./request-control.cjs');
const { parseFeatures } = require('./compose-config.cjs');
const { checkLicenses, formatSummary } = require('./license-check.cjs');

function parseCliOptions(argv) {
  const kind = argv[0];
  let platform = process.env.GOVERNANCE_PLATFORM ?? 'copilot';
  let featuresRaw = process.env.GOVERNANCE_FEATURES;
  let licenseMode = process.env.LICENSE_MODE ?? 'warn';
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === '--platform') {
      platform = argv[++i];
      if (!platform) throw new Error('missing platform');
    } else if (argv[i] === '--features') {
      featuresRaw = argv[++i];
      if (!featuresRaw) throw new Error('missing features');
    } else if (argv[i] === '--license-mode') {
      licenseMode = argv[++i];
      if (!licenseMode) throw new Error('missing license mode');
    } else {
      throw new Error(`unexpected argument: ${argv[i]}`);
    }
  }
  if (!['warn', 'block'].includes(licenseMode)) throw new Error('invalid license mode');
  return { kind, platform, featuresRaw, licenseMode };
}

function run(kind, input, inputBytes, features, platform = 'copilot', licenseMode = 'warn') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid event');
  if (!['copilot', 'cursor'].includes(platform)) throw new Error('invalid platform');
  const detectThreats = features.has('threat-protection');
  const audit = features.has('audit-log');
  const toolAudit = features.has('tool-audit');
  const redactPrompt = platform === 'copilot' && features.has('prompt-redaction') && process.env.ENABLE_PROMPT_REDACTION !== 'false';
  if (kind === 'transformed' && !detectThreats && !audit) {
    if (!redactPrompt) return {};
    if (inputBytes > 1024 * 1024 || typeof input.transformedPrompt !== 'string') throw new Error('invalid transformed prompt');
    const modified = redact(input.transformedPrompt);
    return modified === input.transformedPrompt ? {} : { modifiedTransformedPrompt: modified };
  }
  const sessionId = input.sessionId ?? input.session_id ?? input.conversation_id;
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('missing session id');
  const level = process.env.GOVERNANCE_LEVEL ?? 'standard';
  const enforce = detectThreats && level !== 'open' && (process.env.BLOCK_ON_THREAT !== 'false' || level !== 'standard');
  const needsState = detectThreats || audit;
  const stateDir = needsState ? path.join(LOG_DIR, '.state') : null;
  if (needsState) fs.mkdirSync(stateDir, { recursive: true });
  const stateFile = needsState ? path.join(stateDir, `${hash(sessionId)}.json`) : null;
  const lock = needsState ? `${stateFile}.lock` : null;
  if (needsState) {
    const deadline = Date.now() + 1000;
    for (;;) {
      try { fs.mkdirSync(lock); break; } catch (error) {
        if (error.code !== 'EEXIST' || Date.now() >= deadline) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      }
    }
  }
  try {
    let state;
    if (needsState) {
      try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        state = { counters: {}, pending: null, active: null };
      }
    } else state = { counters: {}, pending: null, active: null };
    const record = (audit || toolAudit) ? createRecorder(input, sessionId, state, level, enforce) : () => {};
    const save = () => {
      if (!needsState) return;
      const temporary = `${stateFile}.${randomUUID()}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
      fs.renameSync(temporary, stateFile);
    };
    const promptEvent = ['prompt', 'transformed'].includes(kind);
    if (promptEvent && detectThreats) {
      state.scan_error = true;
      save();
    }
    if (inputBytes > 1024 * 1024) throw new Error('event too large');
    if (detectThreats && !['open', 'standard', 'strict', 'locked'].includes(level)) throw new Error('invalid level');
    for (const key of ['BLOCK_ON_THREAT', 'ENABLE_PROMPT_REDACTION']) {
      if (![undefined, 'true', 'false'].includes(process.env[key])) throw new Error('invalid configuration');
    }

    const accept = prompt => acceptPrompt(prompt, {
      input, state, enforce, detectThreats, save, record: audit ? record : undefined,
    });
    const pending = () => detectThreats ? state.pending : null;
    let output = {};
    switch (kind) {
      case 'session-start':
        if (audit) record('session_start', { source: input.source ? redact(String(input.source)) : null,
          local_user: redact(os.userInfo().username), repository: repository(),
          pending_request_id: detectThreats ? state.pending?.request_id ?? null : null });
        if (platform === 'cursor') {
          output = {};
        } else {
          output = { additionalContext: 'Governance Audit 已启用：若收到高危提醒，只在普通聊天中说明风险并请求对应编号的确认，确认前不得调用工具。' };
          if (!detectThreats) output = {};
          else if (input.hook_event_name) output = { hookSpecificOutput: { hookEventName: 'SessionStart', ...output } };
        }
        break;
      case 'prompt':
        if (typeof input.prompt !== 'string') throw new Error('missing prompt');
        accept(input.prompt);
        if (platform === 'cursor') {
          output = { continue: true };
        } else if (input.hook_event_name && pending()) {
          // userPromptSubmitted command output is ignored by the Copilot runtime.
          output = { systemMessage: instruction(state.pending) };
        }
        break;
      case 'transformed': {
        if (typeof input.prompt !== 'string' || typeof input.transformedPrompt !== 'string') throw new Error('missing transformed prompt');
        const promptHash = hash(redact(input.prompt));
        if (!state.awaiting_transform || ![state.active?.prompt_hash, state.active?.control_prompt_hash].includes(promptHash)) accept(input.prompt);
        // Scan model-facing content as well: runtime-added text may contain additional signals.
        const threats = detectThreats ? scan(input.transformedPrompt) : [];
        if (threats.length && enforce && !state.pending && !state.active.confirmed) {
          state.pending = { ...state.active, threats };
          save();
        }
        let modified = redactPrompt ? redact(input.transformedPrompt) : input.transformedPrompt;
        const guard = pending() ? instruction(pending()) : null;
        if (guard) modified = `${guard}\n\n${modified}\n\n${guard}`;
        else if (detectThreats && state.active.confirmed) modified += `\n\n用户已确认请求 ${state.active.request_id}，仅对该请求继续处理。原请求（已脱敏）：\n${state.active.prompt}`;
        else if (detectThreats && state.active.cancelled_request_id) modified += `\n\n请求 ${state.active.cancelled_request_id} 已被用户取消，不得继续执行该请求。`;
        state.awaiting_transform = false;
        if (audit) record('prompt_transformed', { action: guard ? 'guard_injected' : modified !== input.transformedPrompt ? 'rewritten' : 'unchanged',
          pending_request_id: pending()?.request_id ?? null, instruction: guard,
          redaction_applied: redactPrompt && redact(input.transformedPrompt) !== input.transformedPrompt, threats });
        output = modified === input.transformedPrompt ? {} : { modifiedTransformedPrompt: modified };
        break;
      }
      case 'pre-tool': {
        const toolName = input.toolName ?? input.tool_name;
        if (typeof toolName !== 'string') throw new Error('missing tool');
        if (detectThreats && (!state.active || state.scan_error)) throw new Error('prompt scan unavailable');
        const denied = Boolean(pending());
        const reason = denied ? instruction(state.pending) : null;
        if (toolAudit) record('tool_decision', { tool_name: redact(toolName), tool_call_id: input.tool_use_id ?? null,
          arguments: preview(input.toolArgs ?? input.tool_input), action: denied ? 'deny' : 'pass_through',
          pending_request_id: detectThreats ? state.pending?.request_id ?? null : null, reason });
        // Never emit allow: clean requests still go through normal host permissions.
        if (denied) {
          if (platform === 'cursor') {
            output = { permission: 'deny', user_message: reason, agent_message: reason };
          } else {
            output = { permissionDecision: 'deny', permissionDecisionReason: reason };
            // Local VS Code uses nested decisions; shared Copilot uses the top-level fields.
            if (input.hook_event_name) output.hookSpecificOutput = { hookEventName: 'PreToolUse', ...output, additionalContext: reason };
          }
        }
        break;
      }
      case 'post-tool':
      case 'tool-failure':
        if (toolAudit) record('tool_result', { tool_name: redact(String(input.toolName ?? input.tool_name ?? 'unknown')),
          tool_call_id: input.tool_use_id ?? null, arguments: preview(input.toolArgs ?? input.tool_input),
          result: kind === 'tool-failure' ? 'reported_failure' : 'reported_success',
          error: kind === 'tool-failure' ? preview(input.error ?? input.error_message) : null });
        break;
      case 'turn-end':
      case 'session-end':
        if (audit) record(kind === 'turn-end' ? 'turn_end' : 'session_end', { counters: { ...state.counters },
          scan_error: detectThreats && Boolean(state.scan_error),
          pending_request_id: pending()?.request_id ?? null,
          reason: redact(String(input.reason ?? input.stopReason ?? input.stop_reason ?? input.status ?? '')) });
        // License check runs only on turn-end (Copilot agentStop / Cursor stop), not session-end.
        if (kind === 'turn-end' && features.has('license-check')) {
          const licenseResult = checkLicenses({ mode: licenseMode });
          process.stderr.write(`${formatSummary(licenseResult)}\n`);
          if (audit) {
            record('license_check', {
              mode: licenseResult.mode,
              checked: licenseResult.checked,
              violation_count: licenseResult.violations.length,
              violations: licenseResult.violations,
              skipped: Boolean(licenseResult.skipped),
            });
          }
          if (licenseResult.mode === 'block' && licenseResult.violations.length > 0) {
            process.exitCode = 1;
          }
        }
        // Stop is a turn boundary, not a reason to clear pending confirmation.
        break;
      default: throw new Error('invalid hook');
    }
    if (promptEvent && detectThreats) state.scan_error = false;
    if (needsState && (promptEvent || audit)) save();
    return output;
  } finally {
    if (lock) fs.rmdirSync(lock);
  }
}

if (require.main === module) {
  let event;
  let features;
  let kind;
  try {
    if (process.env.SKIP_GOVERNANCE_AUDIT === 'true') {
      process.stdout.write('{}\n');
      process.exitCode = 0;
    } else {
      const options = parseCliOptions(process.argv.slice(2));
      kind = options.kind;
      features = parseFeatures(options.featuresRaw, options.platform);
      const input = fs.readFileSync(0, 'utf8');
      event = JSON.parse(input);
      process.stdout.write(JSON.stringify(run(kind, event, Buffer.byteLength(input), features, options.platform, options.licenseMode)) + '\n');
    }
  } catch {
    if (features && [...features].some(feature => ['audit-log', 'tool-audit'].includes(feature))) recordError(event, kind);
    // Parser errors and stack traces may include secrets.
    process.stderr.write('Governance: hook failed; no approval was issued. Check configuration, session ID, log permissions and state.\n');
    if (kind === 'pre-tool' && features && !features.has('threat-protection')) {
      process.stdout.write('{}\n');
    } else {
      process.exitCode = 2;
    }
  }
}

module.exports = { run, scan, instruction, parseCliOptions };
