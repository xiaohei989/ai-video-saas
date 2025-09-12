# OAuth域名快速设置指南

## 🎯 目标
将OAuth登录域名从 `hvkzwrnvxsleeonqqrzq.supabase.co` 改为 `api.veo3video.me`

## ⚡ 快速实施步骤

### 第一步：配置DNS (5分钟)

在您的域名DNS管理界面（如Cloudflare）添加CNAME记录：

```
类型: CNAME
名称: api
值: hvkzwrnvxsleeonqqrzq.supabase.co  
TTL: 300
```

### 第二步：自动更新项目配置 (1分钟)

```bash
# 运行自动配置脚本
npm run oauth:update-domain

# 这将自动：
# - 更新所有环境变量文件
# - 生成DNS配置说明
# - 生成OAuth提供商更新清单
# - 创建配置文件备份
```

### 第三步：配置Supabase自定义域名 (3分钟)

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/settings/general)
2. 点击 Settings → General → Custom domains
3. 点击 "Add custom domain"
4. 输入：`api.veo3video.me`
5. 点击 "Add domain"
6. 等待SSL证书自动配置（通常1-2分钟）

### 第四步：更新OAuth提供商 (5分钟)

#### Google OAuth Console:
1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 找到您的OAuth 2.0客户端ID并点击编辑
3. 在"已获授权的重定向URI"中：
   - **添加**: `https://api.veo3video.me/auth/v1/callback`
   - **删除**: `https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback`
4. 保存

#### Apple Developer Console:
1. 访问 [Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. 选择Service ID: `com.veo3video.webapp.web`
3. 编辑"Sign In with Apple"配置
4. 在Return URLs中：
   - **添加**: `https://api.veo3video.me/auth/v1/callback`
   - **删除**: `https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback`
5. 保存

### 第五步：测试验证 (2分钟)

```bash
# 测试自定义域名配置
npm run oauth:test-domain

# 如果测试通过，重启开发服务器
npm run dev
```

### 第六步：部署到生产环境

```bash
# Cloudflare Pages部署
npm run cf:deploy

# 或手动在Cloudflare Pages Dashboard更新环境变量：
# VITE_SUPABASE_URL = https://api.veo3video.me
```

## 🔍 验证成功

配置成功后，您应该看到：
- OAuth登录页面显示"登录到 api.veo3video.me"
- 而不是"登录到 hvkzwrnvxsleeonqqrzq.supabase.co"

## ❌ 如果出现问题

### 回滚方案：
```bash
# 如果配置有问题，可以快速回滚
cp .env.backup .env
cp .env.cloudflare.backup .env.cloudflare
npm run dev
```

### 常见问题：
1. **DNS未传播**：等待24小时后重试
2. **SSL证书未就绪**：在Supabase Dashboard检查证书状态
3. **OAuth重定向错误**：确保所有提供商都更新了重定向URI

## 📋 检查清单

- [ ] DNS CNAME记录已添加
- [ ] 运行了 `npm run oauth:update-domain`
- [ ] Supabase自定义域名已配置
- [ ] Google OAuth重定向URI已更新  
- [ ] Apple OAuth Return URL已更新
- [ ] 运行了 `npm run oauth:test-domain` 并通过
- [ ] 测试OAuth登录成功

## 🎉 完成！

完成后，您的用户在OAuth登录时将看到专业的品牌域名，提升用户信任度和品牌形象。

---
**预计总时间：15分钟**  
**难度：简单** ⭐⭐☆☆☆