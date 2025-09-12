# Supabase Apple OAuth 配置指南

## 🚨 当前问题
测试显示Supabase Dashboard中Apple OAuth提供商虽然已启用，但配置不完整，导致：
- 无法生成正确的Apple授权URL
- 缺少Client ID和Client Secret配置
- Response mode不是form_post

## ✅ 正确配置步骤

### 1. 登录Supabase Dashboard
访问: https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/auth/providers

### 2. 配置Apple OAuth提供商

**基本设置：**
- **启用Apple Provider：** ✅ 打开开关
- **Client ID：** `com.veo3video.webapp.web`
- **Client Secret：** `eyJhbGciOiJFUzI1NiIsImtpZCI6IkFNMlQ2VjVCSzIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJZNTQ0QUxTVkFTIiwiaWF0IjoxNzU3NTg0NDQ5LCJleHAiOjE3NzMxMzY0NDksImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJjb20udmVvM3ZpZGVvLndlYmFwcC53ZWIifQ.MEQCIDAWRyMha3iPC0IuFxlhrKG5F7Hh63WxV9jco5AQxOIEAiAYzTmgukGXAb-T0fdgKuUrYtkkVW4xewrS_7DYD7qyIA`

**重定向URL：**
- **Redirect URLs：** `https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback`

### 3. 验证Apple Developer Console配置

**在 https://developer.apple.com/account/resources/identifiers/list/serviceId 中确认：**

- **Service ID：** `com.veo3video.webapp.web`
- **Primary App ID：** 选择对应的App ID
- **Sign In with Apple：** ✅ 启用
- **Domains and Subdomains：** 
  - `hvkzwrnvxsleeonqqrzq.supabase.co`
  - `localhost` （开发环境）
- **Return URLs：**
  - `https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback`
  - `http://localhost:3000/auth/callback` （开发环境）

### 4. 配置保存后的验证

保存配置后，重新运行测试：
```bash
node debug-oauth-url.js
```

**期望结果：**
- URL应指向 `appleid.apple.com`
- client_id应显示为 `com.veo3video.webapp.web`
- redirect_uri应显示Supabase回调URL
- response_mode应为 `form_post`

## 🔧 故障排除

### 如果配置后仍有问题：

1. **清除浏览器缓存**
2. **等待1-2分钟**（配置同步需要时间）
3. **检查Apple Client Secret有效期**（当前到2026年3月）
4. **验证所有URL完全匹配**（包括协议http/https）

### 常见错误：
- `invalid_client` - Client ID或Client Secret错误
- `redirect_uri_mismatch` - 重定向URL不匹配
- `invalid_scope` - 权限范围问题

## 📋 配置完成检查清单

- [ ] Supabase Dashboard中Apple提供商已启用
- [ ] Client ID和Client Secret已正确填入
- [ ] 重定向URL已配置
- [ ] Apple Developer Console中Service ID已启用
- [ ] Apple Developer Console中重定向URL已配置  
- [ ] 测试脚本显示正确的Apple授权URL
- [ ] 实际OAuth流程能成功完成

配置完成后，Apple OAuth应该可以正常工作。