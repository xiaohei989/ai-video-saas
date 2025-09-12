# 自定义域名OAuth配置指南

## 🎯 目标
将OAuth登录时显示的域名从 `hvkzwrnvxsleeonqqrzq.supabase.co` 改为产品名称 `veo3video.me`

## 📋 当前分析结果

### 现有配置：
- **生产域名**: `veo3video.me` (已在 .env.cloudflare 中配置)
- **Supabase项目ID**: `hvkzwrnvxsleeonqqrzq`
- **当前OAuth重定向域名**: `hvkzwrnvxsleeonqqrzq.supabase.co`

## 🔧 解决方案：配置Supabase自定义域名

### 方案1: 使用Supabase自定义域名功能（推荐）

#### 步骤1: 配置DNS记录
在您的域名DNS提供商（如Cloudflare）中添加以下记录：

```dns
# 为Supabase API创建子域名
Type: CNAME
Name: api
Value: hvkzwrnvxsleeonqqrzq.supabase.co
TTL: Auto/300
```

这将创建 `api.veo3video.me` 作为Supabase API的自定义域名。

#### 步骤2: Supabase Dashboard配置
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/settings/general)
2. 进入 Settings → General → Custom domains
3. 添加自定义域名：`api.veo3video.me`
4. 等待SSL证书自动配置完成

#### 步骤3: 更新环境变量
```bash
# 更新 .env 文件
VITE_SUPABASE_URL=https://api.veo3video.me

# 更新 .env.cloudflare 文件  
VITE_SUPABASE_URL=https://api.veo3video.me
```

#### 步骤4: 更新OAuth提供商配置

**Google OAuth Console:**
1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 编辑OAuth 2.0客户端ID
3. 更新授权重定向URI：
   - 添加: `https://api.veo3video.me/auth/v1/callback`
   - 移除旧的: `https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback`

**Apple Developer Console:**
1. 访问 [Apple Developer Console](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. 编辑Service ID: `com.veo3video.webapp.web`
3. 更新Return URLs：
   - 添加: `https://api.veo3video.me/auth/v1/callback`
   - 移除旧的: `https://hvkzwrnvxsleeonqqrzq.supabase.co/auth/v1/callback`

### 方案2: 使用主域名作为Auth域名（高级配置）

#### 如果您希望OAuth显示主域名 `veo3video.me`

**DNS配置：**
```dns
# 主域名CNAME到Supabase
Type: CNAME  
Name: auth
Value: hvkzwrnvxsleeonqqrzq.supabase.co
```

**环境变量：**
```bash
VITE_SUPABASE_URL=https://auth.veo3video.me
```

## 🔄 代码更新

### 更新Supabase配置文件

修改 `src/lib/supabase.ts`:

```typescript
// 更新Supabase URL为自定义域名
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL // 现在指向 api.veo3video.me
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 其他配置保持不变
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-hvkzwrnvxsleeonqqrzq-auth-token', // 保持不变以兼容现有用户
    storage: localStorage,
    flowType: 'pkce',
  },
})
```

### 更新OAuth重定向配置

确保 `src/contexts/AuthContext.tsx` 中的重定向配置正确：

```typescript
// Google OAuth (第667行)
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`, // 保持不变
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})

// Apple OAuth (第701行)  
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'apple',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`, // 保持不变
  },
})
```

## 📝 部署步骤

### 1. 开发环境测试

```bash
# 更新环境变量
cp .env .env.backup
echo "VITE_SUPABASE_URL=https://api.veo3video.me" >> .env

# 重启开发服务器
npm run dev
```

### 2. 生产环境部署

**Cloudflare Pages:**
1. 更新环境变量：`VITE_SUPABASE_URL=https://api.veo3video.me`
2. 重新部署应用

**Supabase Edge Functions:**
```bash
# 更新所有Edge Function中的URL引用（如果有）
SUPABASE_ACCESS_TOKEN=your-token supabase functions deploy --project-ref hvkzwrnvxsleeonqqrzq
```

## ✅ 验证检查清单

- [ ] DNS CNAME记录已添加并生效
- [ ] Supabase自定义域名已配置且SSL证书已颁发
- [ ] Google OAuth Console重定向URI已更新
- [ ] Apple Developer Console Return URL已更新
- [ ] 环境变量已更新
- [ ] 开发环境测试通过
- [ ] 生产环境部署成功
- [ ] OAuth登录测试成功（显示新域名）

## 🔍 故障排除

### 常见问题：

1. **DNS传播延迟**
   - 等待24-48小时DNS完全传播
   - 使用 `nslookup api.veo3video.me` 验证

2. **SSL证书问题**
   - 确保Supabase已自动颁发SSL证书
   - 检查证书状态在Dashboard中

3. **OAuth重定向错误**
   - 确认所有OAuth提供商都已更新重定向URI
   - 检查URI完全匹配（包括协议和路径）

4. **现有用户会话**
   - 可能需要现有用户重新登录
   - 清除localStorage中的旧认证token

## 📊 预期效果

配置完成后：
- OAuth登录页面将显示 "登录到 api.veo3video.me" 或 "登录到 veo3video.me"
- 用户体验更专业，品牌一致性更强
- 技术架构保持不变，只是域名展示变更