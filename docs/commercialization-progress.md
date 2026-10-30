# JadeAI 商业化成长平台进展

> 状态快照：v0.4.2，2026-08-23。目标是判断能否安全进入小规模真实用户验证，而不是累计功能数量。

## 状态口径

| 状态 | 判定标准 |
| --- | --- |
| 已实现 | 代码、数据模型和相关自动化验证已经存在。 |
| 待真实验收 | 实现已具备，但真实第三方账号、基础设施或运营流程尚未端到端通过。 |
| 未完成 | 发布所需实现或人工处置流程仍缺失。 |
| 延期 | 不属于未来 2–4 周发布基线。 |

## 总体判断

商业化核心域和两条黄金路径已经在代码层面闭环：

- 求职闭环：创建/导入简历 → JD 分析 → 专项简历 → 导出 → 模拟面试 → 投递追踪。
- 商业闭环：商品/会员 → 订单 → 结算 → 支付回调 → 履约 → 权益/钱包/通知。

当前不能据此判定“可正式上线”。Stripe Test Mode、真实 PostgreSQL、备份恢复、生产密钥与 OIDC、法律主体、托管 CI、GHCR/Jenkins preview 和人工复核流程仍缺少真实环境验收证据。

## 工程状态矩阵

| 模块 | 状态 | 已有能力 | 剩余验收或风险 |
| --- | --- | --- | --- |
| 会员与权益 | 已实现 | free / pro / premium / business 四档会员；权益覆盖 AI 配额、模型等级、简历数量、导出、模板/职位模板/题库、模拟面试、推广和积分折扣。 | 核对真实售卖方案、到期规则、降级行为和页面文案。 |
| 钱包与 AI 计量 | 已实现 | `wallet_transactions` 与 `ai_usage_logs` 支持预扣、结算、失败退款、余额不足记录；`users.aiCredits` 仅作为兼容镜像。 | 用真实模型验证流式中断、超时、重试和并发请求下的账实一致。 |
| 商品、订单与履约 | 已实现 | 统一商品模型覆盖会员、AI 点数包、简历模板、职位模板、面试题库和模拟面试包；授权统一落到权益或钱包账本。 | 核对价格、库存/上下架、退款后权益回收和客服补发流程。 |
| Stripe | 待真实验收 | 已实现 Checkout Session、服务端幂等键、客户端确认禁用、签名 webhook、livemode 校验、金额/币种/订单匹配，以及成功、处理中、失败、过期、退款和争议状态归一化。 | 使用真实 Test Mode 密钥和公开 HTTPS webhook 验证完整往返；完成域名、密钥、重复回调、退款/争议和日终对账。 |
| 模板与题库商业化 | 已实现 | 简历模板、职位模板和面试题库支持会员或购买解锁；题库有收藏、练习、错题和报告资产。 | 用真实账号验收购买前锁定、支付后授权、下载/访问和退款后的状态。 |
| 积分与增长 | 已实现 | POINT / AI_CREDIT 账本、积分兑换、兑换码、邀请关系、推广返利、抽奖和通知已经接入统一奖励出口。 | 真实活动前补奖池/预算上限、作弊处置和人工纠错流程。 |
| 投递追踪 | 已实现 | 支持投递记录 CRUD、分页筛选、阶段和结果，并可关联简历、JD 分析与面试。 | 小规模用户验证字段与提醒需求，不扩展为复杂 CRM。 |
| 产品事件与漏斗 | 已实现 | `product_events` 只接受 11 个事件和各事件 metadata 白名单；匿名 fingerprint 仅保存 SHA-256；单批最多 20 条并按 actor 限流。管理员可查看 7/30 天严格时序 cohort 漏斗。 | 用真实流量核对漏报、重复事件、匿名/登录身份切换、数据保留和隐私披露。 |
| 密钥保护 | 已实现，待运维验收 | 敏感配置支持加密落库，并有密钥加密 smoke。 | 配置生产 `DATA_ENCRYPTION_KEY`、轮换旧密钥、备份密钥和失效处置；确认页面不回显明文。 |
| 登录与 OIDC | 已实现，待策略验收 | 登录失败限流持久化到数据库；OIDC 只接受已验证邮箱，并限制自动使用既有账号的条件。 | 锁定生产身份源、回调域名和账号关联策略，验证多实例限流与误锁恢复。 |
| 法律页 | 已实现，待法律验收 | 中英文隐私政策和服务条款页面已存在，登录及站点入口可引用。 | 填写真实运营主体、联系邮箱、适用地区规则，并由有权限的人员复核退款、数据处理和争议条款。 |
| 事务与幂等 | 已实现，待真实并发验收 | 商业事务 smoke 覆盖原子性、失败回滚、履约重试，以及重复 `providerTradeNo` 拒绝。 | 在真实 PostgreSQL 并发压测；为部分退款、争议、账本差异和权益补发建立人工复核队列与审计 SOP。 |
| 数据库与备份 | 待真实验收 | SQLite 迁移到 `0018`，PostgreSQL 迁移到 `0016`；提供 SQLite 一致性备份、PostgreSQL custom dump、SHA-256 和归档校验。 | 在真实 PostgreSQL 从空库和代表性数据执行迁移；完成隔离恢复演练、恢复后业务 smoke、RPO/RTO 和外部备份保留策略。 |
| Electron | 待发行验收 | 正式桌面包为云端模式，不携带 Next.js、SQLite 迁移或第二套业务数据库；本地数据库包有独立实验命令。 | 验收生产 HTTPS、登录/支付/下载、签名、公证、断网和自动更新。本地数据库包不作为商业版承诺。 |
| CI/CD | 待托管环境验收 | GitHub Actions 配置了 type-check、test、lint、13 个商业 smoke、PostgreSQL integration、production build，再构建 GHCR 镜像并触发 Jenkins。 | 必须让同一干净版本在托管 CI 和 preview 环境完整通过。配置存在不代表当前未提交改动已经通过。 |

