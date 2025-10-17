# 系统完整流程分析与漏洞报告

**报告时间:** 2025-10-15
**状态:** 已修复缩略图触发器，发现R2迁移重试漏洞

---

## 📊 当前系统状态

### 最近30个视频统计
| 指标 | 数量 | 百分比 |
|------|------|--------|
| R2迁移失败 | 17个 | 57% |
| 缩略图缺失 | 20个 | 67% |
| 缩略图生成失败 (Cloudflare错误) | 7个 | 23% |

---

## 🔄 完整业务流程

### 阶段1: 视频生成
```
用户提交请求
    ↓
调用 Google Veo3 API
    ↓
视频生成中 (status = 'processing')
    ↓
视频生成完成，上传到阿里云 OSS
    ↓
status = 'completed'
video_url = 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/...'
```

### 阶段2: R2 迁移（自动）
```
status 变为 'completed'
    ↓
触发器: on_video_completed_auto_migrate
    ↓
检查是否需要迁移:
  - video_url 不包含 cdn.veo3video.me
  - migration_status != 'completed'
  - r2_url == NULL
    ↓
设置 migration_status = 'pending'
    ↓
调用 Edge Function: migrate-video
    ├─ 下载: 从阿里云 OSS 下载视频
    ├─ 上传: 上传到 Cloudflare R2
    ├─ 验证: 检查 R2 文件可访问性
    └─ 更新:
        migration_status = 'completed'
        r2_url = 'https://cdn.veo3video.me/videos/...'
        video_url = r2_url (切换到R2)
```

**失败情况：**
- 下载失败 → `migration_status = 'failed'`
- 上传失败 → `migration_status = 'failed'`
- 超时（3分钟）→ `migration_status = 'failed'`

### 阶段3: 缩略图生成（自动）
```
migration_status = 'completed'
或 status = 'completed' (新增)
    ↓
触发器: on_video_migration_completed_auto_thumbnail
    ↓
检查条件:
  - video_url != NULL
  - thumbnail_url == NULL 或为占位符 SVG
  - thumbnail_generation_attempts < 3
    ↓
设置 thumbnail_generation_status = 'pending'
    ↓
调用 Edge Function: auto-generate-thumbnail
    ├─ 使用 Cloudflare Media Transformations
    ├─ 生成高清缩略图
    ├─ 生成模糊缩略图
    └─ 更新:
        thumbnail_url = '...'
        thumbnail_blur_url = '...'
        thumbnail_generation_status = 'completed'
```

**失败情况：**
- Cloudflare错误 → `thumbnail_generation_status = 'failed'`
- 源URL不在允许列表 → HTTP 500错误
- 重试次数达到3次 → 永久标记为failed

---

## 🚨 发现的漏洞和问题

### 漏洞1: R2迁移失败无自动重试机制 ❌ 严重

**问题描述：**
- 75%的视频迁移失败（17/30）
- 迁移失败后 `migration_status = 'failed'`，**永远不会自动重试**
- 只能手动触发重试

**影响：**
- 大量视频留在阿里云OSS，浪费成本
- 视频访问速度慢（OSS在新加坡，用户可能在全球）
- 无法利用R2的CDN加速

**根本原因：**
```typescript
// migrate-video Edge Function (第118-131行)
const videoResponse = await fetch(video.video_url)
if (!videoResponse.ok) {
  await updateMigrationStatus(supabase, videoId, 'failed')
  // ❌ 直接标记失败，不重试！
  return error
}
```

**缺失的机制：**
1. 没有定时任务重试失败的迁移
2. 没有迁移重试次数限制字段（migration_attempts）
3. 没有失败原因记录（migration_error）

**解决方案：**
- ✅ 短期：手动批量重试（使用现有函数）
- ❌ 长期：需要添加自动重试机制（见建议方案）

---

### 漏洞2: 缩略图触发器只监听迁移成功 ✅ 已修复

**问题描述：**
- 原触发器只监听 `migration_status = 'completed'`
- 迁移失败的视频永远不会生成缩略图

**修复状态：**
✅ 已在 Migration 027 中修复
- 现在同时监听 `status = 'completed'`
- 迁移失败的视频也会生成缩略图

---

### 漏洞3: Cloudflare Media Transformations 源验证失败 ✅ 已修复

**问题描述：**
- 7个视频报错：`MEDIA_TRANSFORMATION_ERROR 9401: Transformation origin is not in allowed origins list`
- 阿里云OSS域名未在Cloudflare允许列表中

