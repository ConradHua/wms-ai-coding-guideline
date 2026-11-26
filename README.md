# WMS AI Coding Guideline

English | [中文](./README.zh-CN.md)

A set of WMS coding rules for AI assistants. It runs on **Cursor**, **GitHub Copilot**, and **Codex**. Installing the plugin only teaches the AI these skills. Writing those rules into your own repository is the job of `wms-develop-setup` below.

## Install the plugin

Repository:

```text
https://github.com/ConradHua/wms-ai-coding-guideline
```

All three platforms follow the same idea: **add this repository as a marketplace or source, then install the** `wms-ai-coding-guideline` **plugin.**

### Cursor

1. Open Cursor plugin settings (Dashboard → Plugins, or Plugins / Marketplace in the IDE).
2. Choose **Add Marketplace** / **Import from Repo** and paste the repository URL above.
3. Cursor reads `.cursor-plugin/marketplace.json` and lists the plugin.
4. Install `wms-ai-coding-guideline`.

> Team Marketplace usually requires a Teams or Enterprise plan. If a personal account uses a different entry point, the goal is the same: import this repository as a marketplace, then install the plugin.

### GitHub Copilot (VS Code)

Either path works:

1. **Install directly.** Run `Chat: Install Plugin from Source` from the Command Palette, paste the repository URL, and confirm.
2. **Add the marketplace first.** Run `Chat: Manage Plugin Marketplaces` → **Add Marketplace...**, paste the repository URL, then find and install `wms-ai-coding-guideline` under Customize / Plugins.

If a trust prompt appears, check the source before you confirm. If the plugin does not show up, start a new Chat.

### Codex

1. Open **Plugins** in the Codex or ChatGPT desktop app.
2. Choose **Add marketplace** and paste the repository URL (or `ConradHua/wms-ai-coding-guideline`).
3. Install `wms-ai-coding-guideline` from the new marketplace.
4. **Start a new conversation** so the plugin loads.

You can also add the source from the CLI, then install by the name it prints:

```bash
codex plugin marketplace add ConradHua/wms-ai-coding-guideline
codex plugin list
codex plugin add <plugin-name@marketplace-name>
```

After the plugin is installed, open the repository you actually want to develop and tell the AI: "Set up the WMS development environment." That starts `wms-develop-setup`.

## The important skill: wms-develop-setup

This is the entry point of the whole guideline. It configures **only the current repository**. It does not change global settings on your machine (such as `~/.cursor` or `~/.copilot`).

It confirms your choices first, then shows a complete write plan. It does not create or edit any file until you explicitly approve. Existing content is merged. It is not overwritten in silence.

### What it does

It always prepares two things: `AGENTS.md` and `docs/adr/`. `AGENTS.md` comes first.

#### `AGENTS.md`: the standing instructions the AI reads

In AI coding, the model does not automatically remember this project's rules. Every new chat is like a new teammate walking in: it does not know whether to answer in Chinese or English, which business terms are already settled, or which development notes to read.

`AGENTS.md` is that standing document at the repository root. Cursor, Copilot, and Codex read it when they open the project. Think of it as:

> The house rules for AI in this repository — how to talk, when to stop and ask, and where the domain notes live.

`wms-develop-setup` usually writes three kinds of content:

1. **Communication rules**: Chinese by default, lead with the conclusion. Keep the explanation simple. Do not lower the quality of the code.
2. **Domain-modeling triggers**: when the AI should ask whether to record a term or an architecture decision (see `domain-modeling` below).
3. **Domain instruction routing table** (optional): which domain notes are installed and where the files are. All three platforms follow this table. They do not depend on a filename happening to match a glob.

It also prepares `docs/adr/` for later architecture decisions. An empty `GLOSSARY.md` is not created ahead of time. The glossary appears when there is a real term to record.

The next three items are optional. Take all of them, some of them, or none.

| What you select | Where it is written |
|---|---|
| Domain development instructions (`sap-rfc` / `oracle` / `rest-api`) | Copilot: `.github/instructions/`. Cursor: `.cursor/rules/`. Codex: `docs/ai-instructions/`. A routing table is also added to `AGENTS.md`. |
| Governance hooks (`governance-audit`) | Scripts go in `hooks/governance-audit/`. Copilot writes `.github/hooks/governance-audit.json`. Cursor writes `.cursor/hooks.json`. Codex writes `.codex/hooks.json`. Node.js is required. |
| Read-only review agents (`code-reviewer` / `security-auditor`) | Copilot: `.github/agents/`. Cursor: `.cursor/agents/`. Codex: `.codex/agents/`. |

