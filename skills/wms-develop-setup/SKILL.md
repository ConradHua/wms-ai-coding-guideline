---
name: wms-develop-setup
description: Set up the WMS development workspace by configuring AGENTS.md (communication guidelines, domain-modeling triggers, and optional domain instruction routing), preparing docs/adr/, optionally deploying selected domain development instructions (sap-rfc, oracle, rest-api) and custom review agents (code-reviewer, security-auditor) for GitHub Copilot, Cursor, or Codex, and optionally deploying selected governance-audit hooks for GitHub Copilot or Cursor. Use this skill when the user asks to initialize or configure WMS repository instructions, create agent.md or AGENTS.md, install domain-specific instructions (SAP RFC, Oracle, REST API), install governance-audit hooks, or add WMS review agents to a workspace.
---

# WMS Develop Setup

Configure the target workspace root with:

1. `<workspace-root>/AGENTS.md` (WMS communication guidelines, domain-modeling trigger instructions, and—when domain instructions are selected—a `Domain Development Instructions` routing table).
2. `<workspace-root>/docs/adr/` (directory prepared for future ADRs).
3. Optional **Domain Development Instructions** (`sap-rfc`, `oracle`, `rest-api`), deployed on demand based on the user's current development focus for their chosen platform(s): GitHub Copilot, Cursor, and/or Codex.
4. Optional **Governance Audit** hooks for GitHub Copilot and/or Cursor (requires Node.js; Codex does not support hooks), deployed on demand based on selected features.
5. Optional **Custom Review Agents** (`code-reviewer`, `security-auditor`), deployed on demand for the user's chosen platform(s): GitHub Copilot, Cursor, and/or Codex.

Only deploy within the workspace—never write to user-level or global configuration directories.

## Bundled assets

All runtime assets are bundled inside this skill (self-contained):

- `./assets/instructions/`
  - `sap-rfc.md` — canonical SAP RFC (NCo, BAPI, Registered RFC, batch classification) instruction template
  - `oracle.md` — canonical Oracle (SQL, ASN sync, material availability, ODP.NET/EF Core, transactions) instruction template
  - `rest-api.md` — canonical REST API (ASP.NET Core, PDA goods receipt, DTOs, auth, idempotency) instruction template
  - `render-instruction.cjs` — platform formatter for `copilot`, `cursor`, and `codex`, plus `--routing` generator for `AGENTS.md` (stdout)
- `./assets/hooks/governance-audit/`
  - `feature-map.json` — canonical inventory of selectable hook features, platform support, and required events
  - `compose-config.cjs` — selective hook config generator for `copilot` and `cursor` (stdout JSON)
  - `governance.cjs`, `threat-scan.cjs`, `request-control.cjs`, `redact-prompt.cjs`, `audit-log.cjs`, `license-check.cjs` — runtime hook modules (supports `--platform copilot|cursor`, optional `--license-mode`)
  - `report.cjs` — CLI summary report script for `logs/copilot/governance/audit.log`
- `./assets/agents/`
  - `code-reviewer.md` — canonical Senior Code Reviewer agent template
  - `security-auditor.md` — canonical Security Auditor agent template
  - `render-agent.cjs` — platform formatter for `copilot`, `cursor`, and `codex` (stdout)

## Setup Confirmation Checklist (Task List)

Before creating or editing any files, track every applicable item below and resolve it with the user. Use a task list so no confirmation step is skipped.

### How to ask

A choice the user already stated in the request is answered. Send only the still-open choices.

For each still-open choice, call this session's structured question tool: the host tool that renders known options as selectable controls (single-select or multi-select) and waits for the answer. Match it by that behavior, under whatever name this host gives it.

- The chat message states the one-line reason. The tool call carries every option.
- One checklist choice per call. Wait for the answer before the next choice.
- Items that allow any combination (3, 4, 5, 6) are multi-select and include an explicit skip option (`none`).
- Yes/no confirmations and `LICENSE_MODE` (`warn` or `block`) are single-select.
- Item 1: when `<workspace-root>` is already unambiguous, state the path and mark the item done. When more than one root is plausible, offer those folders as the options.
- Item 7: the write-plan (paths, hook command, generated JSON, conflicts) stays in the chat message. The approve / revise decision goes through the structured question tool. Wait for that answer before writing any file.
- When this session has no tool that renders selectable answers, ask the same options in chat and wait for the reply.

