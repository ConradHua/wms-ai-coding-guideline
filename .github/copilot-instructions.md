# Project Instructions

## Project purpose

This repository is a library of reusable WMS AI coding presets and the home of the `wms-develop-setup` skill.

The repository will store predefined:

- Agents.
- Custom instructions.
- Hooks.
- Skills.

The goal of `wms-develop-setup` is to help users configure their development projects by selecting and installing suitable presets for their AI coding platform and development needs.

## Intended setup workflow

When developing this skill, implement the following workflow incrementally:

1. Identify the user's current AI coding platform, such as Cursor, GitHub Copilot, or Codex. Use runtime information and repository clues without treating existing configuration files as definitive proof.
2. Present the detected platform and ask the user to confirm or correct it. If detection is uncertain, ask rather than silently choosing a platform.
3. Confirm the target project and ask what kind of development the user wants to perform. Gather only the information needed to select relevant presets, such as the development task and technology stack.
4. Select suitable agents, custom instructions, hooks, and skills from this repository's presets. Do not assume every development scenario needs every preset type.
5. Map the selected presets to the confirmed platform's supported file names, paths, and formats.
6. Show the proposed files and any conflicts, then obtain confirmation before writing to the target project.
7. Create or update the approved configuration and verify the resulting files. Report what was installed and any remaining manual activation steps.

## Implementation principles

- Prefer repository presets over inventing new configuration during setup. If no suitable preset exists, explain the gap and ask how to proceed.
- Treat `agent.md` (singular) as an informal description of repository instructions, not the actual filename. Default to `AGENTS.md` (plural, uppercase) for cross-platform repository instructions across Codex, GitHub Copilot, and Cursor, while still allowing platform-specific instruction paths (such as `.github/copilot-instructions.md` or `.cursor/rules/*.mdc`) when explicitly requested or required by another platform. Distinguish repository instructions from custom agent definitions.
- Do not assume agents, instructions, skills, or hooks are interchangeable across platforms. Explicitly report unsupported capabilities.
- Preserve existing project configuration. Explain proposed merges or replacements and obtain approval; avoid duplicate additions when setup is run again.
- Explain what a hook will execute before installing it. Installing a hook does not authorize immediately executing its commands.
- Keep this repository's project instructions separate from the presets installed into user projects. Do not copy this file into a target project as a development preset.

## Current implementation scope

This repository is packaged as a cross-platform AI coding plugin targeting **GitHub Copilot**, **Cursor**, and **Codex**:

- **Plugin manifests & generated plugin agents**: Driven by `plugin.meta.json` and generated via `node scripts/build-plugin.cjs` into `.github/plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`, `plugins/copilot/agents/`, and `plugins/cursor/agents/`. Verify drift and cross-platform behavior with `node scripts/verify-plugin.cjs`.
- **Shared skills**: `skills/wms-develop-setup/`, `skills/domain-modeling/`, and `skills/security-and-hardening/` (each with `SKILL.md` and `agents/openai.yaml`).
- **Workspace setup (`wms-develop-setup`)**: The current [wms-develop-setup skill](../skills/wms-develop-setup/SKILL.md) focuses on workspace-only setup guided by a **Setup Confirmation Checklist**: confirming the target workspace root, preparing `<workspace-root>/docs/adr/` (with `.gitkeep` if missing, without pre-creating an empty `GLOSSARY.md`), creating or idempotently merging `Communication Guidelines`, `Domain Modeling`, and (when domain instructions are selected) `Domain Development Instructions` routing into `<workspace-root>/AGENTS.md`, optionally deploying focus-selected domain development instructions (`sap-rfc`, `oracle`, `rest-api`) for GitHub Copilot, Cursor, and/or Codex from `assets/instructions/`, optionally deploying feature-selected `governance-audit` hooks for GitHub Copilot and/or Cursor from `assets/hooks/governance-audit/` (with `prompt-redaction` scoped to Copilot and Codex explicitly skipped), and optionally deploying platform-formatted custom review agents (`code-reviewer`, `security-auditor`) for GitHub Copilot, Cursor, and/or Codex from `assets/agents/` (no global/user-level installation).

After modifying `plugin.meta.json`, agent templates, instruction templates, or hook scripts, run `node scripts/build-plugin.cjs` and `node scripts/verify-plugin.cjs`.