### How to use it

In the target repository, say any of these and the skill starts:

- "Set up the WMS development environment."
- "Initialize `AGENTS.md` for this repository."
- "Install the SAP RFC / Oracle / REST API development instructions."
- "Install the governance-audit hooks."
- "Add code-reviewer and security-auditor to this project."

It then asks, in order, and waits for your answer:

1. Which repository root to configure.
2. Whether to write `AGENTS.md` and `docs/adr/`.
3. Which area you are working on: `sap-rfc`, `oracle`, `rest-api`, or none.
4. Which governance hooks to enable. If license checking is selected, also choose `warn` (warn only) or `block` (stop on a violation).
5. Which review agents to deploy.
6. Which platforms to generate for. This is asked only when step 3, 4, or 5 selected at least one item.
7. The full list of files to create or change. Nothing is written until you approve that list.

## Two other skills in the plugin

These two come with the plugin. You do not need to run setup first. The triggers in `AGENTS.md` tell the AI when it should ask you.

### Domain modeling (`domain-modeling`)

#### What it does in AI coding

When an AI writes business code, the usual failure is not syntax. It is **the same word meaning two different things**:

- You say "cancel." The AI treats it as voiding the whole order. The code actually means a partial return.
- Last week you defined "goods receipt event." In a new chat the AI invents another name.
- You chose a message queue over a synchronous call. Three months later nobody remembers why, and the AI has no way to know.

Domain modeling writes the business language and the hard-to-reverse design decisions into the repository, so later AI sessions and people share one dictionary.

#### What it maintains

| File | What it records | What it leaves out |
|---|---|---|
| `GLOSSARY.md` | Precise business terms, such as "goods receipt event = one verifiable WMS receipt fact" | Implementation details such as class names, table layouts, and API paths |
| `docs/adr/*.md` | Decisions that are hard to reverse, confusing without context, and the result of a real trade-off | Small fixes and ordinary choices that are obvious from the code |

While you talk, the AI asks when a word is fuzzy, checks the existing glossary, presses on boundary cases, and points out when your explanation disagrees with the code. After a term is settled, it asks whether to write it down. It edits the file only after you agree.

#### When it shows up

- A requirement or design discussion introduces a new term, a fuzzy term, or a naming clash.
- You are defining entity boundaries, state transitions, or key business rules.
- You are making an architecture choice that will be hard to undo. That may be an ADR.

It usually stays quiet during small bug fixes, copy changes, and mechanical refactors. You can also say "add this term to the glossary" or "record an ADR."

### Security and hardening (`security-and-hardening`)

When the work touches user input, login, sessions, sensitive data, or external systems, draw the trust boundary first, then write the code.

Just describe the feature. You do not need to name this skill.

## Capabilities that appear only after setup

These do not show up in your project just because the plugin is installed. `wms-develop-setup` deploys the ones you select.

### Two read-only review agents

- **code-reviewer**: reviews a change for correctness, readability, architecture, security, and performance.
- **security-auditor**: looks for exploitable issues and recommends hardening.

Name them in the chat. They give feedback and do not edit code. Copilot and Cursor can also use the same agents shipped with the plugin. Codex needs them deployed into the repository first.

### Three domain development instructions

The AI reads the matching note when it edits that kind of code:

- **sap-rfc**: SAP NCo, BAPI goods receipt, batch classification, inbound RFC, field mapping, and failure recovery.
- **oracle**: Oracle SQL, ASN sync, material availability, ODP.NET / EF Core, idempotency, and transactions.
- **rest-api**: ASP.NET Core APIs, PDA goods receipt, DTOs, authentication and authorization, and idempotency.

### Governance hooks (`governance-audit`)

These checks run while the AI works. Node.js is required.

- **threat-protection**: stops a high-risk request until you explicitly confirm or cancel it, and blocks tool calls while it is pending.
- **prompt-redaction**: masks recognized credentials and personal data in text sent to the model. Copilot only.
- **audit-log**: records the session, prompts, and policy decisions.
- **tool-audit**: records tool calls, argument previews, and outcomes.
- **license-check**: at the end of a turn, checks licenses of newly added dependencies (such as GPL / AGPL) and follows the `warn` or `block` mode you chose.

Logs are written to `logs/copilot/governance/`. During setup you are asked whether to add that directory to `.gitignore`.
