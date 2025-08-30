# 商业化功能设置指南

本文档描述如何设置和配置AI视频SaaS平台的商业化功能，包括积分系统、Stripe支付集成和邀请奖励机制。

## 📋 目录

- [积分系统](#积分系统)
- [Stripe支付集成](#stripe支付集成)
- [邀请奖励系统](#邀请奖励系统)
- [数据库迁移](#数据库迁移)
- [环境变量配置](#环境变量配置)
- [测试指南](#测试指南)

## 🪙 积分系统

### 功能概述
- 用户积分余额管理
- 积分消费追踪
- 积分交易历史记录
- 积分统计和分析

### 核心组件
- `creditService.ts` - 积分管理服务
- `CreditBalance.tsx` - 积分余额显示组件
- `CreditTransactions.tsx` - 积分交易历史组件

### 数据库函数
- `consume_user_credits()` - 消费积分（原子操作）
- `add_user_credits()` - 添加积分（原子操作）
- `get_user_credit_summary()` - 获取积分统计

## 💳 Stripe支付集成

### 设置步骤

1. **创建Stripe账户**
   - 访问 [Stripe Dashboard](https://dashboard.stripe.com/)
   - 创建账户并完成验证

2. **配置产品和价格**
   ```bash
   # 在Stripe Dashboard中创建以下产品：
   # 基础版：$9.99/月，500积分
   # 专业版：$19.99/月，1200积分  
   # 企业版：$99.99/月，10000积分
   ```

3. **设置Webhook**
   ```bash
   # Webhook URL: https://your-domain.com/functions/v1/stripe-webhook
   # 监听事件：
   # - checkout.session.completed
   # - payment_intent.succeeded
   # - customer.subscription.*
   # - invoice.payment_succeeded
   # - invoice.payment_failed
   ```

4. **部署Supabase Edge Functions**
   ```bash
   # 部署结账会话函数
   supabase functions deploy create-checkout-session

   # 部署Stripe webhook处理函数
   supabase functions deploy stripe-webhook
   ```

### 核心组件
- `stripeService.ts` - Stripe集成服务
- `PricingPlans.tsx` - 订阅计划展示
- `CreditsPurchase.tsx` - 积分购买组件

## 🎁 邀请奖励系统

### 功能特性
- 生成专属邀请码
- 邀请链接分享
- 社交媒体分享集成
- 邀请统计和排行榜
- 自动奖励发放

### 奖励规则
- 邀请者：成功邀请获得50积分
- 被邀请者：注册成功获得25积分
- 邀请码有效期：30天

### 核心组件
- `referralService.ts` - 邀请系统服务
- `ReferralDashboard.tsx` - 邀请管理面板

### 数据库函数
- `accept_invitation()` - 接受邀请（原子操作）
- `get_referral_stats()` - 获取邀请统计
- `get_referral_leaderboard()` - 邀请排行榜

## 🗄️ 数据库迁移

按顺序运行以下迁移文件：

```bash
# 1. 应用积分系统迁移
supabase db push --file supabase/migrations/005_credit_system.sql

# 2. 应用邀请系统迁移  
supabase db push --file supabase/migrations/006_referral_system.sql
```

### 关键表结构
- `profiles` - 用户资料（包含积分余额）
- `subscriptions` - 订阅信息
- `credit_transactions` - 积分交易记录
- `invitations` - 邀请记录
- `payments` - 支付记录

## ⚙️ 环境变量配置

复制并配置环境变量：

```bash
cp .env.example .env
```

必需的环境变量：

```bash
# Stripe配置
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...

# Supabase配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 🧪 测试指南

### 本地开发测试

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **测试积分系统**
   - 注册新账户（自动获得100积分）
   - 尝试生成视频（消费积分）
   - 查看积分交易历史

3. **测试Stripe集成**
   - 使用Stripe测试卡号：`4242 4242 4242 4242`
   - 测试订阅流程
   - 测试积分购买流程

4. **测试邀请系统**
   - 生成邀请码
   - 使用邀请码注册新账户
   - 验证积分奖励发放

### 测试卡号

```bash
# 成功支付
4242 4242 4242 4242

# 支付失败
4000 0000 0000 0002

# 需要3D验证
4000 0025 0000 3155
```

### Webhook测试

使用Stripe CLI进行本地webhook测试：

```bash
# 安装Stripe CLI
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# 触发测试事件
stripe trigger checkout.session.completed
```

## 📊 监控和分析

### 关键指标
- 用户转换率（免费 -> 付费）
- 平均每用户收入（ARPU）
- 客户生命周期价值（CLV）
- 邀请转换率
- 积分消费模式

### 推荐工具
- Stripe Dashboard - 支付分析
- Supabase Dashboard - 用户和使用分析
- Google Analytics - 用户行为分析

## 🚀 生产部署

### 部署清单

- [ ] 配置生产环境变量
- [ ] 设置Stripe生产环境
- [ ] 配置Webhook端点
- [ ] 运行数据库迁移
- [ ] 部署Edge Functions
- [ ] 配置域名和SSL
- [ ] 测试支付流程
- [ ] 设置监控告警

### 安全注意事项

1. **环境变量安全**
   - 不要在客户端暴露敏感密钥
   - 使用环境变量而非硬编码

2. **Stripe Webhook安全**
   - 验证webhook签名
   - 使用HTTPS端点
   - 实现重复请求处理

3. **数据库安全**
   - 启用RLS策略
   - 最小权限原则
   - 定期备份

## 🔧 故障排除

### 常见问题

1. **Webhook未收到**
   - 检查Stripe Dashboard中的webhook状态
   - 确认端点URL正确
   - 查看服务器日志

2. **积分未正确添加**
   - 检查数据库函数是否正确部署
   - 验证RPC调用参数
   - 查看错误日志

3. **邀请码无效**
   - 检查邀请码是否过期
   - 验证数据库中的记录
   - 确认函数权限设置

### 调试工具

```bash
# 查看Supabase函数日志
supabase functions logs

# 测试数据库连接
supabase db test

# 验证环境变量
echo $VITE_STRIPE_PUBLISHABLE_KEY
```

## 📝 支持和文档

- [Stripe文档](https://stripe.com/docs)
- [Supabase文档](https://supabase.com/docs)
- [项目GitHub仓库](https://github.com/your-repo)

---

如有问题，请查看日志或联系开发团队。