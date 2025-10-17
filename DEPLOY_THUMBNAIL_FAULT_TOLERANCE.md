# 缩略图生成容错系统 - 部署指南

## 📋 改动概览

本次更新实现了完整的5层容错体系，彻底解决缩略图永久卡住的问题。

### 文件改动清单

#### 1. 数据库层 (Supabase)
- **新增**: `supabase/migrations/026_enhanced_thumbnail_generation_with_fault_tolerance.sql`
  - 增强触发器使用状态跟踪
  - 创建定时重试函数
  - 添加监控视图

#### 2. Edge Function层 (Supabase Functions)
- **修改**: `supabase/functions/auto-generate-thumbnail/index.ts`
  - 开始时更新状态为 `processing`
  - 成功时更新状态为 `completed`
  - 失败时更新状态为 `failed` + 错误信息
- **新增**: `supabase/functions/retry-stuck-thumbnails/index.ts`
  - 定时清理Edge Function

#### 3. 定时任务层 (Cloudflare)
- **修改**: `wrangler.toml` - 添加Cron触发器配置
- **新增**: `functions/scheduled.ts` - Cloudflare Pages Functions定时任务处理器

#### 4. 前端层 (React/TypeScript)
- **修改**: `src/types/video.types.ts`
  - 添加 `ThumbnailGenerationStatus` 类型

#### 5. 修复脚本
- **修改**: `fix-stuck-thumbnails.sql` - 一次性修复当前卡住的视频

---

## 🚀 部署步骤

### Step 1: 部署数据库 Migration

```bash
# 方法1: 通过 Supabase Dashboard SQL Editor
# 1. 打开 https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/sql/new
# 2. 复制 supabase/migrations/026_enhanced_thumbnail_generation_with_fault_tolerance.sql 的内容
# 3. 粘贴并执行

# 方法2: 通过 psql（需要网络可达）
PGPASSWORD="huixiangyigou2025!" psql \\
  -h db.hvkzwrnvxsleeonqqrzq.supabase.co \\
  -p 5432 \\
  -d postgres \\
  -U postgres \\
  -f supabase/migrations/026_enhanced_thumbnail_generation_with_fault_tolerance.sql
```

**预期输出**:
```
✅ 缩略图生成容错系统部署完成！
📊 当前系统状态:
  - 已完成: X 个
  - 处理中: X 个
  - 待处理: X 个
  - 已失败: X 个
```

### Step 2: 配置 system_config（关键！）

```sql
-- 确保以下配置存在（触发器依赖这些配置）
INSERT INTO system_config (key, value, description)
VALUES
  ('supabase_url', 'https://hvkzwrnvxsleeonqqrzq.supabase.co', 'Supabase项目URL'),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI', 'Supabase Service Role Key')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### Step 3: 部署 Edge Functions

```bash
# 部署缩略图生成函数（已修改）
npx supabase functions deploy auto-generate-thumbnail

# 部署定时清理函数（新增）
npx supabase functions deploy retry-stuck-thumbnails
```

**配置 Edge Function 环境变量**（Supabase Dashboard）:
```bash
# 必需环境变量
SUPABASE_URL=https://hvkzwrnvxsleeonqqrzq.supabase.co
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_CLOUDFLARE_ACCOUNT_ID=c6fc8bcf3bba37f2611b6f3d7aad25b9
VITE_CLOUDFLARE_R2_ACCESS_KEY_ID=57c7b53c14b7d962b9a2187e8764a835
VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY=69265850a7e9d5f18f5ebb6f2cf5b6b8ad48d54c2ae722611d1d281e401684a8
VITE_CLOUDFLARE_R2_BUCKET_NAME=ai-video-storage
VITE_CLOUDFLARE_R2_PUBLIC_DOMAIN=cdn.veo3video.me

# 可选环境变量（用于Cron授权）
CRON_SECRET=<your-secret-token>
```

### Step 4: 配置定时任务

#### 选项A: Cloudflare Workers Cron（推荐 ⭐）

**已配置文件**:
- ✅ `wrangler.toml` - 已添加 `[triggers] crons = ["0 * * * *"]`
- ✅ `functions/scheduled.ts` - Cloudflare Pages Functions handler

**部署步骤**:
```bash
# 1. 确保环境变量已配置（Cloudflare Dashboard → Workers & Pages → 你的项目 → Settings → Environment variables）
# 需要配置：
# - VITE_SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - CRON_SECRET（可选，用于额外安全验证）

