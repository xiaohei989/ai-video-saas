# 🚀 AI视频SaaS生产环境部署指南

## 📋 预检查清单

### 1. 环境变量配置
- [ ] 复制 `.env.production` 模板文件
- [ ] 配置所有必需的生产环境变量
- [ ] 验证所有API密钥的有效性
- [ ] 确保 `.env.production` 已添加到 `.gitignore`

### 2. 数据库准备
- [ ] Supabase项目已创建
- [ ] 数据库架构已部署
- [ ] RLS策略已配置
- [ ] Edge Functions已部署

### 3. 支付系统配置
- [ ] Stripe生产环境已配置
- [ ] Webhook端点已设置
- [ ] 产品和价格已创建

## 🛠️ 部署步骤

### 1. 环境变量设置

首先复制生产环境配置模板：
```bash
cp .env.production .env.production.local
```

**重要：编辑 `.env.production.local` 并填入真实的生产环境配置**

#### 必需配置项：

**Supabase配置**
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Stripe生产环境**
```bash
VITE_STRIPE_MODE=production
STRIPE_MODE=production
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_your_webhook_signing_secret
```

**安全密钥**
```bash
# 生成32字符加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
VITE_COOKIE_ENCRYPTION_KEY=生成的32字符密钥
VITE_COOKIE_SIGNATURE_SECRET=生成的32字符密钥
```

**API服务**
```bash
QINGYUN_API_KEY=your_qingyun_api_key
VITE_APICORE_API_KEY=your_apicore_api_key
VITE_IMGBB_API_KEY=your_imgbb_api_key
```

**应用配置**
```bash
APP_URL=https://your-production-domain.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 2. 构建项目

```bash
# 安装依赖
npm install

# 类型检查
npm run type-check

# 构建生产版本
npm run build
```

### 3. 部署到不同平台

#### Vercel部署
```bash
# 安装Vercel CLI
npm install -g vercel

# 部署
vercel --prod

# 在Vercel Dashboard设置环境变量
# Dashboard → Settings → Environment Variables
```

#### Netlify部署
```bash
# 安装Netlify CLI
npm install -g netlify-cli

# 部署
netlify deploy --prod --dir=build

# 在Netlify Dashboard设置环境变量
# Site Settings → Environment Variables
```

#### Cloudflare Pages部署
```bash
# 连接到Cloudflare Pages
# 在Cloudflare Dashboard配置环境变量
# Pages → Settings → Environment Variables
```

### 4. 数据库迁移（Supabase）

```bash
# 登录Supabase
npx supabase login

# 链接项目
npx supabase link --project-ref your-project-ref

# 部署数据库更改
npx supabase db push

# 部署Edge Functions
npx supabase functions deploy
```

### 5. Stripe配置

1. **创建生产环境产品**：
   - 登录 [Stripe Dashboard](https://dashboard.stripe.com)
   - 切换到生产环境
   - 创建产品和价格
   - 更新 `.env.production.local` 中的价格ID

2. **配置Webhook**：
   - 添加端点：`https://your-domain.com/api/stripe-webhook`
   - 选择事件：`customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - 复制签名密钥到 `STRIPE_WEBHOOK_SIGNING_SECRET`

### 6. 监控和分析

**Google Analytics**：
1. 创建GA4属性
2. 获取Measurement ID
3. 设置 `VITE_GA_MEASUREMENT_ID`

**错误监控**（推荐）：
- Sentry
- LogRocket
- 或其他错误追踪服务

## 🔐 安全检查

### 1. 环境变量安全
- [ ] 所有敏感信息已从代码中移除
- [ ] `.env.production` 已添加到 `.gitignore`
- [ ] 生产环境变量仅在部署平台设置

### 2. API安全
- [ ] API密钥已轮换为生产环境密钥
- [ ] 速率限制已启用
- [ ] CORS策略已正确配置

### 3. 数据库安全
- [ ] RLS策略已启用
- [ ] 数据库访问已限制
- [ ] 定期备份已配置

## 📊 性能优化

### 1. 构建优化
```bash
# 分析构建包大小
npm run build && npx vite-bundle-analyzer
```

### 2. CDN配置
- 启用静态资源CDN
- 配置缓存策略
- 压缩图片和视频

### 3. 监控设置
- 设置性能监控
- 配置告警阈值
- 监控API响应时间

## 🚨 故障排除

### 常见问题

**1. 环境变量未生效**
```bash
# 检查变量是否正确设置
echo $VITE_SUPABASE_URL
```

**2. Stripe Webhook失败**
- 检查端点URL是否正确
- 验证签名密钥
- 查看Webhook日志

**3. 视频生成失败**
- 检查API密钥有效性
- 验证API配额
- 查看错误日志

**4. 数据库连接失败**
- 验证Supabase配置
- 检查RLS策略
- 确认项目ref正确

## 📞 部署后验证

### 功能测试清单
- [ ] 用户注册/登录
- [ ] 视频生成流程
- [ ] 支付订阅流程
- [ ] 视频下载功能
- [ ] 分享功能
- [ ] 管理后台

### 性能测试
- [ ] 页面加载速度 < 3秒
- [ ] API响应时间 < 1秒
- [ ] 视频播放流畅
- [ ] 移动端兼容性

## 📈 部署后维护

### 日常维护
- 监控错误日志
- 检查API使用情况
- 更新依赖包
- 备份数据库

### 定期任务
- 轮换API密钥
- 更新SSL证书
- 性能优化
- 安全审计

---

## 🆘 紧急联系

如遇到部署问题：
1. 检查部署平台日志
2. 查看浏览器控制台错误
3. 验证环境变量配置
4. 联系相关服务商支持

---

**最后更新：2024年9月**