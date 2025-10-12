# 后端自动缩略图生成系统 - 部署指南

## 📦 系统概述

自动缩略图生成系统在视频完成时由数据库触发器自动调用 Edge Function 生成缩略图，**完全不依赖前端**，用户离开页面后也能正常生成。

### 核心组件

| 组件 | 类型 | 功能 |
|------|------|------|
| `auto-generate-thumbnail` | Edge Function | 使用 Cloudinary API 从视频生成缩略图 |
| `trigger_auto_generate_thumbnail()` | Database Function | 监听视频完成事件并触发 Edge Function |
| `on_video_completed_auto_thumbnail` | Database Trigger | 绑定到 `videos` 表的 UPDATE 事件 |

---

## 🚀 部署步骤

### 步骤1: 注册 Cloudinary 账号（免费）

1. 访问 https://cloudinary.com/users/register/free
2. 注册免费账号（25 GB 存储/月）
3. 登录后进入 Dashboard
4. 复制 **Cloud name**（例如：`dk1a2b3c4`）

---

### 步骤2: 配置环境变量

#### **A. Supabase Dashboard 配置**

1. 打开 Supabase 项目控制台
2. 进入 **Settings** → **Edge Functions** → **Environment Variables**
3. 添加以下变量：

```bash
CLOUDINARY_CLOUD_NAME=dk1a2b3c4  # 替换为你的 Cloud name
```

#### **B. 本地开发环境配置**

在项目根目录创建 `.env.local` 文件（或更新现有文件）：

```bash
# Cloudinary 配置
CLOUDINARY_CLOUD_NAME=dk1a2b3c4
```

---

### 步骤3: 部署 Edge Function

```bash
# 进入项目目录
cd ai-video-saas

# 登录 Supabase CLI（如果还没登录）
npx supabase login

# 关联项目（替换为你的项目引用）
npx supabase link --project-ref your-project-ref

# 部署 auto-generate-thumbnail 函数
npx supabase functions deploy auto-generate-thumbnail

# 验证部署
npx supabase functions list
```

预期输出：
```
✓ auto-generate-thumbnail
✓ generate-blur-thumbnail
✓ upload-thumbnail
...
```

---

### 步骤4: 执行数据库迁移

```bash
# 方式1: 使用 Supabase CLI（推荐）
npx supabase db push

# 方式2: 在 Supabase Dashboard 执行
# 打开 SQL Editor，复制并执行 supabase/migrations/021_auto_thumbnail_trigger.sql 的内容
```

执行后你应该看到：
```
✅ 触发器: on_video_completed_auto_thumbnail
✅ 函数: trigger_auto_generate_thumbnail()
✅ 手动触发: manually_trigger_thumbnail_generation(video_id)
✅ 批量触发: batch_trigger_thumbnail_generation(limit)
```

---

### 步骤5: 配置 Supabase Settings（重要）

由于触发器需要调用 Edge Function，需要配置数据库可以访问 HTTP：

#### **A. 启用 pg_net 扩展**

在 Supabase Dashboard → **Database** → **Extensions**：

1. 搜索 `pg_net`
2. 点击启用

#### **B. 配置 Secrets（用于触发器）**

在 SQL Editor 执行：

```sql
-- 设置 Supabase URL（替换为你的项目 URL）
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';

-- 设置 Service Role Key（从 Settings -> API 复制）
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

-- 设置项目引用（可选）
ALTER DATABASE postgres SET app.settings.project_ref = 'your-project-ref';
```

⚠️ **安全提示**: Service Role Key 拥有管理员权限，请妥善保管。

---

## ✅ 测试验证

### 测试1: 手动触发单个视频

在 SQL Editor 执行：

```sql
-- 查找一个需要生成缩略图的视频
SELECT id, title, video_url, thumbnail_url
FROM videos
WHERE status = 'completed'
  AND video_url IS NOT NULL
  AND thumbnail_url IS NULL
LIMIT 1;

-- 手动触发缩略图生成（替换为实际的 video_id）
SELECT manually_trigger_thumbnail_generation('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
```

预期返回：
```json
{
  "success": true,
  "videoId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "responseId": 123456,
  "message": "Thumbnail generation triggered"
}
```

### 测试2: 批量处理历史视频

```sql
-- 批量处理前10个缺失缩略图的视频
SELECT batch_trigger_thumbnail_generation(10);
```

### 测试3: 查看待处理视频

```sql
-- 查看所有等待生成缩略图的视频
SELECT * FROM videos_pending_auto_thumbnails;
```

### 测试4: 模拟视频完成（触发器自动执行）

