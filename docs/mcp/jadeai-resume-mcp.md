# JadeAI Resume MCP

JadeAI Resume MCP 是本地 stdio MCP 服务，让 Codex、Claude、Cursor 读取 JadeAI 简历、JD 分析和知识图谱，并在写入前强制创建版本或只返回预览 diff。

## 启动

```bash
pnpm exec tsx scripts/jadeai-resume-mcp.ts
```

MCP 客户端建议使用 wrapper 启动：

```bash
/Users/talexdreamsoul/Workspace/Projects/JadeAI/scripts/jadeai-resume-mcp.sh
```

服务会先切换到脚本所在的项目根目录，再读取 `.env` 和 `.env.local`，复用现有 `DB_TYPE`、`SQLITE_PATH`、`DATABASE_URL` 等数据库配置。即使 MCP 客户端从其他工作目录启动，SQLite 相对路径和 Drizzle migrations 也会按 JadeAI 项目根目录解析。

## 本地用户绑定

优先级如下：

1. `JADEAI_MCP_USER_ID`
2. `JADEAI_MCP_USER_EMAIL`
3. `JADEAI_MCP_FINGERPRINT`
4. 当 `AUTH_ENABLED=false` 时，默认使用 `demo-fingerprint`

建议在本地 agent 配置里显式设置 `JADEAI_MCP_USER_ID` 或 `JADEAI_MCP_FINGERPRINT`，避免 agent 读到错误用户的数据。

## 工具

只读工具：

- `list_resumes`
- `get_resume`
- `list_jd_analyses`
- `get_jd_analysis`
- `list_analyses`
- `get_analysis`
- `search_knowledge`
- `analyze_resume_readiness`
- `get_resume_context_pack`
- `draft_project_for_resume`
- `list_resume_chats`
- `get_resume_chat`
- `summarize_resume_chats`

写入工具：

- `create_resume_version`
- `update_resume_section`
- `apply_suggestion`
- `create_role_resume`

写入安全约束：

- `update_resume_section`、`apply_suggestion`、`create_role_resume` 默认只返回 `mode: "preview"` 和 diff，不写数据库。
- 要真正写入，必须先调用 `create_resume_version`，再把返回的 `version.id` 作为 `versionId` 传入，并设置 `apply: true`。
- 写入成功后会再创建一个 after version，并记录 resume event。

## Codex 配置示例

先 dry-run 查看将写入的配置：

```bash
pnpm run mcp:resume:install
```

确认后再写入本机 Codex 配置：

```bash
pnpm run mcp:resume:install -- --apply
```

脚本会更新 `/Users/talexdreamsoul/.codex/config.toml` 中的 `jadeai-resume` MCP 段，并在写入前创建 `.bak` 备份。可以用 `--user-id`、`--user-email` 或 `--fingerprint` 指定本地用户绑定。

```toml
[mcp_servers.jadeai-resume]
type = "stdio"
command = "/Users/talexdreamsoul/Workspace/Projects/JadeAI/scripts/jadeai-resume-mcp.sh"

[mcp_servers.jadeai-resume.env]
JADEAI_MCP_FINGERPRINT = "demo-fingerprint"
```

## Claude Desktop 配置示例

```json
{
  "mcpServers": {
    "jadeai-resume": {
      "command": "/Users/talexdreamsoul/Workspace/Projects/JadeAI/scripts/jadeai-resume-mcp.sh",
      "env": {
        "JADEAI_MCP_FINGERPRINT": "demo-fingerprint"
      }
    }
  }
}
```

## Cursor 配置示例

```json
{
  "mcpServers": {
    "jadeai-resume": {
      "command": "/Users/talexdreamsoul/Workspace/Projects/JadeAI/scripts/jadeai-resume-mcp.sh",
      "env": {
        "JADEAI_MCP_FINGERPRINT": "demo-fingerprint"
      }
    }
  }
}
```

## 本地协议 smoke

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | pnpm exec tsx scripts/jadeai-resume-mcp.ts
```

期望返回 `jadeai-resume-mcp` 的 initialize 结果和工具列表。

## 工具行为 smoke

```bash
pnpm run smoke:mcp:resume
```

该脚本会使用 `/private/tmp` 下的临时 SQLite 数据库，真实调用 MCP tool handler，覆盖：

- Phase 2 只读工具：`list_resumes`、`get_resume`、`list_jd_analyses`、`get_jd_analysis`、`search_knowledge`
- 知识结构分析：`analyze_resume_readiness` 会返回简历完整度、JD 匹配缺口、知识图谱 mindmap、个人记忆覆盖度、后续提问和学习建议
- Agent 上下文包：`get_resume_context_pack` 会整合简历摘要、JD 分析、readiness、知识图谱、个人记忆、近期聊天和安全下一步建议，方便本地 agent 快速理解如何把项目写入简历网站
- 项目入简历草稿：`draft_project_for_resume` 根据项目描述生成 `projects` section 预览 diff，不写数据库；确认后仍需 `create_resume_version` + `update_resume_section`
- 历史对话摘要：`summarize_resume_chats` 从近期简历对话中抽取关键词、行动项、可沉淀个人记忆草稿和后续问题，不写数据库
- Phase 3 写入工具：`create_resume_version`、`update_resume_section`、`apply_suggestion`、`create_role_resume`
- 写入安全门禁：默认 preview、无 `versionId` 时拒绝写入、带 MCP version 后才 apply，并生成 after version 或新角色简历版本

## 完成度检查

```bash
pnpm run check:mcp:resume
```

该脚本会静态检查工具注册、安全门禁、wrapper、安装脚本、文档和当前 Codex 配置状态。默认不会因为 Codex 尚未安装而失败；如果要把本机 Codex 配置也作为硬门禁：

```bash
pnpm run check:mcp:resume -- --require-codex-config
```