## 产品事件口径

当前固定 11 个白名单事件：

| 漏斗 | 事件 |
| --- | --- |
| 简历 | `resume_imported`、`resume_created`、`jd_analyzed`、`tailored_resume_created`、`resume_exported` |
| 面试 | `mock_interview_started`、`mock_interview_completed` |
| 投递 | `application_created`、`application_result_recorded` |
| 商业 | `checkout_started`、`payment_succeeded` |

后台接口只接受 `days=7` 或 `days=30`。每一步都要求同一 actor 的首次事件时间不早于上一步，因此反向发生的历史事件不会被误计为正向转化。

## 商业 smoke 基线

`pnpm smoke:commercial` 当前聚合 13 个场景：

| 脚本 | 覆盖重点 |
| --- | --- |
| `smoke-ai-json-usage.ts` | JSON AI 重试的 token usage 聚合。 |
| `smoke-ai-metering-ledger.ts` | AI 预扣、结算、退款和余额不足。 |
| `smoke-interview-mock-quota.ts` | 模拟面试月额度与额外包消费。 |
| `smoke-share-download-entitlement.ts` | 分享下载按所有者权益判断。 |
| `smoke-job-template-download-entitlement.ts` | 职位模板购买、授权和下载。 |
| `smoke-interview-question-bank-commerce.ts` | 题库购买、访问、收藏、练习和错题。 |
| `smoke-points-exchange.ts` | 积分兑换、幂等、通知去重和余额不足。 |
| `smoke-referral-cycle.ts` | 邀请关系防成环。 |
| `smoke-low-credit-notification.ts` | 低 AI 点数通知去重和已读。 |
| `smoke-paid-order-fulfillment-retry.ts` | 已支付未履约订单的重试幂等。 |
| `smoke-commercial-transaction-atomicity.ts` | 商业事务回滚和重复 provider trade。 |
| `smoke-secret-encryption-at-rest.ts` | 敏感配置加密落库。 |
| `smoke-durable-login-rate-limit.ts` | 数据库持久化登录限流。 |

聚合脚本已经内置 `NODE_ENV=test`、SQLite 内存库、`AUTH_ENABLED=false`、`ALLOW_MOCK_PAYMENTS=true` 和测试专用加密密钥。若单独运行依赖模拟支付的脚本，尤其是订单履约、职位模板和面试题库脚本，仍必须显式设置 `ALLOW_MOCK_PAYMENTS=true`；不要把 mock 支付开关带入生产环境。

## 发布门禁

本地和托管 CI 应按同一顺序执行：

```bash
pnpm type-check
pnpm test
pnpm lint
pnpm smoke:commercial
pnpm smoke:postgres
pnpm build
```

`pnpm smoke:postgres` 仅在隔离 PostgreSQL 中运行，需要显式配置 `DB_TYPE=postgresql`、`DATABASE_URL` 和 `ALLOW_POSTGRES_INTEGRATION_TESTS=true`。测试凭据应由 CI secret 注入，不写入仓库。

门禁通过的判定对象必须是同一个干净版本。某个开发机曾经通过、工作流文件已经存在、GHCR/Jenkins 配置已经写好，都不能替代当前版本的托管 CI 结果和 preview 业务验收。

## 发布前阻塞项

| 优先级 | 阻塞项 | 完成证据 |
| --- | --- | --- |
| P0 | Stripe Test Mode 真实闭环 | Checkout、真实签名 webhook、重复回调、成功/失败、退款/争议和订单/支付/权益对账记录一致。 |
| P0 | 真实 PostgreSQL 与恢复 | 双库迁移对齐、PG integration 通过、备份校验通过、隔离恢复成功且恢复后商业 smoke 通过。 |
| P0 | 生产安全与身份 | 加密密钥和轮换可用，多实例登录限流生效，OIDC 账号关联符合策略，密钥不回显。 |
| P0 | 事务与人工复核 | 真实并发下账本/订单/权益原子，重复 provider trade 被拒绝；异常单有可审计的人工复核和补偿流程。 |
| P0 | 同版本 CI 与 preview | type-check、test、lint、13 smoke、PG integration、build、GHCR 和 Jenkins preview 全部基于同一版本通过。 |
| P0 | 法律与运营配置 | 真实运营主体、联系邮箱、价格、退款、隐私和数据保留规则已复核并与页面一致。 |
| P1 | Electron 正式发行 | 仅在本轮包含桌面发布时阻塞：云端地址、签名、公证、首启、断网、支付返回和更新全部验收。 |

## 未来 2–4 周

1. **发布基线**：冻结环境、迁移和 provider；在干净版本跑完整门禁并打通 preview。
2. **真实依赖验收**：只处理 Stripe、PostgreSQL、备份恢复、AI/存储、OIDC、密钥、法律和桌面发行边界。
3. **小规模用户**：让一小批可跟踪用户完成求职和商业黄金路径，结合错误日志与 7/30 天严格时序漏斗复盘。
4. **最大流失点优化**：只选择一个相邻步骤做最小实验；没有数据证明前不并行启动新平台工程。

## 明确延期

- Monorepo。
- React Native 或小程序。
- 自定义模板编辑器。
- 模板社区或创作者市场。
- 复杂 BI 和自助归因平台。
- 内置本地数据库的桌面商业版。

这些方向不是当前发布前提，也不作交付承诺。只有真实用户与漏斗数据证明它们比现有阻塞项更重要时，才重新评估。
