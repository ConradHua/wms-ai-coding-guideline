#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { ROOT, loadMeta, buildGeneratedFiles } = require('./build-plugin.cjs');

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function verifyGeneratedSync(meta) {
  const expected = buildGeneratedFiles(meta);
  for (const [relPath, content] of Object.entries(expected)) {
    const absPath = path.join(ROOT, relPath);
    assert.ok(fs.existsSync(absPath), `Missing generated file: ${relPath}`);
    const actual = normalizeNewlines(fs.readFileSync(absPath, 'utf8'));
    assert.equal(
      actual,
      normalizeNewlines(content),
      `Generated file out of sync with plugin.meta.json/assets: ${relPath}. Run "node scripts/build-plugin.cjs".`
    );
    if (relPath.endsWith('.json')) {
      JSON.parse(actual);
    }
  }
}

function verifySkills(meta) {
  for (const skillRel of meta.skills) {
    const skillDir = path.join(ROOT, skillRel);
    assert.ok(fs.existsSync(path.join(skillDir, 'SKILL.md')), `Missing SKILL.md in ${skillRel}`);
    assert.ok(
      fs.existsSync(path.join(skillDir, 'agents', 'openai.yaml')),
      `Missing agents/openai.yaml in ${skillRel}`
    );
  }
}

