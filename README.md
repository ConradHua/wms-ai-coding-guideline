# WMS AI Coding Guideline Plugin

Cross-platform AI coding plugin for **GitHub Copilot**, **Cursor**, and **Codex**, providing shared WMS skills, read-only review agents, on-demand domain development instructions, and governance audit hooks.

## Architecture (Two-Layer Model)

1. **Plugin Distribution Layer** (installed once per platform via native plugin manifests):
   - Shared skills under `skills/`:
     - `wms-develop-setup` — interactive workspace configurator
     - `domain-modeling` — glossary & ADR workflow
     - `security-and-hardening` — security review & hardening patterns
   - Read-only review agents (`code-reviewer`, `security-auditor`) generated for Copilot and Cursor under `plugins/`.
2. **Workspace Instantiation Layer** (deployed on demand into a target repository by running `wms-develop-setup`):
   - `AGENTS.md` + `docs/adr/`
   - Focus-selected domain instructions (`sap-rfc`, `oracle`, `rest-api`) rendered to each platform's native path + `AGENTS.md` routing table
   - Feature-selected `governance-audit` hooks (GitHub Copilot & Cursor)
   - Workspace-local custom review agents (GitHub Copilot, Cursor, Codex)

## Platform Matrix

| Capability | GitHub Copilot | Cursor | Codex |
|---|---|---|---|
| Plugin Manifest | `.github/plugin/plugin.json` | `.cursor-plugin/marketplace.json` + `.cursor-plugin/plugin.json` | `.codex-plugin/plugin.json` |
| Shared Skills (`skills/*/SKILL.md`) | Supported | Supported | Supported (`agents/openai.yaml`) |
| Plugin Review Agents | `plugins/copilot/agents/*.agent.md` | `plugins/cursor/agents/*.md` | Deployed via `wms-develop-setup` (`.codex/agents/*.toml`) |
| Domain Instructions (via `wms-develop-setup`) | `.github/instructions/*.instructions.md` + `AGENTS.md` | `.cursor/rules/*.mdc` + `AGENTS.md` | `docs/ai-instructions/*.md` + `AGENTS.md` |
| Governance Audit Hooks (via `wms-develop-setup`) | `.github/hooks/governance-audit.json` (all 4 features) | `.cursor/hooks.json` (`threat-protection`, `audit-log`, `tool-audit`; no `prompt-redaction`) | Not supported (explicitly skipped) |

Cursor's Add Marketplace import reads `.cursor-plugin/marketplace.json`. That catalog lists this repository's single plugin with `source: "."`, which resolves to the root `.cursor-plugin/plugin.json`.

## Maintenance & Verification

`plugin.meta.json` and `skills/wms-develop-setup/assets/` are the single source of truth. After updating metadata, agents, instructions, or hooks, regenerate manifests and run verification:

```bash
node scripts/build-plugin.cjs
node scripts/verify-plugin.cjs
```
