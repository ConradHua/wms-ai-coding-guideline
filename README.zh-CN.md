# WMS AI Coding Guideline

[English](./README.md) | 中文

这是一套给 AI 用的 WMS 编码规矩，可以装在 **Cursor**、**GitHub Copilot**、**Codex** 上。装上插件，只是让 AI 认识这些技能。真正把规矩写进你的仓库，要靠下面这个技能。


## 怎么安装这个插件

仓库地址：

```text
https://github.com/ConradHua/wms-ai-coding-guideline
```

三个平台都是同一件事：**先用这个地址加 marketplace / 源，再安装里面的 `wms-ai-coding-guideline` 插件。**

### Cursor

1. 打开 Cursor 的插件设置（Dashboard → Plugins，或 IDE 里的 Plugins / Marketplace）。
2. 选择 **Add Marketplace** / **Import from Repo**，粘贴上面的仓库地址。
3. Cursor 会读仓库里的 `.cursor-plugin/marketplace.json`，列出插件。
4. 安装 `wms-ai-coding-guideline`。

> Team Marketplace 通常需要 Teams / Enterprise。个人环境若入口不同，目标一样：用这个仓库地址导入 marketplace，再安装插件。

### GitHub Copilot（VS Code）

任选一种：

1. **直接装**：命令面板运行 `Chat: Install Plugin from Source`，粘贴仓库地址，确认安装。
2. **先加 marketplace**：命令面板运行 `Chat: Manage Plugin Marketplaces` → **Add Marketplace...**，粘贴仓库地址；再到 Customize / Plugins 里找到并安装 `wms-ai-coding-guideline`。

首次安装时若弹出信任提示，先看清来源再确认。装完后如未生效，重开一次 Chat。

### Codex

1. 打开 Codex / ChatGPT 桌面端的 **Plugins**。
2. 选择 **Add marketplace**，粘贴仓库地址（或 `ConradHua/wms-ai-coding-guideline`）。
3. 在新出现的 marketplace 里安装 `wms-ai-coding-guideline`。
4. **新开一场对话**，插件才会加载进来。

CLI 也可以先加源再装：

```bash
codex plugin marketplace add ConradHua/wms-ai-coding-guideline
codex plugin list
codex plugin add <插件名@marketplace名>
```

`plugin list` 里能看到实际名字，再按显示的名字安装。

装好插件后，打开你真正要开发的仓库，对 AI 说「帮我设置 WMS 开发环境」，继续用下面的 `wms-develop-setup`。

## 最重要：wms-develop-setup

这是整个 guideline 的入口。它只配置**当前仓库**，不会改你电脑上的全局设置（例如 `~/.cursor`、`~/.copilot`）。

它会先和你确认，再列出完整的写入计划。你明确同意之前，它不创建、不修改任何文件。已经有的内容会合并，不会悄悄覆盖。

### 它会做什么

一定会准备这两样：`AGENTS.md` 和 `docs/adr/`。下面先把 `AGENTS.md` 说清楚。

#### `AGENTS.md`：仓库里给 AI 看的总说明书

在 AI coding 里，模型不会自动“记得”这个项目的规矩。每次对话它都像新人进组：不知道该用中文还是英文、不知道哪些业务词已经定过、也不知道该读哪份开发说明。

`AGENTS.md` 就是放在仓库根目录的总说明书。Cursor、Copilot、Codex 打开这个项目时，都会优先读它。你可以把它理解成：

> 这个仓库对 AI 的站立规则——沟通怎么说、什么时候要停下来问人、业务说明去哪找。

`wms-develop-setup` 写入的内容通常包括：

1. **沟通规矩**：默认中文、先说结论；话可以简单，代码质量不能降。
2. **领域建模触发条件**：什么时候该问你要不要记词汇或架构决定（对应下面的 `domain-modeling`）。
3. **业务说明路由表**（可选）：你装了哪些领域开发说明、文件在哪。三个平台都按这张表去读，不依赖文件名是否刚好匹配。

它还会准备 `docs/adr/`，留给以后写架构决定。空的 `GLOSSARY.md` 不会提前建，等真有词要记时再写。

下面三项按你的选择安装，可以全要，也可以都不要：

| 你选的内容 | 写到哪里 |
|---|---|
| 业务开发说明（`sap-rfc` / `oracle` / `rest-api`） | Copilot：`.github/instructions/`；Cursor：`.cursor/rules/`；Codex：`docs/ai-instructions/`。同时在 `AGENTS.md` 里加路由表。 |
| 治理钩子 `governance-audit` | 脚本放在 `hooks/governance-audit/`。Copilot 写入 `.github/hooks/governance-audit.json`，Cursor 写入 `.cursor/hooks.json`，Codex 写入 `.codex/hooks.json`。需要本机有 Node.js。 |
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

这两个随插件一起可用，不用先跑上面的安装。`AGENTS.md` 里的触发条件，会提醒 AI 在该问的时候来问你。

### 领域建模（domain-modeling）

#### 它在 AI coding 里解决什么问题

AI 写业务代码时，最容易翻车的不是语法，而是**词义不一致**：

- 你说「取消」，AI 理解成整单作废；代码里其实是部分退货。
- 上一周定过「收货事件」的含义，新对话里 AI 又发明一个新名字。
- 为什么选消息队列而不是同步调用，三个月后没人记得，AI 更不知道。

领域建模就是把「业务语言」和「难改回来的设计决定」写进仓库，让之后的 AI（和人）有同一本字典可查。

#### 它具体做什么

它维护两样东西：

| 文件 | 记什么 | 不记什么 |
|---|---|---|
| `GLOSSARY.md` | 业务词的准确定义，例如「收货事件 = 一次可验证的 WMS 收货事实」 | 类名、表结构、接口路径等实现细节 |
| `docs/adr/*.md` | 难改回来、不写清楚后人会困惑、且当时有过真取舍的决定 | 小修小补、一眼能看懂的常规写法 |

工作时 AI 会主动做这些事：发现用词含糊就追问、和现有词汇表对一下、拿边界场景压一压、发现说法和代码打架就指出来。词义谈定了，再问你要不要写入；你同意之后才改文件。

#### 什么时候会用到

- 需求或设计讨论里出现新词、模糊词、命名冲突。
- 在定实体边界、状态流转或关键业务规则。
- 在做以后很难反悔的架构取舍（这时可能该写一条 ADR）。

修小 bug、改文案、机械重构时，一般不会打扰你。你也可以直接说「把这个词记进词汇表」或「记一条 ADR」。

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

AI 执行过程中自动检查。需要本机有 Node.js。

- **threat-protection**：发现高危请求先停住，等你明确确认或取消，期间不放行工具调用。
- **prompt-redaction**：从发给模型的内容里遮掉识别到的凭证和个人信息。仅 Copilot。
- **audit-log**：记录会话、提示和策略决定。
- **tool-audit**：记录工具调用、参数摘要和结果。
- **license-check**：回合结束时检查新依赖的许可证（如 GPL / AGPL），按你选的 `warn` 或 `block` 处理。

日志写在 `logs/copilot/governance/`。安装时会问你要不要把这个目录加进 `.gitignore`。
