# Google One Tap 登录配置指南

## 概述

Google One Tap 是一种智能登录功能,可以自动检测用户是否已在浏览器中登录Google账户,并提示用户一键登录到您的应用,无需跳转或重新输入凭据。

## 功能特点

- ✅ **自动检测**: 自动识别浏览器中已登录的Google账户
- ✅ **一键登录**: 无需跳转,用户点击一次即可完成登录
- ✅ **提升转化**: 据统计可提升注册/登录转化率40-90%
- ✅ **无缝集成**: 与现有Google OAuth按钮共存,不影响其他登录方式
- ✅ **多语言**: 支持项目中所有语言(中文、英文、日文等)

## 配置步骤

### 1. 获取Google OAuth Client ID

如果您已经配置了Google OAuth登录(Supabase),可以使用相同的Client ID。

#### 方式1: 从Supabase获取(推荐)

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择您的项目
3. 进入 `Authentication` > `Providers`
4. 找到 `Google` 提供商
5. 复制 `Client ID`

#### 方式2: 从Google Cloud Console获取

1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 选择或创建项目
3. 进入 `APIs & Services` > `Credentials`
4. 找到您的OAuth 2.0 Client ID
5. 复制 Client ID

### 2. 配置环境变量

在 `.env` 或 `.env.local` 文件中添加:

```bash
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

**注意**:
- Client ID应该以 `.apps.googleusercontent.com` 结尾
- 确保在生产环境的 `.env.production` 中也配置此变量

### 3. 配置授权来源

在Google Cloud Console中配置授权的JavaScript来源:

1. 进入 `APIs & Services` > `Credentials`
2. 点击您的OAuth 2.0 Client ID
3. 在 `Authorized JavaScript origins` 添加:
   - 开发环境: `http://localhost:5173`
   - 生产环境: `https://veo3video.me`
   - 生产环境: `https://www.veo3video.me`

4. 在 `Authorized redirect URIs` 添加(如果还没有):
   - 开发: `http://localhost:5173/zh/auth/callback`
   - 开发: `http://localhost:5173/en/auth/callback`
   - 生产: `https://veo3video.me/zh/auth/callback`
   - 生产: `https://veo3video.me/en/auth/callback`
   - ...为每种支持的语言添加回调URL

### 4. 验证配置

启动开发服务器后:

```bash
npm run dev
```

访问首页,打开浏览器控制台,查找以下日志:

```
[Google One Tap] 开始初始化...
[Google One Tap] 初始化成功
[Google One Tap] 显示提示...
```

如果看到这些日志,说明配置成功。

## 工作原理

### 组件结构

```
GoogleOneTap (组件)
  └── useGoogleOneTap (Hook)
       └── Google Identity Services SDK
```

### 执行流程

1. **页面加载**: `GoogleOneTap`组件在HomePage加载时初始化
2. **SDK检查**: 等待Google Identity Services SDK加载完成
3. **状态检测**: 检查用户是否已登录应用
4. **提示显示**: 如果用户未登录但浏览器中有Google会话,显示One Tap提示
5. **凭证处理**: 用户点击后,接收JWT token
6. **Supabase登录**: 使用`signInWithIdToken`完成Supabase认证
7. **完成**: 用户成功登录,跳转到应用

### 显示条件

One Tap提示**仅在以下条件全部满足时显示**:

- ✅ 用户未登录应用
- ✅ 用户浏览器中已登录Google账户
- ✅ 不在认证页面(/signin, /signup等)
- ✅ 用户之前未关闭/拒绝过One Tap
- ✅ 域名已在Google Cloud Console授权
- ✅ 使用HTTPS(生产环境)或localhost(开发环境)

## 常见问题

### 1. One Tap没有显示

**可能原因**:

- Client ID未配置或配置错误
- 域名未在Google Cloud Console授权
- 用户浏览器未登录Google账户
- 用户之前关闭/拒绝过One Tap
- 当前页面是认证页面(设计如此)

**解决方法**:

检查控制台日志中的错误信息:

```javascript
[Google One Tap] 未显示原因: opt_out_or_no_session
// 意味着用户浏览器中没有Google会话

[Google One Tap] 未显示原因: unregistered_origin
// 意味着域名未授权,需要在Google Cloud Console添加

[Google One Tap] 未显示原因: suppressed_by_user
// 用户之前关闭过提示,需要清除浏览器cookie重试
```

### 2. 登录后出现错误

确保:
- Supabase中已启用Google OAuth
- Supabase的Google Provider配置正确
- Client ID与Supabase配置匹配

### 3. 生产环境不工作

确保:
- 生产环境使用HTTPS
- 生产域名已添加到授权来源
- `.env.production`中配置了正确的Client ID

## 自定义配置

### 调整显示延迟

在`HomePage.tsx`中修改`delay`参数:

```tsx
<GoogleOneTap delay={3000} context="signin" />
// 延迟3秒显示,避免干扰用户浏览
```

### 更改提示上下文

```tsx
<GoogleOneTap context="signup" />
// 上下文: "signin" | "signup" | "use"
// 影响提示文案
```

### 允许点击外部关闭

```tsx
<GoogleOneTap cancelOnTapOutside={true} />
// 默认false,设为true允许用户点击外部关闭提示
```

### 在其他页面启用

在任何页面组件中添加:

```tsx
import GoogleOneTap from '@/components/auth/GoogleOneTap'

export default function MyPage() {
  return (
    <>
      <GoogleOneTap />
      {/* 其他内容 */}
    </>
  )
}
```

## 数据跟踪

One Tap登录会自动触发分析事件:

```javascript
trackLogin('google_one_tap')
```

在Google Analytics中可以看到这些事件,用于评估One Tap的转化效果。

## 安全性

- ✅ JWT Token由Google签名,防篡改
- ✅ Token在服务器端由Supabase验证
- ✅ 支持CSRF保护
- ✅ 仅授权域名可以使用
- ✅ 用户可随时撤销授权

## 测试建议

### 开发环境测试

1. 确保浏览器已登录Google账户
2. 访问 `http://localhost:5173`
3. 应在2秒后看到One Tap提示
4. 点击账户完成登录
5. 检查控制台日志确认流程

### 生产环境测试

1. 部署到生产环境
2. 使用隐私模式/无痕模式访问
3. 先登录Google账户(gmail.com)
4. 再访问您的网站
5. 验证One Tap是否正常显示

## 参考资源

- [Google Identity Services 官方文档](https://developers.google.com/identity/gsi/web)
- [Google One Tap 最佳实践](https://developers.google.com/identity/gsi/web/guides/overview)
- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)

## 技术支持

如遇到问题,请:

1. 检查控制台日志
2. 验证环境变量配置
3. 确认Google Cloud Console配置
4. 查看本文档的常见问题部分
