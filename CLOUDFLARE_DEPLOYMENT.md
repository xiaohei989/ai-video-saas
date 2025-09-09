# Cloudflare Pages 部署指南

本文档详细介绍如何将AI视频SaaS项目部署到Cloudflare Pages。

## 📋 部署前准备

### 1. 账户准备
- Cloudflare账户（免费即可）
- GitHub/GitLab仓库（代码托管）
- 域名（可选，可使用Cloudflare提供的域名）

### 2. 环境变量准备
准备以下必需的环境变量：

```bash
# Supabase配置（必需）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key

# Stripe配置（必需）
VITE_STRIPE_PUBLISHABLE_KEY_PROD=pk_live_...
VITE_STRIPE_ENVIRONMENT=production

# AI视频API配置（至少配置一个）
VITE_PRIMARY_VIDEO_API=qingyun
QINGYUN_API_KEY=your-qingyun-key
VITE_APICORE_API_KEY=your-apicore-key

# Google Analytics（可选）
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## 🚀 部署步骤

### 第一步：连接仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** 部分
3. 点击 **Create a project**
4. 选择 **Connect to Git**
5. 授权并选择你的仓库

### 第二步：配置构建设置

在项目设置中配置：

```yaml
# 构建配置
Build command: npm run build
Build output directory: build
Root directory: (留空)
Node.js version: 18.17.0
```

### 第三步：设置环境变量

在 **Settings → Environment Variables** 中添加：

**生产环境变量：**
```bash
NODE_ENV=production
VITE_APP_ENV=production
CF_PAGES=1
CLOUDFLARE_ENV=production

# 从.env.cloudflare复制其他必需变量
VITE_SUPABASE_URL=你的值
VITE_SUPABASE_ANON_KEY=你的值
# ... 其他变量
```

**预览环境变量：**
```bash
NODE_ENV=development
VITE_APP_ENV=preview
# 可以使用测试环境的API key
```

### 第四步：部署设置

1. **分支设置：**
   - Production branch: `main` 或 `master`
   - Preview deployments: 所有分支

2. **构建缓存：** 启用构建缓存以提高构建速度

3. **部署通知：** 设置GitHub/Slack通知

## 🔧 高级配置

### 自定义域名设置

1. 在 **Custom domains** 中添加域名
2. 更新DNS记录：
   ```
   Type: CNAME
   Name: @（或子域名）
   Value: your-project.pages.dev
   ```

### SSL/TLS配置

Cloudflare会自动为你的域名提供SSL证书，确保：
- SSL/TLS加密模式设为 **Full (strict)**
- 启用 **Always Use HTTPS**

### 缓存规则优化

在 **Rules → Page Rules** 中添加：

```bash
# 静态资源缓存
your-domain.com/assets/*
Cache Level: Cache Everything
Browser Cache TTL: 1 year

# API请求不缓存  
your-domain.com/api/*
Cache Level: Bypass
```

## 📊 性能优化

### 1. 启用压缩
在 **Speed → Optimization** 中启用：
- Auto Minify (HTML, CSS, JS)
- Brotli压缩

### 2. 图片优化
启用 **Polish** 进行图片压缩优化

### 3. 预加载设置
在 `_headers` 文件中已配置资源预加载

## 🔒 安全配置

### 1. 防火墙规则
在 **Security → WAF** 中设置：
- 启用托管规则集
- 配置速率限制

### 2. 访问控制
如需限制访问，使用 **Cloudflare Access**

## 📈 监控与分析

### 1. 启用分析
- **Analytics → Web Analytics** 查看访问数据
- **Speed → Core Web Vitals** 监控性能指标

### 2. 日志监控
- 使用 **Logpush** 导出访问日志
- 设置 **Alerts** 监控错误率

## 🐛 故障排除

### 常见问题

1. **构建失败：**
   ```bash
   # 检查Node.js版本
   # 检查环境变量是否完整
   # 查看构建日志
   ```

2. **页面空白：**
   - 检查 `_redirects` 文件配置
   - 确认SPA路由重定向正确

3. **API请求失败：**
   - 检查CORS配置
   - 验证环境变量

4. **静态资源加载失败：**
   - 检查 `_headers` 文件
   - 确认资源路径正确

### 日志查看

在 **Functions → Logs** 中查看实时日志：
```bash
wrangler pages deployment tail
```

## 🔄 CI/CD 集成

### GitHub Actions示例

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ai-video-saas
          directory: build
```

## 📱 移动端优化

### PWA配置
项目已包含PWA配置，Cloudflare会自动：
- 缓存Service Worker
- 启用离线功能

### 移动端性能
- 启用 **Accelerated Mobile Pages (AMP)**
- 使用 **Mirage** 优化移动端图片加载

## 💰 成本优化

### 免费额度使用
- 25,000次构建/月
- 无限带宽
- 500个项目

### 监控使用量
在 **Billing** 中监控：
- 请求数量
- 带宽使用
- 构建时间

## 🔄 更新部署

### 自动部署
推送到主分支会自动触发部署

### 手动部署
```bash
# 本地构建并上传
npm run build
npm run cf:deploy
```

### 回滚部署
在 **Deployments** 中可以一键回滚到之前版本

---

## 📞 支持与帮助

如遇到问题：
1. 查看 [Cloudflare Pages文档](https://developers.cloudflare.com/pages/)
2. 检查项目 [GitHub Issues](https://github.com/your-repo/issues)
3. 联系技术支持

---

**部署完成后，你的AI视频SaaS将拥有：**
- 🌍 全球CDN加速
- 🔒 企业级安全防护  
- 📊 详细性能分析
- 💰 优秀的性价比
- ⚡ 超快的加载速度