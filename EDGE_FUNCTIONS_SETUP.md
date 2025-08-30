# Supabase Edge Functions 部署指南

本文档详细说明如何部署和配置Supabase Edge Functions以支持Stripe支付集成。

## 📋 准备工作

### 1. 安装Supabase CLI

```bash
# 使用npm安装
npm install -g supabase

# 或使用brew（macOS）
brew install supabase/tap/supabase
```

### 2. 登录和链接项目

```bash
# 登录Supabase
supabase login

# 链接到您的项目
supabase link --project-ref YOUR_PROJECT_ID
```

## 🔧 环境变量配置

在部署函数之前，需要在Supabase控制台设置以下环境变量：

### 访问项目设置

1. 登录 [Supabase控制台](https://app.supabase.com)
2. 选择您的项目
3. 进入 **Settings** > **Edge Functions**
4. 添加以下环境变量：

### 必需的环境变量

```bash
# Stripe配置
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_your_webhook_signing_secret

# Supabase配置（通常自动提供）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 其他可选配置
NODE_ENV=production
```

### 获取Stripe密钥

1. **获取Secret Key**：
   - 登录 [Stripe Dashboard](https://dashboard.stripe.com/)
   - 进入 **Developers** > **API Keys**
   - 复制 **Secret Key**（sk_test_... 或 sk_live_...）

2. **获取Webhook Signing Secret**：
   - 在Stripe Dashboard进入 **Developers** > **Webhooks**
   - 创建新的endpoint或编辑现有的
   - 复制 **Signing Secret**（whsec_...）

## 🚀 部署函数

### 方法1：使用部署脚本（推荐）

```bash
# 给脚本执行权限
chmod +x deploy-functions.sh

# 运行部署脚本
./deploy-functions.sh
```

### 方法2：手动部署

```bash
# 部署create-checkout-session函数
supabase functions deploy create-checkout-session --no-verify-jwt

# 部署stripe-webhook函数
supabase functions deploy stripe-webhook --no-verify-jwt

# 部署update-video-status函数
supabase functions deploy update-video-status --no-verify-jwt
```

### 验证部署

```bash
# 查看已部署的函数
supabase functions list

# 查看函数详细信息
supabase functions inspect FUNCTION_NAME
```

## 🔗 配置Stripe Webhook

### 1. 创建Webhook端点

在Stripe Dashboard中：

1. 进入 **Developers** > **Webhooks**
2. 点击 **Add endpoint**
3. 输入端点URL：
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
   ```

### 2. 选择监听事件

选择以下事件类型：

```
✅ checkout.session.completed
✅ payment_intent.succeeded  
✅ customer.subscription.created
✅ customer.subscription.updated
✅ customer.subscription.deleted
✅ invoice.payment_succeeded
✅ invoice.payment_failed
```

### 3. 配置Webhook密钥

1. 复制Webhook的 **Signing Secret**
2. 在Supabase控制台添加环境变量：
   ```
   STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
   ```

## 🧪 测试部署

### 1. 测试create-checkout-session函数

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_test_123",
    "userId": "test-user-id", 
    "planId": "basic",
    "successUrl": "https://yoursite.com/success",
    "cancelUrl": "https://yoursite.com/cancel"
  }'
```

### 2. 测试stripe-webhook函数

使用Stripe CLI测试webhook：

```bash
# 安装Stripe CLI
# 详见：https://stripe.com/docs/stripe-cli

# 转发webhook到本地测试
stripe listen --forward-to https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook

# 触发测试事件
stripe trigger checkout.session.completed
```

### 3. 查看函数日志

```bash
# 查看函数日志
supabase functions logs FUNCTION_NAME

# 实时查看日志
supabase functions logs FUNCTION_NAME --follow
```

## 📊 监控和调试

### 函数URL格式

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/FUNCTION_NAME
```

### 常用调试命令

```bash
# 查看函数状态
supabase functions list

# 查看函数日志
supabase functions logs stripe-webhook --limit 100

# 重新部署函数
supabase functions deploy FUNCTION_NAME --no-verify-jwt
```

### 错误排查

#### 1. 认证错误
- 检查`Authorization`头是否正确
- 确认用户已登录

#### 2. Stripe错误
- 验证Stripe密钥是否正确
- 检查webhook签名验证

#### 3. 数据库错误  
- 确认RLS策略配置正确
- 检查数据库连接

## 🔄 更新函数

当您修改函数代码后：

```bash
# 重新部署单个函数
supabase functions deploy FUNCTION_NAME --no-verify-jwt

# 或使用部署脚本重新部署所有函数
./deploy-functions.sh
```

## 🛡️ 安全最佳实践

### 1. 环境变量安全
- 使用不同的密钥用于测试和生产环境
- 定期轮换API密钥
- 不要在代码中硬编码密钥

### 2. Webhook安全
- 始终验证webhook签名
- 使用HTTPS端点
- 实现重复请求保护

### 3. 函数安全
- 验证用户身份
- 使用适当的RLS策略
- 记录和监控函数调用

## 📝 部署检查清单

- [ ] 安装Supabase CLI
- [ ] 登录并链接项目
- [ ] 配置环境变量
- [ ] 部署Edge Functions
- [ ] 配置Stripe Webhook
- [ ] 测试支付流程
- [ ] 验证webhook接收
- [ ] 设置监控和日志

## 🆘 故障排除

### 常见问题

1. **函数部署失败**
   - 检查TypeScript语法
   - 确认依赖导入正确
   - 查看部署错误日志

2. **Webhook未接收**
   - 验证URL是否正确
   - 检查Stripe事件配置
   - 确认签名密钥正确

3. **支付流程失败**
   - 查看函数日志
   - 检查Stripe Dashboard中的事件
   - 验证数据库状态

### 获取帮助

- [Supabase Edge Functions文档](https://supabase.com/docs/guides/functions)
- [Stripe Webhooks文档](https://stripe.com/docs/webhooks)
- 项目GitHub仓库Issues

---

部署完成后，您的Edge Functions将处理所有Stripe支付相关的服务端逻辑！🎉