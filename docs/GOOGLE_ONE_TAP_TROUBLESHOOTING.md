# Google One Tap 故障排查指南

## 问题: 生产环境One Tap不显示或登录失败

### 观察到的错误信息

```
[ERROR] Error retrieving a token.
[INFO] Auto re-authn was previously triggered less than 10 minutes ago.
```

## 根本原因分析

### 1. **最可能的原因: Google Cloud Console配置缺失**

Google One Tap需要在Google Cloud Console中正确配置**授权的JavaScript来源**。

#### 检查清单:

1. **访问 Google Cloud Console**
   - https://console.cloud.google.com
   - 选择你的项目

2. **进入凭据配置**
   - `APIs & Services` > `Credentials`
   - 找到OAuth 2.0 Client ID: `557410813830-4c8jak5ip45subanok95bhoe0n2iilvl.apps.googleusercontent.com`

3. **检查"授权的JavaScript来源"(Authorized JavaScript origins)**

   **必须包含以下域名:**
   ```
   https://veo3video.me
   https://www.veo3video.me
   ```

   **注意:**
   - 必须是 `https://` 不是 `http://`
   - 不要在末尾加 `/`
   - 区分 `veo3video.me` 和 `www.veo3video.me`

4. **检查"授权的重定向URI"(Authorized redirect URIs)**

   虽然One Tap不需要重定向,但为了兼容现有的Google OAuth登录,也应该配置:
   ```
   https://veo3video.me/zh/auth/callback
   https://veo3video.me/en/auth/callback
   https://veo3video.me/ja/auth/callback
   https://veo3video.me/ko/auth/callback
   https://veo3video.me/es/auth/callback
   https://veo3video.me/de/auth/callback
   https://veo3video.me/fr/auth/callback
   https://veo3video.me/ar/auth/callback
   https://veo3video.me/auth/callback
   ```

### 2. **Supabase配置检查**

确保Supabase的Google OAuth provider使用相同的Client ID。

1. **登录Supabase Dashboard**
   - https://app.supabase.com
   - 选择项目 `hvkzwrnvxsleeonqqrzq`

2. **检查Google Provider配置**
   - `Authentication` > `Providers` > `Google`
   - Client ID应该是: `557410813830-4c8jak5ip45subanok95bhoe0n2iilvl.apps.googleusercontent.com`
   - Client Secret需要与Google Cloud Console匹配

3. **检查Redirect URL**
   - 确认Supabase的回调URL已在Google Cloud Console配置

### 3. **One Tap显示限制**

Google One Tap有以下限制,可能导致不显示:

#### 频率限制
- 用户关闭One Tap后,会在一段时间内(通常2周)不再显示
- 同一浏览器10分钟内只触发一次
- **解决方法**: 清除浏览器Cookie或使用隐私模式测试

#### 用户必须满足的条件
- 浏览器中已登录Google账户
- 之前没有主动关闭/拒绝One Tap提示
- 域名已在Google Cloud Console授权
- 使用HTTPS(生产环境必须)

#### 浏览器支持
- Chrome: ✅ 完全支持
- Edge: ✅ 完全支持
- Firefox: ⚠️ 部分支持
- Safari: ⚠️ 部分支持

### 4. **调试步骤**

#### Step 1: 验证Google Cloud Console配置

```bash
# 检查当前配置的域名
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://www.googleapis.com/oauth2/v1/tokeninfo?client_id=557410813830-4c8jak5ip45subanok95bhoe0n2iilvl.apps.googleusercontent.com"
```

#### Step 2: 清除浏览器状态测试

1. 打开Chrome隐私模式
2. 访问 https://accounts.google.com 登录Google账户
3. 访问 https://veo3video.me
4. 等待2-3秒,应该看到One Tap提示

#### Step 3: 检查控制台日志

打开浏览器开发者工具 (F12),在Console标签查看:

**成功的日志:**
```
[Google One Tap] 开始初始化...
[Google One Tap] 初始化成功
[Google One Tap] 显示提示...
[Google One Tap] 提示已显示
```

**失败的日志:**
```
[Google One Tap] 未显示原因: opt_out_or_no_session
// 用户没有Google会话

[Google One Tap] 未显示原因: unregistered_origin
// 域名未在Google Cloud Console授权 ⚠️ 最常见

[Google One Tap] 未显示原因: suppressed_by_user
// 用户之前关闭过提示
```

#### Step 4: 使用Google的调试工具

访问 Google Identity Services 配置检查器:
```
https://developers.google.com/identity/gsi/web/tools/configurator
```

输入你的Client ID检查配置。

### 5. **紧急修复方案**

如果One Tap始终无法工作,可以暂时禁用,使用传统的Google OAuth按钮:

**方案A: 临时禁用One Tap**
```tsx
// 在 HomePage.tsx 中注释掉
// <GoogleOneTap delay={2000} context="signin" />
```

**方案B: 仅在特定条件下启用**
```tsx
// 只在已知工作的环境启用
{process.env.NODE_ENV === 'production' && window.location.hostname === 'veo3video.me' && (
  <GoogleOneTap delay={2000} context="signin" />
)}
```

## 最终检查清单

配置完成后,按以下步骤验证:

- [ ] Google Cloud Console中已添加 `https://veo3video.me` 到授权来源
- [ ] Google Cloud Console中已添加 `https://www.veo3video.me` 到授权来源
- [ ] Supabase的Google Provider使用相同的Client ID
- [ ] 环境变量 `VITE_GOOGLE_CLIENT_ID` 正确配置
- [ ] 生产环境使用HTTPS
- [ ] 使用隐私模式+已登录Google账户测试
- [ ] 检查浏览器控制台无 `unregistered_origin` 错误

## 预期行为

配置正确后,用户访问首页时:

1. 页面加载后2秒
2. 如果用户浏览器已登录Google
3. 在页面右上角会显示一个弹窗
4. 显示用户的Google账户信息
5. 用户点击一次即可登录

**重要提示**: 如果用户浏览器中没有登录Google账户,One Tap不会显示,这是正常的!用户仍然可以使用"Sign in with Google"按钮。

## 联系支持

如果以上步骤都无法解决问题:

1. 检查 Google Cloud Console 的配额和限制
2. 查看 Google OAuth 服务状态: https://status.cloud.google.com
3. 参考 Google 官方文档: https://developers.google.com/identity/gsi/web/guides/overview