```sql
-- 更新一个视频状态为 completed（会自动触发缩略图生成）
UPDATE videos
SET status = 'completed',
    video_url = 'https://cdn.veo3video.me/videos/test-video.mp4'
WHERE id = 'test-video-id'
  AND status != 'completed';

-- 等待几秒后检查缩略图是否生成
SELECT id, thumbnail_url, thumbnail_generated_at
FROM videos
WHERE id = 'test-video-id';
```

---

## 🔍 监控和调试

### 查看 Edge Function 日志

```bash
# 实时查看日志
npx supabase functions logs auto-generate-thumbnail --tail

# 查看最近 100 条日志
npx supabase functions logs auto-generate-thumbnail --limit 100
```

### 查看触发器执行记录

```sql
-- 查看 pg_net 的 HTTP 请求记录
SELECT * FROM net.http_request_queue
ORDER BY created_at DESC
LIMIT 10;
```

### 常见问题排查

#### 问题1: 触发器没有执行

**检查项**:
```sql
-- 1. 确认触发器存在
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_video_completed_auto_thumbnail';

-- 2. 确认 pg_net 已启用
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 3. 检查配置
SELECT current_setting('app.settings.supabase_url', true) AS supabase_url;
SELECT current_setting('app.settings.service_role_key', true) AS service_key;
```

#### 问题2: Edge Function 报错 "CLOUDINARY_CLOUD_NAME not configured"

**解决方案**:
1. 在 Supabase Dashboard → Settings → Edge Functions → Environment Variables
2. 确认已添加 `CLOUDINARY_CLOUD_NAME`
3. 重新部署函数：`npx supabase functions deploy auto-generate-thumbnail`

#### 问题3: Cloudinary 返回 404

**原因**: 视频 URL 无法访问或格式不支持

**解决方案**:
- 确认视频 URL 可公开访问
- 检查 CORS 设置
- 使用 Cloudflare 备用方案（自动回退）

---

## 📊 成本估算

### Cloudinary 免费套餐

- **存储**: 25 GB/月
- **带宽**: 25 GB/月
- **转换次数**: 25,000 次/月

### 预计消耗

假设每个视频生成缩略图：
- 1 次 Cloudinary API 调用
- 缩略图大小约 80 KB

**每月 1000 个视频** = 1000 次转换 + 80 MB 存储 = **完全免费**

**每月 20,000 个视频** = 20,000 次转换 + 1.6 GB 存储 = **仍在免费额度内**

---

## 🎯 高级功能

### 定时批量处理（可选）

使用 Supabase Cron Job 每小时自动处理缺失的缩略图：

```sql
-- 创建 pg_cron 定时任务（需要 pg_cron 扩展）
SELECT cron.schedule(
  'auto-thumbnail-hourly',
  '0 * * * *', -- 每小时执行
  $$SELECT batch_trigger_thumbnail_generation(50)$$
);
```

### 禁用自动触发

```sql
-- 临时禁用
UPDATE system_config
SET value = 'false'
WHERE key = 'auto_thumbnail_enabled';

-- 重新启用
UPDATE system_config
SET value = 'true'
WHERE key = 'auto_thumbnail_enabled';
```

### 切换生成方法

```sql
-- 使用 Cloudflare（仅第一帧）
UPDATE system_config
SET value = 'cloudflare'
WHERE key = 'thumbnail_generation_method';

-- 使用 Cloudinary（指定时间点）
UPDATE system_config
SET value = 'cloudinary'
WHERE key = 'thumbnail_generation_method';
```

---

## 🔄 回滚方案

如果需要禁用自动触发系统：

```sql
-- 1. 删除触发器
DROP TRIGGER IF EXISTS on_video_completed_auto_thumbnail ON videos;

-- 2. 删除函数
DROP FUNCTION IF EXISTS trigger_auto_generate_thumbnail();

-- 3. 保留手动触发功能（可选）
-- manually_trigger_thumbnail_generation() 和 batch_trigger_thumbnail_generation() 仍然可用
```

---

## 📝 总结

✅ **优点**:
- 完全后端自动化，不依赖用户在线
- 零服务器成本（使用 Cloudinary 免费套餐）
- 支持历史视频批量补充
- 失败自动降级（Cloudinary → Cloudflare → 前端）

⚠️ **注意事项**:
- 需要正确配置 `pg_net` 和 Service Role Key
- Cloudinary 免费额度有限，大规模使用需升级
- 触发器执行是异步的，不会阻塞视频状态更新

🎯 **适用场景**:
- 视频量 < 25,000/月 → 完全免费
- 视频量 > 25,000/月 → 考虑 Cloudflare Stream 或自建服务
