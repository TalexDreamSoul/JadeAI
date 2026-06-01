# JadeAI 商业化成长平台进展

> 目标：把 JadeAI 从「AI 简历工具」升级为「求职商业化成长平台」，用会员权益驱动 AI、模板、职位库、面试题库、下载、推广和支付闭环。

## 当前状态

### 已落地

| 模块 | 当前进展 |
| --- | --- |
| 商业化底座 | 已建立 membership、entitlement、wallet、billing、notification 基础域；核心数据进入 `user_memberships`、`user_entitlements`、`wallet_accounts`、`wallet_transactions`、`orders`、`payments`、`notifications`。 |
| 会员体系 | 已有 free / pro / premium / business 四档会员；权益覆盖 AI 月额度、模型等级、简历数量、PDF/DOCX 导出、模板下载、职位模板、题库等级、模拟面试次数、推广返利、积分兑换折扣。 |
| AI 消耗体系 | 主要 AI 路由已迁移到 `wallet_transactions` + `ai_usage_logs`；支持预扣、成功结算、失败退款、余额不足日志；`users.aiCredits` 仅作为兼容镜像同步。 |
| 商品与订单 | 统一 `products` 商品模型，覆盖 membership、ai_credit_pack、resume_template、job_template、interview_question_bank、interview_mock_pack；mock 支付已接入订单创建、支付确认、履约和通知。 |
| 模板付费下载 | 简历模板、职位模板走商品授权；购买、会员福利、兑换码、推广奖励最终写入 `user_entitlements`，下载接口按授权判断。 |
| 面试题库 | 题库作为独立内容资产，包含行业、岗位、级别、公司类型、能力维度、难度、题型、参考答案、Rubric、关键词、AI 追问策略；支持会员等级/购买解锁、收藏、错题、练习记录、套题报告。 |
| 积分与福利 | 已有 POINT / AI_CREDIT 账本、积分兑换、兑换码、积分任务、福利包、邀请裂变、推广返利、抽奖；所有奖励通过账本或权益记录发放。 |
| 个人中心 | 已补齐会员、AI 点数、积分流水、订单、已购内容、题库权限、消息通知、兑换码、推广中心、抽奖记录等入口。 |
| 运营后台 | 已补齐商品、订单、兑换码、增长/抽奖/推广、用户 AI 点数调整等基础运营能力。 |

### 已增加的关键回归烟测

| 脚本 | 覆盖内容 |
| --- | --- |
| `scripts/smoke-ai-metering-ledger.ts` | AI 预扣、成功结算、失败退款、余额不足日志。 |
| `scripts/smoke-ai-json-usage.ts` | JSON AI 重试场景的 token usage 聚合。 |
| `scripts/smoke-points-exchange.ts` | 积分兑换 AI 点数/模拟面试权益的幂等、通知去重、余额不足。 |
| `scripts/smoke-paid-order-fulfillment-retry.ts` | 已支付但未履约订单的重试履约幂等。 |
| `scripts/smoke-share-download-entitlement.ts` | 分享下载按简历所有者会员权益校验。 |
| `scripts/smoke-job-template-download-entitlement.ts` | 职位模板未购锁定、购买后授权、下载成功。 |
| `scripts/smoke-interview-question-bank-commerce.ts` | 题库未购锁定、购买后访问、收藏、练习、错题记录。 |
| `scripts/smoke-interview-mock-quota.ts` | 模拟面试月度额度与额外包分组消费。 |
| `scripts/smoke-low-credit-notification.ts` | 低 AI 点数通知去重和已读状态。 |
| `scripts/smoke-referral-cycle.ts` | 裂变推广邀请关系防成环。 |

## 关键设计决策

- 钱包只做账本入口，不直接改用户余额；`users.aiCredits` 仅保留兼容读写并由钱包余额同步。
- 商品购买、会员福利、兑换码、推广奖励统一落到 `user_entitlements` 或 `wallet_transactions`，下载/访问接口只判断授权。
- mock 支付先沉淀支付适配器接口，后续微信、支付宝、Stripe 只替换 provider adapter，不改订单履约主流程。
- 面试题库不塞进职位模板，单独建内容资产和练习资产，保证后续可以独立售卖、组卷、评分和增长运营。
- 流式 AI 接口使用 reservation 模式，成功 `completeAIUsage`，失败/中断/构造异常 `refundAIUsage`。

## 下一步计划

### P0：上线前收口

1. **生产级幂等与事务审计**
   - 对 `walletRepository.debit/credit`、订单履约、权益发放、兑换码领取、推广返利做事务边界复核。
   - 给订单履约、积分兑换、兑换码、抽奖增加稳定 request id / source id 约束说明。
2. **全量商业化 E2E 验证**
   - 把当前 smoke 串成一个商业化回归命令。
   - 覆盖用户从购买会员、购买模板/题库、AI 消耗、积分兑换、消息通知到个人中心查看的完整链路。
3. **真实支付适配准备**
   - 根据 `docs/research/wechat-pay.md` 补微信支付 provider 草案。
   - 明确支付回调验签、订单状态机、重复回调、退款/关闭订单策略。
4. **数据迁移与兼容清理**
   - 检查 SQLite/PostgreSQL 两套 schema 与 migration 是否一致。
   - 逐步把业务读写从 `users.aiCredits` 迁移到 wallet API，只保留兼容镜像。

### P1：增长与内容深化

1. **面试题库增强**
   - 支持按 JD 自动组卷、错题复习计划、AI 评分报告历史对比。
   - 后台补题库导入/批量编辑/上下架/价格策略。
2. **推广与裂变增强**
   - 推广中心增加邀请转化漏斗、返利明细、活动页和渠道码。
   - 抽奖补充奖池库存、中奖概率、风控限制。
3. **个人中心体验优化**
   - 订单详情、权益到期提醒、通知筛选、积分任务状态进一步细化。

### P2：架构迁移

1. **Monorepo 迁移**
   - 目标结构：`apps/web`、`apps/mobile`、`packages/db`、`packages/billing`、`packages/ai`、`packages/types`、`packages/auth`。
   - 迁移前先冻结商业化核心 API 合约和数据库 schema。
2. **RN 小程序**
   - 复用业务类型和 API，不强行复用 Web 组件。
   - 首期只做个人中心、订单/权益、题库练习、简历查看与轻编辑。

## 当前未完成事项

- 真实支付尚未接入，当前仍为 mock 支付。
- Monorepo/RN 小程序迁移尚未执行。
- 生产级事务、并发一致性和回滚补偿仍需专项审计。
- 商业化后台仍需要更完整的运营报表和批量内容管理。
- 当前存在大量商业化相关文件尚未纳入一次正式提交，提交前需要排除 `.serena/`、`.spec-workflow/` 等工具目录。

## 建议验证命令

```bash
pnpm type-check

SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-ai-metering-ledger.ts"
SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-ai-json-usage.ts"
SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-points-exchange.ts"
SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-paid-order-fulfillment-retry.ts"
SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-share-download-entitlement.ts"
AUTH_ENABLED=false SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-job-template-download-entitlement.ts"
AUTH_ENABLED=false SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-interview-question-bank-commerce.ts"
SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-interview-mock-quota.ts"
SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-low-credit-notification.ts"
SQLITE_PATH=":memory:" pnpm exec tsx "scripts/smoke-referral-cycle.ts"
```