# 2. 部署到 Cloudflare Pages
npm run build:cloudflare  # 或你的构建命令
wrangler pages deploy build  # 或你的部署命令

# 3. 验证Cron是否生效
# - 打开 Cloudflare Dashboard
# - 进入 Workers & Pages → 你的项目 → Settings → Triggers
# - 应该看到 Cron Trigger: "0 * * * *"
```

**手动触发测试**:
```bash
# 通过 Cloudflare Pages Function URL 测试
curl -X POST https://veo3video.me/scheduled \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**查看执行日志**:
```bash
# 使用 wrangler 查看日志
wrangler pages deployment tail

# 或在 Cloudflare Dashboard 查看
# Workers & Pages → 你的项目 → Logs → Real-time Logs
```

#### 选项B: 直接调用 Supabase Edge Function（最简单）

不需要任何额外配置，直接使用外部cron服务：

**使用 EasyCron 或 cron-job.org**:
1. 注册账号：https://cron-job.org/en/
2. 创建新任务：
   - URL: `https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/retry-stuck-thumbnails`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - Schedule: `0 * * * *` (每小时)

**使用系统 crontab**（macOS/Linux）:
```bash
# 编辑 crontab
crontab -e

# 添加以下行（每小时执行）
0 * * * * curl -X POST https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/retry-stuck-thumbnails -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Step 5: 修复当前卡住的视频

```bash
# 执行一次性修复脚本
# 方法1: Supabase Dashboard
# 复制 fix-stuck-thumbnails.sql 内容并执行

# 方法2: psql
PGPASSWORD="huixiangyigou2025!" psql \\
  -h db.hvkzwrnvxsleeonqqrzq.supabase.co \\
  -p 5432 \\
  -d postgres \\
  -U postgres \\
  -f fix-stuck-thumbnails.sql
```

**预期结果**:
```
✅ 完成！共触发 3 个视频的缩略图生成
⏰ 请等待3-5分钟让Edge Function处理
🔄 之后刷新我的视频页面查看结果
```

### Step 6: 部署前端更新（可选 - 未来增强）

```bash
# 前端类型已更新，重新构建
npm run build

# 部署到 Cloudflare Pages
npm run deploy
```

---

## 🧪 验证部署

### 1. 检查数据库函数

```sql
-- 查看可用函数
SELECT routinename, routinedef
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND routinename LIKE '%thumbnail%';

-- 测试自动重试函数
SELECT auto_retry_stuck_thumbnails();
```

### 2. 检查监控视图

```sql
-- 查看系统健康状况
SELECT * FROM thumbnail_generation_health;

-- 查看失败原因统计
SELECT * FROM thumbnail_generation_failures;

-- 查看需要处理的视频
SELECT * FROM videos_need_thumbnail_generation LIMIT 10;
```

### 3. 手动触发测试

```bash
# 手动调用定时清理函数
curl -X POST https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/retry-stuck-thumbnails \\
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json"
```

### 4. 前端验证

1. 打开 https://veo3video.me/videos
2. 查看"吸血鬼"相关视频
3. 应该在3-5分钟内看到缩略图生成完成

---

## 📊 监控和维护

### 日常监控

```sql
-- 每天检查一次健康状况
SELECT
  completed_count,
  failed_count,
  processing_count,
  pending_count,
  success_rate_percent,
  ROUND(avg_generation_time_seconds::NUMERIC, 1) as avg_time_sec
FROM thumbnail_generation_health;
```

### 失败分析

```sql
-- 查看最近失败的视频
SELECT
  id,
  title,
  thumbnail_generation_error,
  thumbnail_generation_attempts,
  thumbnail_generation_last_attempt_at
FROM videos
WHERE thumbnail_generation_status = 'failed'
  AND thumbnail_generation_last_attempt_at > NOW() - INTERVAL '24 hours'
