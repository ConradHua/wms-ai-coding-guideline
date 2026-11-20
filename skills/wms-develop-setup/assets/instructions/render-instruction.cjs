#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const AVAILABLE_INSTRUCTIONS = ['sap-rfc', 'oracle', 'rest-api'];
const TARGETS = {
  copilot: name => `.github/instructions/${name}.instructions.md`,
  cursor: name => `.cursor/rules/${name}.mdc`,
  codex: name => `docs/ai-instructions/${name}.md`,
};

const SCOPE_LABELS = {
  'sap-rfc': 'SAP NCo / BAPI / Registered RFC / Goods Receipt posting / Batch classification',
  oracle: 'Oracle SQL / ASN sync / Material availability jobs / ODP.NET & EF Core / Transactions',
  'rest-api': 'ASP.NET Core REST API / PDA Goods Receipt endpoints / DTOs / Auth / Idempotency',
};

function unquoteYamlString(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function yamlDoubleQuoted(value) {
  return JSON.stringify(value);
}

function parseInstructionMarkdown(raw) {
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
    const value = unquoteYamlString(trimmed.slice(sep + 1).trim());
    meta[key] = value;
  }
  if (!meta.description || !meta.applyTo) {
    throw new Error('frontmatter must include description and applyTo');
  }
  return {
    description: meta.description,
    applyTo: meta.applyTo,
    body: match[2].trim(),
  };
}

function renderInstruction(instructionName, platform) {
  if (!AVAILABLE_INSTRUCTIONS.includes(instructionName)) {
    throw new Error(
      `unknown instruction "${instructionName}". Expected one of: ${AVAILABLE_INSTRUCTIONS.join(', ')}`
    );
  }
  if (!Object.hasOwn(TARGETS, platform)) {
    throw new Error(
      `unknown platform "${platform}". Expected one of: ${Object.keys(TARGETS).join(', ')}`
    );
  }

  const sourcePath = path.join(__dirname, `${instructionName}.md`);
  const { description, applyTo, body } = parseInstructionMarkdown(
    fs.readFileSync(sourcePath, 'utf8')
  );

  if (platform === 'copilot') {
    return [
      '---',
      `description: ${yamlDoubleQuoted(description)}`,
      `applyTo: ${yamlDoubleQuoted(applyTo)}`,
      '---',
      '',
      body,
      '',
    ].join('\n');
  }

  if (platform === 'cursor') {
    const globs = applyTo
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .join(', ');
    return [
      '---',
      `description: ${yamlDoubleQuoted(description)}`,
      `globs: ${yamlDoubleQuoted(globs)}`,
      'alwaysApply: false',
      '---',
      '',
      body,
      '',
    ].join('\n');
  }

  return `${body}\n`;
}

function renderRoutingSection(selectedInstructions, selectedPlatforms) {
  const instructions = [...new Set(selectedInstructions)];
  const platforms = [...new Set(selectedPlatforms)];

  if (instructions.length === 0) {
    throw new Error('at least one instruction must be provided');
  }
  if (platforms.length === 0) {
    throw new Error('at least one platform must be provided');
  }

  for (const name of instructions) {
    if (!AVAILABLE_INSTRUCTIONS.includes(name)) {
      throw new Error(
        `unknown instruction "${name}". Expected one of: ${AVAILABLE_INSTRUCTIONS.join(', ')}`
      );
    }
  }
  for (const platform of platforms) {
    if (!Object.hasOwn(TARGETS, platform)) {
      throw new Error(
        `unknown platform "${platform}". Expected one of: ${Object.keys(TARGETS).join(', ')}`
      );
    }
  }

  const rows = instructions.map(name => {
    const paths = platforms.map(p => `\`${TARGETS[p](name)}\``).join(' / ');
    return `| ${SCOPE_LABELS[name]} | ${paths} |`;
  });

  return [
    '## Domain Development Instructions',
    '',
    'Before designing, modifying, or reviewing code in the selected areas below, **read the corresponding instruction file first** (do not rely on filename glob matching alone):',
    '',
    '| Development Area | Mandatory Instruction |',
    '|---|---|',
    ...rows,
    '',
  ].join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--routing') {
      const [, platformsArg, instructionsArg] = args;
      if (!platformsArg || !instructionsArg) {
        throw new Error(
          'usage: render-instruction.cjs --routing <platform1,platform2> <instruction1,instruction2>'
        );
      }
      const platforms = platformsArg.split(',').map(s => s.trim()).filter(Boolean);
      const instructions = instructionsArg.split(',').map(s => s.trim()).filter(Boolean);
      process.stdout.write(renderRoutingSection(instructions, platforms));
    } else {
      const [instructionName, platform] = args;
      process.stdout.write(renderInstruction(instructionName, platform));
    }
  } catch (error) {
    process.stderr.write(`Instruction render error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  AVAILABLE_INSTRUCTIONS,
  TARGETS,
  SCOPE_LABELS,
  renderInstruction,
  renderRoutingSection,
};