**修复状态：**
✅ 用户已手动在Cloudflare中添加阿里云域名

---

### 漏洞4: 缩略图生成无重试机制 ✅ 已有机制

**状态：** 已有自动重试
- ✅ 有 `auto_retry_stuck_thumbnails()` 数据库函数
- ✅ 有 `retry-stuck-thumbnails` Edge Function
- ✅ 重试次数限制: 最多3次
- ⚠️ 需要配置定时任务调用（Cron）

---

### 漏洞5: 超时设置不合理 ⚠️ 中等

**R2迁移超时：**
```typescript
timeout_milliseconds := 180000  // 3分钟
```

**问题：**
- 大视频文件（>100MB）可能3分钟下载不完
- 超时后直接标记失败，不重试

**建议：**
- 增加超时时间到 5-10 分钟
- 或根据文件大小动态调整

---

### 漏洞6: 缺少监控和告警 ⚠️ 中等

**缺失的监控：**
1. 迁移成功率监控
2. 缩略图生成成功率监控
3. 失败原因统计和告警
4. pg_net 请求失败告警

**影响：**
- 问题发现不及时（本次是用户报告才发现）
- 无法追踪根本原因趋势

---

## 💡 建议的修复方案

### 方案1: 添加R2迁移自动重试机制（高优先级）

#### 1.1 数据库增加字段

```sql
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS migration_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS migration_error TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS migration_last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX idx_videos_failed_migrations
  ON videos(migration_status, migration_attempts)
  WHERE migration_status = 'failed' AND migration_attempts < 3;
```

#### 1.2 创建自动重试函数

```sql
CREATE OR REPLACE FUNCTION auto_retry_failed_migrations()
RETURNS JSON AS $$
DECLARE
  v_count INTEGER := 0;
  v_video RECORD;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_edge_function_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- 读取配置
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_role_key FROM system_config WHERE key = 'service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'system_config 配置缺失');
  END IF;

  v_edge_function_url := v_supabase_url || '/functions/v1/migrate-video';

  -- 查找失败且未达到最大重试次数的视频
  FOR v_video IN
    SELECT id, video_url, migration_status, migration_attempts
    FROM videos
    WHERE status = 'completed'
      AND migration_status = 'failed'
      AND video_url IS NOT NULL
      AND video_url NOT LIKE '%cdn.veo3video.me%'
      AND COALESCE(migration_attempts, 0) < 3
      AND (migration_last_attempt_at IS NULL
           OR migration_last_attempt_at < NOW() - INTERVAL '30 minutes')
    ORDER BY migration_attempts ASC, created_at DESC
    LIMIT 20
  LOOP
    -- 更新重试状态
    UPDATE videos
    SET
      migration_status = 'pending',
      migration_attempts = COALESCE(migration_attempts, 0) + 1,
      migration_last_attempt_at = NOW()
    WHERE id = v_video.id;

    -- 调用迁移服务
    BEGIN
      SELECT net.http_post(
        url := v_edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'videoId', v_video.id,
          'forceRemigrate', true
        ),
        timeout_milliseconds := 300000  -- 5分钟
      ) INTO v_response_id;

      v_count := v_count + 1;
      PERFORM pg_sleep(0.5);
    EXCEPTION WHEN OTHERS THEN
      UPDATE videos
      SET migration_error = 'auto_retry失败: ' || SQLERRM
      WHERE id = v_video.id;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'retriedCount', v_count,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 1.3 创建定时调用的 Edge Function

```typescript
// supabase/functions/retry-failed-migrations/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SERVICE_ROLE_KEY') ?? ''
  )

  const { data, error } = await supabase.rpc('auto_retry_failed_migrations')

  if (error) {
    throw new Error(`Database function failed: ${error.message}`)
  }

  console.log('[RetryFailedMigrations] 完成:', data)

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

#### 1.4 配置 Cron 定时任务

在 `vercel.json` 或使用 Supabase Cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/retry-migrations",
      "schedule": "0 * * * *"  // 每小时执行一次
    }
  ]
}
```

---

### 方案2: 增强监控和告警

#### 2.1 创建监控视图

```sql
-- 迁移健康状况视图
CREATE OR REPLACE VIEW migration_health AS
SELECT
  COUNT(*) FILTER (WHERE migration_status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE migration_status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE migration_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE migration_status = 'downloading') as downloading_count,
  COUNT(*) FILTER (WHERE migration_status = 'uploading') as uploading_count,
  ROUND(
    COUNT(*) FILTER (WHERE migration_status = 'completed')::NUMERIC * 100 /
    NULLIF(COUNT(*), 0),
    2
  ) as success_rate_percent