ORDER BY thumbnail_generation_last_attempt_at DESC
LIMIT 20;
```

### 手动重试

```sql
-- 手动触发单个视频的缩略图生成
SELECT manually_trigger_thumbnail_generation('video-id-here');

-- 批量触发（默认10个）
SELECT batch_trigger_thumbnail_generation(10);
```

---

## 🛡️ 容错机制说明

### 第1层：触发器增强
- ✅ 配置缺失时记录错误（不再静默失败）
- ✅ 检查重试次数（最大3次）
- ✅ 记录状态变化

### 第2层：Edge Function状态同步
- ✅ 开始时：`pending` → `processing`
- ✅ 成功时：`processing` → `completed` + thumbnail_url
- ✅ 失败时：`processing` → `failed` + 错误信息

### 第3层：定时清理（每小时）
- ✅ 处理卡住的视频（processing超过30分钟）
- ✅ 重试失败的视频（failed且attempts < 3）
- ✅ 处理未初始化的视频（NULL状态超过10分钟）

### 第4层：前端智能显示（待实现）
- 🔜 读取 `thumbnail_generation_status`
- 🔜 pending: "等待生成..."
- 🔜 processing: "生成中..."
- 🔜 failed: "生成失败" + 重试按钮

### 第5层：监控告警
- ✅ 成功率统计视图
- ✅ 失败原因统计视图
- ✅ 平均生成时间跟踪

---

## 🚨 故障排查

### 问题1: 缩略图仍然卡住

**检查清单**:
1. system_config 是否配置正确
2. Edge Function 是否部署成功
3. 定时任务是否在运行
4. 查看Edge Function日志

```bash
# 查看Edge Function日志
npx supabase functions logs auto-generate-thumbnail
npx supabase functions logs retry-stuck-thumbnails
```

### 问题2: 定时任务未执行

**Cloudflare Workers Cron**:
```bash
# 1. 检查 Cloudflare Dashboard
# Workers & Pages → 你的项目 → Settings → Triggers
# 应该看到 Cron Trigger: "0 * * * *"

# 2. 查看执行日志
wrangler pages deployment tail

# 3. 手动触发测试
curl -X POST https://veo3video.me/scheduled \\
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json"
```

**如果使用外部cron服务**:
- 登录 cron-job.org 查看执行历史
- 检查是否有失败记录

### 问题3: 生成失败率高

```sql
-- 分析失败原因
SELECT
  thumbnail_generation_error,
  COUNT(*) as count,
  array_agg(DISTINCT id) as video_ids
FROM videos
WHERE thumbnail_generation_status = 'failed'
GROUP BY thumbnail_generation_error
ORDER BY count DESC;
```

---

## 📝 关键变更总结

1. **触发器不再静默失败** - 配置缺失时会记录到数据库
2. **状态全程跟踪** - pending → processing → completed/failed
3. **自动重试机制** - 定时任务每小时检查并重试
4. **详细错误记录** - 失败原因、重试次数全部记录
5. **监控视图** - 实时了解系统健康状况

---

## ✅ 部署完成检查清单

- [ ] Migration 026 执行成功
- [ ] system_config 配置完成
- [ ] Edge Functions 部署成功（auto-generate-thumbnail + retry-stuck-thumbnails）
- [ ] Cloudflare环境变量配置完成（VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY）
- [ ] Cloudflare Workers Cron配置完成（wrangler.toml + functions/scheduled.ts）
- [ ] 当前卡住视频已修复（执行fix-stuck-thumbnails.sql）
- [ ] 监控视图查询正常
- [ ] 浏览器验证缩略图显示

---

## 🎯 预期效果

部署完成后：

1. **现有问题解决**: 3个吸血鬼视频在3-5分钟内生成缩略图
2. **未来视频自动化**: 新视频完成后自动生成缩略图
3. **容错保障**: 即使失败也会自动重试（最多3次）
4. **可监控**: 随时了解系统健康状况
5. **可维护**: 清晰的日志和错误信息

**成功率目标**: >95%
**平均生成时间**: <30秒
**自动恢复时间**: <1小时