function verifyAgents(meta) {
  const script = path.join(ROOT, 'skills', 'wms-develop-setup', 'assets', 'agents', 'render-agent.cjs');
  for (const agent of meta.agents) {
    const copilot = execFileSync(process.execPath, [script, agent, 'copilot'], { encoding: 'utf8' });
    assert.match(copilot, /^---\nname: .+\ndescription: .+\n---\n\n/);

    const cursor = execFileSync(process.execPath, [script, agent, 'cursor'], { encoding: 'utf8' });
    assert.match(cursor, /^---\nname: .+\ndescription: .+\nreadonly: true\n---\n\n/);

    const codex = execFileSync(process.execPath, [script, agent, 'codex'], { encoding: 'utf8' });
    assert.match(codex, /^name = ".+"\ndescription = ".+"\nsandbox_mode = "read-only"\ndeveloper_instructions = """/);
  }
}

function verifyInstructions(meta) {
  const script = path.join(
    ROOT,
    'skills',
    'wms-develop-setup',
    'assets',
    'instructions',
    'render-instruction.cjs'
  );
  for (const inst of meta.instructions) {
    const copilot = execFileSync(process.execPath, [script, inst, 'copilot'], { encoding: 'utf8' });
    assert.match(copilot, /^---\ndescription: ".+"\napplyTo: ".+"\n---\n\n#/);

    const cursor = execFileSync(process.execPath, [script, inst, 'cursor'], { encoding: 'utf8' });
    assert.match(cursor, /^---\ndescription: ".+"\nglobs: ".+"\nalwaysApply: false\n---\n\n#/);

    const codex = execFileSync(process.execPath, [script, inst, 'codex'], { encoding: 'utf8' });
    assert.match(codex, /^# /);
    assert.ok(!codex.startsWith('---'));
  }

  const routing = execFileSync(
    process.execPath,
    [script, '--routing', 'copilot,cursor,codex', meta.instructions.join(',')],
    { encoding: 'utf8' }
  );
  assert.ok(routing.includes('## Domain Development Instructions'));
  for (const inst of meta.instructions) {
    assert.ok(routing.includes(`.github/instructions/${inst}.instructions.md`));
    assert.ok(routing.includes(`.cursor/rules/${inst}.mdc`));
    assert.ok(routing.includes(`docs/ai-instructions/${inst}.md`));
  }
}

function verifyHooks() {
  const hooksDir = path.join(ROOT, 'skills', 'wms-develop-setup', 'assets', 'hooks', 'governance-audit');
  const composeScript = path.join(hooksDir, 'compose-config.cjs');
  const govScript = path.join(hooksDir, 'governance.cjs');

  // 1. Copilot config supports all 4 features.
  const copilotCfg = JSON.parse(
    execFileSync(
      process.execPath,
      [composeScript, 'threat-protection', 'prompt-redaction', 'audit-log', 'tool-audit'],
      { encoding: 'utf8' }
    )
  );
  assert.equal(copilotCfg.version, 1);
  assert.ok(copilotCfg.hooks.sessionStart);
  assert.ok(copilotCfg.hooks.userPromptSubmitted);
  assert.ok(copilotCfg.hooks.userPromptTransformed);
  assert.ok(copilotCfg.hooks.preToolUse);

  // 2. Cursor config supports threat-protection, audit-log, tool-audit.
  const cursorCfg = JSON.parse(
    execFileSync(
      process.execPath,
      [composeScript, '--platform', 'cursor', 'threat-protection', 'audit-log', 'tool-audit'],
      { encoding: 'utf8' }
    )
  );
  assert.equal(cursorCfg.version, 1);
  assert.ok(cursorCfg.hooks.sessionStart);
  assert.ok(cursorCfg.hooks.beforeSubmitPrompt);
  assert.ok(cursorCfg.hooks.preToolUse);
  assert.ok(cursorCfg.hooks.postToolUse);
  assert.ok(cursorCfg.hooks.stop);
  assert.ok(!cursorCfg.hooks.userPromptTransformed);

  // 3. Cursor explicitly rejects prompt-redaction.
  let cursorRejectedRedaction = false;
  try {
    execFileSync(process.execPath, [composeScript, '--platform', 'cursor', 'prompt-redaction'], {
      stdio: 'pipe',
    });
  } catch {
    cursorRejectedRedaction = true;
  }
  assert.ok(cursorRejectedRedaction, 'Cursor must reject unsupported prompt-redaction feature');

  // 4. End-to-end threat gate test in isolated temp workspace for both Copilot and Cursor.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wms-plugin-verify-'));
  try {
    // Cursor flow: beforeSubmitPrompt with dangerous command -> preToolUse denied -> confirm -> preToolUse allowed.
    const cursorEnv = { ...process.env, GOVERNANCE_LOG_DIR: path.join(tmpDir, 'logs-cursor') };
    const cursorPromptOut = JSON.parse(
      execFileSync(
        process.execPath,
        [govScript, 'prompt', '--platform', 'cursor', '--features', 'threat-protection,audit-log'],
        {
          cwd: tmpDir,
          env: cursorEnv,
          input: JSON.stringify({ conversation_id: 'conv-1', prompt: '请执行 rm -rf / 清理目录' }),
          encoding: 'utf8',
        }
      )
    );
    assert.deepEqual(cursorPromptOut, { continue: true });

    const cursorDenyOut = JSON.parse(
      execFileSync(
        process.execPath,
        [govScript, 'pre-tool', '--platform', 'cursor', '--features', 'threat-protection,audit-log'],
        {
          cwd: tmpDir,
          env: cursorEnv,
          input: JSON.stringify({ conversation_id: 'conv-1', tool_name: 'Shell', tool_input: { command: 'rm -rf /' } }),
          encoding: 'utf8',
        }
      )
    );
    assert.equal(cursorDenyOut.permission, 'deny');
    assert.ok(typeof cursorDenyOut.user_message === 'string' && cursorDenyOut.user_message.includes('确认高危操作'));
    assert.equal(cursorDenyOut.agent_message, cursorDenyOut.user_message);

    // Copilot flow: userPromptSubmitted -> preToolUse denied with permissionDecision.
    const copilotEnv = {
      ...process.env,
      GOVERNANCE_FEATURES: 'threat-protection,audit-log',
      GOVERNANCE_LOG_DIR: path.join(tmpDir, 'logs-copilot'),
    };
    execFileSync(process.execPath, [govScript, 'prompt'], {
      cwd: tmpDir,
      env: copilotEnv,
      input: JSON.stringify({ sessionId: 'sess-1', prompt: '请执行 rm -rf / 清理目录' }),
      encoding: 'utf8',
    });
    const copilotDenyOut = JSON.parse(
      execFileSync(process.execPath, [govScript, 'pre-tool'], {
        cwd: tmpDir,
        env: copilotEnv,
        input: JSON.stringify({ sessionId: 'sess-1', toolName: 'powershell', toolArgs: { command: 'rm -rf /' } }),
        encoding: 'utf8',
      })
    );
    assert.equal(copilotDenyOut.permissionDecision, 'deny');
    assert.ok(copilotDenyOut.permissionDecisionReason.includes('确认高危操作'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main() {
  const meta = loadMeta();
  verifyGeneratedSync(meta);
  verifySkills(meta);
  verifyAgents(meta);
  verifyInstructions(meta);
  verifyHooks();
  process.stdout.write('ALL PLUGIN VERIFICATION CHECKS PASSED\n');
}

main();