FROM videos
WHERE status = 'completed' AND video_url NOT LIKE '%cdn.veo3video.me%';

-- 迁移失败原因统计
CREATE OR REPLACE VIEW migration_failures AS
SELECT
  migration_error,
  migration_attempts,
  COUNT(*) as failure_count,
  MAX(migration_last_attempt_at) as last_occurrence,
  array_agg(id ORDER BY migration_last_attempt_at DESC) as recent_video_ids
FROM videos
WHERE migration_status = 'failed'
GROUP BY migration_error, migration_attempts
ORDER BY failure_count DESC;
```

#### 2.2 创建监控函数

```sql
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS JSON AS $$
DECLARE
  v_migration_health RECORD;
  v_thumbnail_health RECORD;
BEGIN
  SELECT * INTO v_migration_health FROM migration_health;
  SELECT * INTO v_thumbnail_health FROM thumbnail_generation_health;

  RETURN json_build_object(
    'migration', row_to_json(v_migration_health),
    'thumbnail', row_to_json(v_thumbnail_health),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;
```

---

### 方案3: 优化超时设置

#### 修改迁移触发器

```sql
-- 根据文件大小动态调整超时
-- 假设平均下载速度 10MB/s
-- 100MB 视频 = 10秒下载 + 10秒上传 + 10秒余量 = 30秒
-- 500MB 视频 = 50秒 + 50秒 + 20秒 = 120秒
-- 固定使用 5分钟 = 300秒
timeout_milliseconds := 300000  -- 5分钟
```

---

## 📋 立即行动清单

### ✅ 已完成
1. ✅ 修复缩略图触发器（Migration 027）
2. ✅ 为7个视频触发缩略图生成
3. ✅ 修复Cloudflare源验证问题

### 🔄 待执行（短期）

1. **手动重试失败的迁移**（立即）
   ```sql
   SELECT batch_trigger_migration(20);
   ```

2. **验证缩略图生成结果**（5-10分钟后）
   ```bash
   node scripts/check-recent-videos-migration.js
   ```

3. **配置缩略图重试定时任务**（1小时内）
   - 设置Cron调用 `retry-stuck-thumbnails`
   - 频率：每小时一次

### 📝 待实施（长期）

1. **添加R2迁移自动重试机制**（1-2天）
   - 执行方案1的数据库迁移
   - 部署Edge Function
   - 配置Cron任务

2. **增强监控系统**（3-5天）
   - 实施方案2的监控视图
   - 配置告警规则
   - 创建Dashboard

3. **优化超时设置**（1天）
   - 修改迁移超时为5分钟
   - 测试大文件迁移

---

## 📊 预期改进效果

| 指标 | 当前 | 修复后 |
|------|------|--------|
| R2迁移成功率 | ~25% | ~90%+ |
| 缩略图生成成功率 | ~35% | ~95%+ |
| 迁移失败自动恢复 | 0% | 100% |
| 问题发现时间 | 依赖用户报告 | 自动监控 |
| 平均修复时间 | 数小时-数天 | 数分钟-1小时 |

---

## 🔧 可用的诊断和修复工具

### 诊断工具
```bash
# 列出失败视频
node scripts/list-failed-videos.js 30

# 检查最近视频状态
node scripts/check-recent-videos-migration.js

# 诊断特定视频
node scripts/diagnose-owl-thumbnail.js
```

### 修复工具
```sql
-- 批量重试迁移失败的视频（最多20个）
SELECT batch_trigger_migration(20);

-- 手动触发单个视频迁移
SELECT manually_trigger_migration('video-id-here');

-- 批量重试缩略图生成
SELECT auto_retry_stuck_thumbnails();

-- 手动触发失败迁移的缩略图
SELECT manually_trigger_thumbnails_for_failed_migrations();
```

### 监控查询
```sql
-- 查看系统健康状况
SELECT * FROM migration_health;
SELECT * FROM thumbnail_generation_health;

-- 查看失败原因
SELECT * FROM migration_failures;
SELECT * FROM thumbnail_generation_failures;

-- 查看需要处理的视频
SELECT id, title, migration_status, migration_attempts, migration_error
FROM videos
WHERE migration_status = 'failed'
ORDER BY created_at DESC;
```

---

**报告总结：**
- ✅ 缩略图触发器问题已修复
- ❌ R2迁移缺少自动重试（严重漏洞）
- ⚠️ 需要增强监控和告警
- 📝 提供了完整的解决方案和工具