An item is done only after the user has answered it.

- [ ] **1. Target workspace root**: Confirm `<workspace-root>` (workspace-only; never deploy globally).
- [ ] **2. Base workspace setup (**`AGENTS.md` **+** `docs/adr/`**)**: Confirm creating or merging `Communication Guidelines` and `Domain Modeling` into `<workspace-root>/AGENTS.md` and preparing `<workspace-root>/docs/adr/` (without pre-creating an empty `GLOSSARY.md`).
- [ ] **3. Optional domain development instructions**: Ask which development area(s) the user is currently focusing on (`sap-rfc`, `oracle`, `rest-api`, any combination, or none to skip).
- [ ] **4. Optional** `governance-audit` **hooks (GitHub Copilot / Cursor + Node.js)**: Ask which features to enable (`threat-protection`, `prompt-redaction` [GitHub Copilot only], `audit-log`, `tool-audit`, `license-check`, or none to skip). If `license-check` is selected, also ask for `LICENSE_MODE` (`warn` or `block`).
- [ ] **5. Optional custom review agents**: Ask which agents to deploy (`code-reviewer`, `security-auditor`, or none to skip).
- [ ] **6. Target platform(s)** *(only if item 3, 4, or 5 selects at least one item; otherwise mark N/A)*: Ask which platform(s) to generate for (`GitHub Copilot`, `Cursor`, `Codex` — single or multiple). Note any unsupported hook capabilities for the chosen platform(s).
- [ ] **7. Final write-plan approval**: Present the complete list of files/directories to create or modify (including generated `AGENTS.md` domain routing entries if any, hook commands, generated hook JSON preview, conflict/duplicate checks, and `.gitignore` prompt if audit logs are enabled) and wait for explicit user approval before writing.

## Workflow

1. **Work through checklist items 1–6 with the user, asking each still-open choice the way "How to ask" specifies.**
   - **Workspace root (Item 1):** Resolve `<workspace-root>`. If the workspace has multiple roots or is ambiguous, ask which folder to target. If the user informally asks for `agent.md` or `AGENT.md`, note that `AGENTS.md` is the standard filename and confirm `<workspace-root>/AGENTS.md`.
   - **Workspace-only restriction:** Never install or write files to global/user-level locations (such as `~`, `~/.codex/`, `~/.copilot/`, `~/.cursor/`, or `~/.claude/`). If the user asks for a global deployment, decline and explain that this skill only configures the current workspace.
   - **Domain development instructions (Item 3):** Ask which development focus area(s) to deploy on demand—any combination or none to skip:
     - `sap-rfc`: SAP NCo calls, BAPI goods receipt, batch classification, inbound Registered RFC, field mapping, and failure recovery.
     - `oracle`: Oracle SQL, ASN sync, material availability jobs, ODP.NET / EF Core, idempotency, and transactions.
     - `rest-api`: ASP.NET Core REST API, PDA goods receipt endpoints, DTOs, authentication/authorization, and idempotency.
     - Explain briefly that selected instructions will be deployed as platform-native files (for auto-attachment in Copilot/Cursor and standalone Markdown for Codex) **and** indexed in `<workspace-root>/AGENTS.md` so all platforms follow them even when filenames do not match globs.
   - **Governance Audit hooks (Item 4):** Read `./assets/hooks/governance-audit/feature-map.json` and present all five selectable capabilities so the user can pick any combination—or none to skip:
     - `threat-protection` *(Copilot, Cursor)*: Scan prompts for threat signals, require explicit confirmation (`确认高危操作 <request-id>` / `取消高危操作 <request-id>`), and block tool calls while pending.
     - `prompt-redaction` *(Copilot only)*: Redact recognized credentials and personal data from model-facing prompts. Cursor hooks cannot rewrite prompt text, so explicitly report this limitation if Cursor is selected.
     - `audit-log` *(Copilot, Cursor)*: Record session lifecycle, redacted prompt previews, and risk approval events to `logs/copilot/governance/audit.log`.
     - `tool-audit` *(Copilot, Cursor)*: Record tool calls, redacted argument previews, and outcomes to `logs/copilot/governance/audit.log`.
     - `license-check` *(Copilot, Cursor)*: At turn end (`agentStop` / `stop`), scan newly added dependencies for blocked licenses (GPL/AGPL/etc.); choose `warn` (log only) or `block` (hook fails on violations).
     - If the user selects `license-check`, ask for `LICENSE_MODE`: `warn` (record/print only) or `block` (non-zero exit when violations are found). Bake the chosen mode into the generated hook config.
     - Note clearly that `governance-audit` requires **Node.js**, supports **GitHub Copilot** (`.github/hooks/governance-audit.json`) and **Cursor** (`.cursor/hooks.json`), and is **not supported on Codex** (explicitly report and skip hook config for Codex).
   - **Custom review agents (Item 5):** Present both optional read-only agents so the user can pick any combination—or none to skip:
     - `code-reviewer`: Evaluates changes across correctness, readability, architecture, security, and performance before merge.
     - `security-auditor`: Performs security-focused code review, threat analysis, and hardening recommendations (OWASP Top 10 / LLM Top 10).
   - **Target platform(s) (Item 6):** Only if Item 3, 4, or 5 selected at least one item, ask once which target platform(s) to deploy to (`GitHub Copilot`, `Cursor`, `Codex` — multiple allowed).
