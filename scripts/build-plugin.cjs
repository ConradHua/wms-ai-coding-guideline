#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DISPLAY_NAME = 'WMS AI Coding Guideline';
const { renderAgent } = require(path.join(
  ROOT,
  'skills',
  'wms-develop-setup',
  'assets',
  'agents',
  'render-agent.cjs'
));

function loadMeta() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin.meta.json'), 'utf8'));
}

function formatJson(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

function buildManifests(meta) {
  const common = {
    name: meta.name,
    version: meta.version,
    description: meta.description,
    license: meta.license,
    author: meta.author,
    keywords: meta.keywords,
  };

  return {
    '.github/plugin/plugin.json': formatJson({
      ...common,
      skills: './skills/',
      agents: './plugins/copilot/agents/',
    }),
    '.cursor-plugin/plugin.json': formatJson({
      ...common,
      skills: './skills/',
      agents: './plugins/cursor/agents/',
    }),
    '.cursor-plugin/marketplace.json': formatJson({
      name: meta.name,
      displayName: DISPLAY_NAME,
      owner: meta.author,
      metadata: {
        description: meta.description,
        version: meta.version,
      },
      plugins: [
        {
          name: meta.name,
          source: '.',
          description: meta.description,
          version: meta.version,
          author: meta.author,
          license: meta.license,
          keywords: meta.keywords,
          category: 'Developer Tools',
        },
      ],
    }),
    '.codex-plugin/plugin.json': formatJson({
      ...common,
      skills: './skills/',
      interface: {
        displayName: DISPLAY_NAME,
        shortDescription: 'WMS domain modeling, security hardening, and cross-platform workspace setup.',
        category: 'Developer Tools',
      },
    }),
  };
}

function buildGeneratedFiles(meta = loadMeta()) {
  const outputs = buildManifests(meta);
  for (const agent of meta.agents) {
    outputs[`plugins/copilot/agents/${agent}.agent.md`] = renderAgent(agent, 'copilot');
    outputs[`plugins/cursor/agents/${agent}.md`] = renderAgent(agent, 'cursor');
  }
  return outputs;
}

function writeAll() {
  const outputs = buildGeneratedFiles();
  for (const [relPath, content] of Object.entries(outputs)) {
    const absPath = path.join(ROOT, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
  }
  return Object.keys(outputs);
}

if (require.main === module) {
  const written = writeAll();
  process.stdout.write(`Generated ${written.length} plugin files:\n${written.map(p => `  - ${p}`).join('\n')}\n`);
}

module.exports = { ROOT, loadMeta, buildGeneratedFiles, writeAll };
