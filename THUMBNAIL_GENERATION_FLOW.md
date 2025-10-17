# 缩略图生成完整链路分析

**创建时间:** 2025-10-15
**版本:** v2 (修复后)

---

## 🎯 核心改进

### 修复前（旧逻辑）
```
视频完成 → R2迁移开始 → 等待迁移完成 → 生成缩略图
                          ↑
                    如果卡住，缩略图永远不生成 ❌
```

### 修复后（新逻辑）
```
视频完成 → ┌─ R2迁移（后台进行）
           └─ 缩略图生成（立即执行）✅

两个操作并行，互不影响！
```

---

## 📋 完整执行流程

### 1. 视频生成完成

```javascript
// 前端/后端调用 Google Veo3 API
const result = await generateVideo(prompt)

// 视频生成成功
await supabase
  .from('videos')
  .update({
    status: 'completed',
    video_url: 'https://heyoo.oss-ap-southeast-1.aliyuncs.com/xxx.mp4'
  })
  .eq('id', videoId)
```

**数据库状态：**
- `status: 'completed'` ✅
- `video_url: '阿里云OSS URL'` ✅
- `migration_status: NULL`
- `thumbnail_url: NULL`

---

### 2. 数据库触发器自动执行

#### 触发器A: R2迁移触发器

**文件：** `supabase/migrations/023_auto_migrate_to_r2_fixed.sql`

**触发时机：** `BEFORE UPDATE ON videos`

**触发条件：**
```sql
IF NEW.status = 'completed'
   AND (OLD.status IS NULL OR OLD.status != 'completed')
   AND NEW.video_url IS NOT NULL
   AND NEW.video_url NOT LIKE '%cdn.veo3video.me%'  -- 不在R2
THEN
```

**执行动作：**
```sql
-- 1. 更新迁移状态
NEW.migration_status := 'pending'

-- 2. 异步调用Edge Function
SELECT net.http_post(
  url := 'https://xxx.supabase.co/functions/v1/migrate-video',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || service_role_key
  ),
  body := jsonb_build_object(
    'videoId', NEW.id,
    'forceRemigrate', false
  ),
  timeout_milliseconds := 180000  -- 3分钟
) INTO response_id;
```

**结果：**
- `migration_status: 'pending'` ✅
- Edge Function在后台异步执行

---

#### 触发器B: 缩略图生成触发器 ⭐

**文件：** `supabase/migrations/030_fix_thumbnail_trigger_with_video_url.sql`

**触发时机：** `BEFORE UPDATE ON videos`

**触发条件（两个条件之一）：**

**条件1：视频完成时立即触发**（✅ 核心修改）
```sql
IF NEW.status = 'completed'
   AND (OLD.status IS NULL OR OLD.status != 'completed')
   AND NEW.video_url IS NOT NULL
   AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%')
THEN
```

**条件2：R2迁移完成时触发**（备用）
```sql
IF NEW.migration_status = 'completed'
   AND (OLD.migration_status IS NULL OR OLD.migration_status != 'completed')
   AND NEW.video_url IS NOT NULL
   AND (NEW.thumbnail_url IS NULL OR NEW.thumbnail_url LIKE 'data:image/svg%')
THEN
```

**执行动作：**
```sql
-- 1. 更新缩略图状态
NEW.thumbnail_generation_status := 'pending'

-- 2. 异步调用Edge Function
SELECT net.http_post(
  url := 'https://xxx.supabase.co/functions/v1/auto-generate-thumbnail',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || service_role_key
  ),
  body := jsonb_build_object(
    'videoId', NEW.id,
    'videoUrl', NEW.video_url  -- ⭐ 关键修复：传递videoUrl
  ),
  timeout_milliseconds := 60000  -- 1分钟
) INTO response_id;
```

**结果：**
- `thumbnail_generation_status: 'pending'` ✅
- Edge Function在后台异步执行

---

### 3. 并行执行（关键！）

两个Edge Function同时异步执行，互不影响：

#### 路径A: R2迁移（migrate-video）

**文件：** `supabase/functions/migrate-video/index.ts`

**执行流程：**

```javascript
// 1. 更新状态为下载中
await supabase
  .from('videos')
  .update({ migration_status: 'downloading' })
  .eq('id', videoId)

// 2. 从阿里云OSS下载视频
const response = await fetch(video_url)
const videoBuffer = await response.arrayBuffer()

// 3. 更新状态为上传中
await supabase
  .from('videos')
  .update({ migration_status: 'uploading' })
  .eq('id', videoId)

// 4. 上传到Cloudflare R2
const r2Client = new S3Client({...})
await r2Client.send(new PutObjectCommand({
  Bucket: 'ai-video-storage',
  Key: `videos/${videoId}.mp4`,
  Body: new Uint8Array(videoBuffer),
  ContentType: 'video/mp4'
}))

// 5. 更新数据库
const r2_url = `https://cdn.veo3video.me/videos/${videoId}.mp4`
await supabase
  .from('videos')
  .update({
    r2_url: r2_url,
    r2_key: `videos/${videoId}.mp4`,
    migration_status: 'completed',
    r2_uploaded_at: new Date().toISOString(),
    video_url: r2_url  // 切换到R2 URL
  })
  .eq('id', videoId)