2. **Preview planned changes and obtain final approval (Checklist item 7).**
   - Summarize every file/directory to be created or modified:
     - `<workspace-root>/AGENTS.md` (including `Domain Development Instructions` routing table for selected domains, if any)
     - `<workspace-root>/docs/adr/` (created with empty `.gitkeep` only if missing)
     - If one or more domain instructions were selected, list each target path by platform:
       - **GitHub Copilot**: `<workspace-root>/.github/instructions/<name>.instructions.md`
       - **Cursor**: `<workspace-root>/.cursor/rules/<name>.mdc` (`alwaysApply: false`, `globs` mapped from `applyTo`)
       - **Codex**: `<workspace-root>/docs/ai-instructions/<name>.md` (plain Markdown without platform-specific frontmatter)
     - If one or more `governance-audit` features were selected (and GitHub Copilot or Cursor is among the target platforms):
       - Copy all bundled scripts from `./assets/hooks/governance-audit/` into `<workspace-root>/hooks/governance-audit/`.
       - **GitHub Copilot**: write generated hook config to `<workspace-root>/.github/hooks/governance-audit.json`.
       - **Cursor**: write generated hook config to `<workspace-root>/.cursor/hooks.json` (excluding `prompt-redaction`; if only `prompt-redaction` was selected for Cursor, skip `.cursor/hooks.json` and explain why).
       - **Codex**: skip hook config and explicitly state that Codex does not support governance-audit hooks.
     - If one or more custom agents were selected, list each target path by platform:
       - **GitHub Copilot**: `<workspace-root>/.github/agents/<name>.agent.md`
       - **Cursor**: `<workspace-root>/.cursor/agents/<name>.md` (with `readonly: true`)
       - **Codex**: `<workspace-root>/.codex/agents/<name>.toml` (with `sandbox_mode = "read-only"`)
   - **Explain what the hook executes before installing:** Show the generated JSON preview(s) and explain the exact `node hooks/governance-audit/governance.cjs ...` command executed on each registered event.
   - **Check for conflicts and duplicate registrations:**
     - Inspect existing `.github/hooks/*.json` and `.cursor/hooks.json` files in `<workspace-root>` to see if another entry already registers `governance.cjs` or if `.cursor/hooks.json` has existing user hooks that must be merged rather than overwritten.
     - Check if any target instruction files, target agent files, or `hooks/governance-audit/` files already exist and surface conflicts before overwriting.
   - Do not create or edit any file or directory until checklist item 7 is confirmed.
