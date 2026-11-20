#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const AVAILABLE_AGENTS = ['code-reviewer', 'security-auditor'];
const TARGETS = {
  copilot: name => `.github/agents/${name}.agent.md`,
  cursor: name => `.cursor/agents/${name}.md`,
  codex: name => `.codex/agents/${name}.toml`,
};

function parseAgentMarkdown(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('missing YAML frontmatter');
  }
  const meta = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(':');
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    meta[key] = value;
  }
  if (!meta.name || !meta.description) {
    throw new Error('frontmatter must include name and description');
  }
  return { name: meta.name, description: meta.description, body: match[2].trim() };
}

function tomlBasicString(value) {
  return JSON.stringify(value);
}

function tomlMultilineBasicString(value) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"');
  return `"""\n${escaped}\n"""`;
}

function renderAgent(agentName, platform) {
  if (!AVAILABLE_AGENTS.includes(agentName)) {
    throw new Error(`unknown agent "${agentName}". Expected one of: ${AVAILABLE_AGENTS.join(', ')}`);
  }
  if (!Object.hasOwn(TARGETS, platform)) {
    throw new Error(`unknown platform "${platform}". Expected one of: ${Object.keys(TARGETS).join(', ')}`);
  }

  const sourcePath = path.join(__dirname, `${agentName}.md`);
  const { name, description, body } = parseAgentMarkdown(fs.readFileSync(sourcePath, 'utf8'));

  if (platform === 'copilot') {
    return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
  }

  if (platform === 'cursor') {
    return `---\nname: ${name}\ndescription: ${description}\nreadonly: true\n---\n\n${body}\n`;
  }

  return [
    `name = ${tomlBasicString(name)}`,
    `description = ${tomlBasicString(description)}`,
    'sandbox_mode = "read-only"',
    `developer_instructions = ${tomlMultilineBasicString(body)}`,
    '',
  ].join('\n');
}

if (require.main === module) {
  const [agentName, platform] = process.argv.slice(2);
  try {
    process.stdout.write(renderAgent(agentName, platform));
  } catch (error) {
    process.stderr.write(`Agent render error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { AVAILABLE_AGENTS, TARGETS, renderAgent };