```

**可能的结果：**
- ✅ 成功：`migration_status: 'completed'`
- ❌ 失败：`migration_status: 'failed'`
- ⏳ 超时：卡在 `pending/downloading/uploading`

---

#### 路径B: 缩略图生成（auto-generate-thumbnail）

**文件：** `supabase/functions/auto-generate-thumbnail/index.ts`

**执行流程：**

```javascript
// 1. 更新状态为处理中
await supabase
  .from('videos')
  .update({
    thumbnail_generation_status: 'processing',
    thumbnail_generation_last_attempt_at: new Date().toISOString()
  })
  .eq('id', videoId)

// 2. 使用Cloudflare Media Transformations生成缩略图
const transformUrl =
  `https://veo3video.me/cdn-cgi/media/` +
  `mode=frame,time=0.1s,format=jpg,` +
  `width=960,height=540,fit=cover,quality=95/` +
  `${videoUrl}`

// 3. 重试逻辑
const retryDelays = [0, 30000, 120000]  // 0秒、30秒、2分钟
for (let attempt = 0; attempt < retryDelays.length; attempt++) {
  try {
    const response = await fetch(transformUrl)
    const thumbnailBlob = await response.blob()
    break  // 成功
  } catch (error) {
    if (attempt === retryDelays.length - 1) {
      throw error  // 所有重试都失败
    }
    await sleep(retryDelays[attempt + 1])
  }
}

// 4. 上传缩略图到Cloudflare R2
const r2Client = new S3Client({...})
await r2Client.send(new PutObjectCommand({
  Bucket: 'ai-video-storage',
  Key: `thumbnails/${videoId}-v2.jpg`,
  Body: new Uint8Array(await thumbnailBlob.arrayBuffer()),
  ContentType: 'image/jpeg'
}))

// 5. 更新数据库
const thumbnailUrl = `https://cdn.veo3video.me/thumbnails/${videoId}-v2.jpg`
await supabase
  .from('videos')
  .update({
    thumbnail_url: thumbnailUrl,
    thumbnail_generated_at: new Date().toISOString(),
    thumbnail_generation_status: 'completed',
    thumbnail_metadata: {
      method: 'cloudflare_media_transformations',
      version: 2
    }
  })
  .eq('id', videoId)
```

**可能的结果：**
- ✅ 成功：`thumbnail_generation_status: 'completed'`
- ❌ 失败：`thumbnail_generation_status: 'failed'`

---

### 4. 自动重试机制

#### 机制1: Pending超时检测

**函数：** `fix_stuck_pending_migrations()`

**文件：** `supabase/migrations/029_fix_thumbnail_before_migration.sql`

**触发方式：**
- 手动调用：`SELECT fix_stuck_pending_migrations();`
- ⚠️ **应该配置pg_cron自动调用，但尚未配置！**

**执行逻辑：**
```sql
-- 查找卡住超过10分钟的视频
FOR v_video IN
  SELECT id, title, migration_status, updated_at
  FROM videos
  WHERE migration_status IN ('pending', 'downloading', 'uploading')
    AND status = 'completed'
    AND (NOW() - updated_at) > INTERVAL '10 minutes'
  LIMIT 50
LOOP
  -- 标记为失败，触发自动重试
  UPDATE videos
  SET
    migration_status = 'failed',
    migration_error = format('超时：卡在 %s 状态', migration_status),
    migration_attempts = COALESCE(migration_attempts, 0) + 1,
    migration_last_attempt_at = NOW()
  WHERE id = v_video.id;
END LOOP;
```

---

#### 机制2: R2迁移失败自动重试

**函数：** `auto_retry_failed_migrations()`

**文件：** `supabase/migrations/028_add_r2_migration_auto_retry.sql`

**触发方式：**
- 每5分钟由pg_cron自动调用 ✅
- Edge Function: `retry-failed-migrations`

**执行逻辑：**
```sql
-- 查找失败的视频
FOR v_video IN
  SELECT id, migration_attempts
  FROM videos
  WHERE migration_status = 'failed'
    AND COALESCE(migration_attempts, 0) < 3  -- 最多重试3次