3. **Apply changes idempotently.**
   - **Prepare** `<workspace-root>/docs/adr/`**:**
     - If `docs/adr/` does not exist, create it with an empty `.gitkeep` file so Git can track the directory without interfering with sequential ADR numbering (`0001-slug.md`, etc.).
     - If `docs/adr/` already exists, leave it untouched (do not overwrite existing files or add `.gitkeep` to an existing directory).
     - Do **not** pre-create an empty `GLOSSARY.md`, `GLOSSARY-MAP.md`, or sub-context `docs/adr/` directories—let `domain-modeling` create those lazily once the first term or multi-context structure is decided.
   - **Create or merge** `<workspace-root>/AGENTS.md`**:**
     - If `AGENTS.md` does not exist, create it with both base sections in **Instruction content** below, plus the generated `Domain Development Instructions` section if at least one domain instruction was selected.
     - If `AGENTS.md` already exists, check independently for `Communication Guidelines`, `Domain Modeling`, and (when domain instructions were selected) `Domain Development Instructions` (`#` or `##` headings):
       - For any section already present with equivalent rules, inform the user and ask whether to skip or update it—do not append duplicates.
       - If `Domain Development Instructions` already exists and the user selected additional domains or platforms, merge only the missing rows/paths idempotently without duplicating existing entries or removing previously installed entries unless requested.
       - For any missing section, preserve existing content, show the proposed addition or merge, and ask before changing the file.
       - Match the existing document's heading hierarchy if needed while keeping the bullet items verbatim.
     - Do not replace, delete, or overwrite existing instructions without explicit approval.
   - **Deploy domain development instructions (only if at least one domain was selected):**
     - If no domains were selected, skip instruction deployment completely (do not create instruction files and do not add `Domain Development Instructions` to `AGENTS.md`).
     - For each selected `(instruction, platform)` pair, generate the platform-formatted file via `node ./assets/instructions/render-instruction.cjs <instruction> <platform>` (where `<instruction>` is `sap-rfc`, `oracle`, or `rest-api`, and `<platform>` is `copilot`, `cursor`, or `codex`) and write to the mapped workspace path (creating `.github/instructions/`, `.cursor/rules/`, or `docs/ai-instructions/` as needed).
     - Generate the `AGENTS.md` routing section via `node ./assets/instructions/render-instruction.cjs --routing <platform1,platform2> <instruction1,instruction2>` so only the selected domains and their actual deployed paths are listed.
     - Do not overwrite an existing instruction file without explicit approval.
   - **Deploy** `governance-audit` **hooks (only if at least one supported feature was selected for Copilot or Cursor):**
     - If no supported features were selected, skip hook deployment completely (do not copy scripts and do not write an empty hook config).
     - Copy all 9 bundled files from `./assets/hooks/governance-audit/` into `<workspace-root>/hooks/governance-audit/`.
     - For **GitHub Copilot**: generate the selective config via `node <workspace-root>/hooks/governance-audit/compose-config.cjs --platform copilot [--license-mode warn|block] <feature1> ...` and write to `<workspace-root>/.github/hooks/governance-audit.json` (creating `.github/hooks/` if needed). When `license-check` is selected, pass `--license-mode` matching the user's choice (default `warn`).
     - For **Cursor**: generate the selective config via `node <workspace-root>/hooks/governance-audit/compose-config.cjs --platform cursor [--license-mode warn|block] <cursor-supported-features...>` and write or merge into `<workspace-root>/.cursor/hooks.json` (creating `.cursor/` if needed; preserve any existing non-governance hooks). When `license-check` is selected, pass `--license-mode` matching the user's choice (default `warn`).
     - Include the chosen `LICENSE_MODE` / `--license-mode` in the JSON preview shown before install.
     - Installing the hook does **not** authorize executing `governance.cjs` itself during setup.
     - If `threat-protection`, `audit-log`, `tool-audit`, or `license-check` is enabled, remind the user that runtime logs and state are written to `logs/copilot/governance/` and ask whether to add `logs/copilot/governance/` to `<workspace-root>/.gitignore` (do not edit `.gitignore` without confirmation).
   - **Deploy custom review agents (only if at least one agent was selected):**
     - If no agents were selected, skip agent deployment completely.
     - For each selected `(agent, platform)` pair, generate the platform-formatted file via `node ./assets/agents/render-agent.cjs <agent> <platform>` (where `<platform>` is `copilot`, `cursor`, or `codex`) and write to the mapped workspace path (creating `.github/agents/`, `.cursor/agents/`, or `.codex/agents/` as needed).
     - Do not overwrite an existing agent file without explicit approval.
