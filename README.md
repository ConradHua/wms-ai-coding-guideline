# WMS AI Coding Guideline

这是一套给 AI 用的 WMS 编码规矩，可以装在 **Cursor**、**GitHub Copilot**、**Codex** 上。装上插件，只是让 AI 认识这些技能。真正把规矩写进你的仓库，要靠下面这个技能。

更细的用法放在 [doc](./doc/) 文件夹。

## 最重要：wms-develop-setup

这是整个 guideline 的入口。它只配置**当前仓库**，不会改你电脑上的全局设置（例如 `~/.cursor`、`~/.copilot`）。

它会先和你确认，再列出完整的写入计划。你明确同意之前，它不创建、不修改任何文件。已经有的内容会合并，不会悄悄覆盖。

### 它会做什么

一定会准备这两样：

- `AGENTS.md`：默认用中文、先说结论；并写明什么时候该问你要不要做领域建模。
- `docs/adr/`：留给以后的架构决定。空的词汇表不会提前建，等真有词要记时再写。

下面三项按你的选择安装，可以全要，也可以都不要：

| 你选的内容 | 写到哪里 |
|---|---|
| 业务开发说明（`sap-rfc` / `oracle` / `rest-api`） | Copilot：`.github/instructions/`；Cursor：`.cursor/rules/`；Codex：`docs/ai-instructions/`。同时在 `AGENTS.md` 里加一张路由表，三个平台都会跟着读。 |
| 治理钩子 `governance-audit` | 脚本放在 `hooks/governance-audit/`。Copilot 写入 `.github/hooks/governance-audit.json`，Cursor 写入 `.cursor/hooks.json`。Codex 不支持，会直接跳过。需要本机有 Node.js。 |
| 只读审查代理（`code-reviewer` / `security-auditor`） | Copilot：`.github/agents/`；Cursor：`.cursor/agents/`；Codex：`.codex/agents/`。 |

### 怎么用

在目标仓库里对 AI 说下面任意一句，它就会启动这个技能：

- 「帮我设置 WMS 开发环境」
- 「初始化这个仓库的 `AGENTS.md`」
- 「安装 SAP RFC / Oracle / REST API 开发说明」
- 「安装 governance-audit 钩子」
- 「把 code-reviewer 和 security-auditor 加到这个项目」

它会按顺序问你这几件事，然后停下来等你点头：

1. 要配置哪个仓库根目录。
2. 是否写入 `AGENTS.md` 和 `docs/adr/`。
3. 当前在做哪一块：`sap-rfc`、`oracle`、`rest-api`，或都不要。
4. 要打开哪些治理钩子。选了许可证检查时，再选 `warn`（只警告）或 `block`（发现违规就拦住）。
5. 要部署哪些审查代理。
6. 要生成到哪些平台。只有第 3、4、5 步至少选了一项才会问。
7. 展示将要创建或修改的文件清单。你同意之后才写入。

## 插件里另外两个技能

这两个随插件一起可用，不用先跑上面的安装。`AGENTS.md` 里也会提醒 AI 在该问的时候来问你。

### 领域建模（domain-modeling）

把业务词写进 `GLOSSARY.md`，把难改回来的设计取舍写成 `docs/adr/` 里的 ADR。

讨论新名词、实体关系或架构取舍时，AI 会问你要不要记下来。你同意之后才写文件。

### 安全加固（security-and-hardening）

处理用户输入、登录、会话、敏感数据或外部系统时，先划清信任边界，再写代码。

做这些功能时直接说需求即可，不用点名这个技能。

## 装进仓库之后才有的能力

下面这些不是插件一装就出现在你的项目里，而是由 `wms-develop-setup` 按你的选择部署。

### 两个只读审查代理

- **code-reviewer**：从正确性、可读性、架构、安全、性能五个方面看改动。
- **security-auditor**：专门找可利用的漏洞，并给出加固建议。

在对话里点名它们。它们只给意见，不改代码。Copilot 和 Cursor 也可以直接用插件自带的同名代理；Codex 需要先部署到仓库。

### 三份领域开发说明

AI 改到对应代码时会读取：

- **sap-rfc**：SAP NCo、BAPI 收货、批次分类、入站 RFC、字段映射和失败恢复。
- **oracle**：Oracle SQL、ASN 同步、物料可用量、ODP.NET / EF Core、幂等和事务。
- **rest-api**：ASP.NET Core 接口、PDA 收货、DTO、身份权限和幂等。

### 治理钩子（governance-audit）

AI 执行过程中自动检查。Copilot 和 Cursor 可用，Codex 不支持。

- **threat-protection**：发现高危请求先停住，等你明确确认或取消，期间不放行工具调用。
- **prompt-redaction**：从发给模型的内容里遮掉识别到的凭证和个人信息。仅 Copilot。
- **audit-log**：记录会话、提示和策略决定。
- **tool-audit**：记录工具调用、参数摘要和结果。
- **license-check**：回合结束时检查新依赖的许可证（如 GPL / AGPL），按你选的 `warn` 或 `block` 处理。

日志写在 `logs/copilot/governance/`。安装时会问你要不要把这个目录加进 `.gitignore`。