LOOP
  -- 根据尝试次数计算等待时间
  required_wait_time := CASE
    WHEN migration_attempts = 1 THEN INTERVAL '2 minutes'
    WHEN migration_attempts = 2 THEN INTERVAL '5 minutes'
    WHEN migration_attempts >= 3 THEN INTERVAL '10 minutes'
    ELSE INTERVAL '2 minutes'
  END;

  -- 检查是否已等待足够时间
  IF migration_last_attempt_at + required_wait_time <= NOW() THEN
    -- 重新触发迁移
    UPDATE videos
    SET
      migration_status = 'pending',
      migration_attempts = migration_attempts + 1,
      migration_last_attempt_at = NOW()
    WHERE id = v_video.id;
  END IF;
END LOOP;
```

**重试策略：**
- 第1次失败 → 等待2分钟 → 重试
- 第2次失败 → 等待5分钟 → 重试
- 第3次失败 → 等待10分钟 → 重试
- 3次后 → 停止重试，标记为永久失败

---

## ⏱️ 完整时间线示例

### 成功场景
```
T+0s    用户提交视频生成请求
T+30s   视频生成完成
        └─ UPDATE videos SET status='completed', video_url='...'

T+0.1s  触发器A执行
        └─ migration_status='pending'
        └─ 调用 migrate-video Edge Function

T+0.2s  触发器B执行
        └─ thumbnail_generation_status='pending'
        └─ 调用 auto-generate-thumbnail Edge Function

        ┌─────────────────────────────────────────────────┐
        │  并行执行                                        │
        ├──────────────────────┬──────────────────────────┤
        │ R2迁移               │ 缩略图生成                │
        ├──────────────────────┼──────────────────────────┤
T+1s    │ downloading          │ processing               │
T+5s    │ 下载视频(20MB)...     │ Cloudflare API截图       │
T+10s   │ uploading            │ ✅ completed             │
T+15s   │ 上传到R2...          │ 用户看到缩略图！          │
T+20s   │ ✅ completed         │                          │
        └──────────────────────┴──────────────────────────┘

结果: 用户在10秒后就看到缩略图，不需要等待R2迁移完成！
```

### 失败恢复场景
```
T+0s    视频完成 → 触发器启动
T+1s    R2迁移: pending
        缩略图: ✅ completed (10秒后)

T+3m    R2迁移卡住在 pending 状态
T+10m   超时检测: pending → failed
T+12m   自动重试: failed → pending (第1次重试)
T+14m   R2迁移: ✅ completed

结果: 即使R2迁移失败，缩略图也能正常生成！
```

---

## 🔧 当前待配置项

### 1. Pending超时检测Cron（⚠️ 未配置）

**需要在Supabase SQL Editor执行：**

```sql
-- 创建定时任务：每5分钟检查一次超时的pending视频
SELECT cron.schedule(
  'fix-stuck-pending-migrations',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM system_config WHERE key = 'supabase_url') || '/functions/v1/fix-stuck-pending',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT value FROM system_config WHERE key = 'service_role_key')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
```

**或者直接调用函数：**
```sql
SELECT cron.schedule(
  'fix-stuck-pending-direct',
  '*/5 * * * *',
  $$ SELECT fix_stuck_pending_migrations(); $$
);
```

### 2. 验证现有Cron任务

**检查命令：**
```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
ORDER BY jobname;
```

**预期看到：**
- `retry-failed-migrations` (每5分钟) ✅
- `fix-stuck-pending-migrations` (每5分钟) ⚠️ 待配置

---

## 📊 监控命令

### 查看系统健康状况
```sql
SELECT * FROM migration_health;
```

### 查看卡住的视频
```sql
SELECT * FROM stuck_videos;
```

### 手动修复超时视频
```sql
SELECT fix_stuck_pending_migrations();
```

### 查看失败原因
```sql
SELECT * FROM migration_failures;
```

---

## ✅ 成功指标

### 缩略图生成
- **目标:** 视频完成后10秒内生成缩略图
- **成功率:** 应 > 95%
- **独立性:** 不受R2迁移状态影响

### R2迁移
- **初次成功率:** 应 > 70%
- **3次重试后成功率:** 应 > 90%
- **永久失败率:** 应 < 10%

---

## 🎉 总结

### 核心改进
1. ✅ 缩略图不再等待R2迁移
2. ✅ 两个操作并行执行
3. ✅ 修复了触发器参数传递
4. ✅ 添加了pending超时检测
5. ✅ 完善了自动重试机制

### 用户体验提升
- **修复前:** 等待R2迁移完成（可能几小时）才能看到缩略图
- **修复后:** 视频完成10秒内就能看到缩略图

### 系统稳定性提升
- **修复前:** R2迁移失败 → 缩略图永远不生成
- **修复后:** R2迁移失败不影响缩略图，且会自动重试