4. **Verify and report.**
   - Confirm exact workspace paths created or updated:
     - `<workspace-root>/AGENTS.md` (all four communication guidelines + domain-modeling trigger instructions present, plus `Domain Development Instructions` routing table matching selected domains if any, with no duplicate sections).
     - `<workspace-root>/docs/adr/` (ready, and no empty `GLOSSARY.md` created).
     - If domain instructions were deployed: list each generated instruction file path and confirm valid frontmatter (for Copilot/Cursor) or clean Markdown (for Codex) and matching paths in `AGENTS.md`.
     - If hooks were deployed: `<workspace-root>/hooks/governance-audit/` (all 9 files present) and each generated hook config (`.github/hooks/governance-audit.json` and/or `.cursor/hooks.json`) containing valid JSON with only the events required by selected features (and baked `LICENSE_MODE` / `--license-mode` when `license-check` is enabled).
     - If custom agents were deployed: list each generated agent file path and confirm valid frontmatter/TOML formatting.
   - Briefly summarize how to use the installed items in this workspace (e.g. automatic path-based attachment in Copilot/Cursor and `AGENTS.md` routing across all platforms for domain instructions; `node hooks/governance-audit/report.cjs` for audit summaries; switching/invoking custom agents in Copilot, `/code-reviewer` or `/security-auditor` in Cursor, and subagent delegation in Codex) and note any remaining manual steps (such as `.gitignore` updates or reloading the editor/session).

## Instruction content

Use the bullet items below verbatim, preserving their meaning and emphasis (adjusting only heading levels if needed to match an existing file's hierarchy):

```markdown
## Communication Guidelines

- Communicate in Chinese by default, using an ELI5 (Explain Like I'm 5) style with simple, easy-to-understand language.
- **Lead with the conclusion.** Keep responses concise and direct, avoiding unnecessary jargon, lengthy explanations, and repetitive summaries.
- Provide only essential information by default. Explain technical principles and implementation details in depth only when explicitly requested.
- **Keep communication simple, but code professional.** Never compromise code quality, maintainability, or security for the sake of simplified explanations.

## Domain Modeling

- When reading or writing code, consult existing `GLOSSARY.md` (or `GLOSSARY-MAP.md`) files to keep terminology consistent.
- During requirement or design discussions, **ask the user** whether to run the `domain-modeling` workflow and record the outcome when any of the following occurs:
  - New or ambiguous business terms, concepts, or naming conflicts arise.
  - Domain boundaries, entity relationships, state transitions, or key business rules are being defined or changed.
  - A hard-to-reverse architectural or design trade-off is being decided (potential ADR).
- **Do not ask** during routine bug fixes, minor UI tweaks, mechanical refactoring, or simple Q&A.
- **Always confirm before writing.** Never create or modify `GLOSSARY.md` or files under `docs/adr/` without explicit user approval. Once approved, follow the `domain-modeling` skill conventions (keep `GLOSSARY.md` free of implementation details, and create ADRs in `docs/adr/` only when the decision is hard to reverse, non-obvious without context, and involves a real trade-off).
```

## Scope

This version sets up (workspace-only):

- Communication guidelines, domain-modeling trigger instructions, and (when domain instructions are selected) a `Domain Development Instructions` routing table in `<workspace-root>/AGENTS.md`.
- The `<workspace-root>/docs/adr/` directory.
- Optional, focus-selected domain development instructions (`sap-rfc`, `oracle`, `rest-api`) for GitHub Copilot, Cursor, and/or Codex.
- Optional, feature-selected `governance-audit` hooks for GitHub Copilot (`.github/hooks/governance-audit.json`) and/or Cursor (`.cursor/hooks.json`, excluding `prompt-redaction`), with shared runtime scripts under `<workspace-root>/hooks/governance-audit/`.
- Optional, platform-formatted custom review agents (`code-reviewer`, `security-auditor`) for GitHub Copilot, Cursor, and/or Codex.

Do not perform global/user-level installation, do not pre-create empty `GLOSSARY.md` or ADR files, and do not generate additional skills or unselected development rules unless the user asks for them.
