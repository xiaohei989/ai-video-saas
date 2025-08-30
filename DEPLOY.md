# 部署指南

## Service Role Key 安全配置

### 🚨 重要安全警告

**Service Role Key 具有完全的数据库访问权限，必须严格保密！**

### 环境配置

#### 开发环境

1. **创建 `.env.local` 文件**（已创建）：
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
   ```

2. **获取 Service Role Key**：
   - 登录 [Supabase Dashboard](https://app.supabase.com)
   - 选择项目 (hvkzwrnvxsleeonqqrzq)
   - 导航到 **Settings** → **API**
   - 复制 **service_role secret** 到 `.env.local`

#### 生产环境（推荐方案）

**使用 Supabase Edge Functions**：

1. **部署 Edge Function**：
   ```bash
   # 安装 Supabase CLI
   brew install supabase/tap/supabase
   
   # 登录（需要 Access Token）
   supabase login --token YOUR_ACCESS_TOKEN
   
   # 链接项目
   supabase link --project-ref hvkzwrnvxsleeonqqrzq
   
   # 设置 Secret（注意：不能使用 SUPABASE_ 前缀）
   supabase secrets set SERVICE_ROLE_KEY=your_service_role_key
   
   # 部署函数
   supabase functions deploy update-video-status
   ```

2. **或者通过 Dashboard 部署**：
   - 登录 Supabase Dashboard
   - 导航到 **Edge Functions**
   - 上传 `supabase/functions/update-video-status/index.ts`
   - 在 **Secrets** 中设置：
     - **Key**: `SERVICE_ROLE_KEY`（注意：不能使用 SUPABASE_ 前缀）
     - **Value**: 你的 Service Role Key

### 部署平台配置

#### Vercel

1. **环境变量**（仅公开变量）：
   ```
   VITE_SUPABASE_URL=https://hvkzwrnvxsleeonqqrzq.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VEO_API_PROVIDER=qingyun
   QINGYUN_API_ENDPOINT=https://api.qingyuntop.top
   ```

2. **不要添加**：
   - ❌ SUPABASE_SERVICE_ROLE_KEY
   - ❌ 任何包含 "SECRET" 或 "PRIVATE" 的变量

#### Netlify

同 Vercel，仅配置公开环境变量。

### 安全检查清单

- [ ] `.env.local` 已添加到 `.gitignore`
- [ ] Service Role Key 不在任何提交的文件中
- [ ] 生产部署不包含 Service Role Key
- [ ] Edge Function 已正确部署
- [ ] Edge Function Secrets 已配置

### 工作原理

```
开发环境：
前端 → Service Role Key (本地) → Supabase

生产环境：
前端 → Edge Function (安全) → Service Role Key → Supabase
```

### 故障排除

#### 问题：开发环境显示 "Service Role Key not configured"
**解决**：检查 `.env.local` 文件是否存在且包含正确的密钥

#### 问题：生产环境视频状态不更新
**解决**：确保 Edge Function 已部署且 Secrets 已配置

#### 问题：Edge Function 调用失败
**解决**：
1. 检查 Supabase 项目是否启用了 Edge Functions
2. 验证函数名称是否正确
3. 检查 CORS 配置

### 监控和日志

生产环境可以通过以下方式监控：
- Supabase Dashboard → Edge Functions → Logs
- 前端控制台中的 `[EDGE FUNCTION]` 日志
- 数据库中的视频状态变化

### 紧急响应

如果 Service Role Key 泄露：
1. **立即**在 Supabase Dashboard 重新生成密钥
2. 更新所有使用该密钥的服务
3. 检查数据库访问日志
4. 更新 Edge Function Secrets