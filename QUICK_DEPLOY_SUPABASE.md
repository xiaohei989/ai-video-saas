# R2 迁移自动重试 - Supabase 快速部署

**3个步骤，10分钟搞定**

---

## 📋 部署清单

- [ ] 步骤1: 执行数据库迁移（2分钟）
- [ ] 步骤2: 部署 Edge Function（3分钟）
- [ ] 步骤3: 配置 pg_cron 定时任务（2分钟）

---

## 🚀 步骤1: 数据库迁移

### 1.1 打开 Supabase SQL Editor

登录 Supabase Dashboard → SQL Editor

### 1.2 复制并执行迁移SQL

复制文件内容：`supabase/migrations/028_add_r2_migration_auto_retry.sql`

粘贴到 SQL Editor，点击 **Run**

### 1.3 验证迁移成功

执行后应该看到类似输出：
```
✅ 迁移重试字段已创建
✅ R2迁移自动重试机制已部署！
...
- 迁移失败: 17 个
- 可重试: 12 个
```

---

## 🔧 步骤2: 部署 Edge Function

### 2.1 在终端执行

```bash
npx supabase functions deploy retry-failed-migrations --no-verify-jwt
```

### 2.2 验证部署

成功后会显示：
```
Deployed Function retry-failed-migrations on project <your-project>
```

### 2.3 测试 Edge Function

```bash
curl -X POST \
  https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/retry-failed-migrations \
  -H "Authorization: Bearer <your-service-role-key>"
```

应该返回：
```json
{
  "success": true,
  "data": {...}
}
```

---

## ⏰ 步骤3: 配置 pg_cron

### 3.1 在 Supabase SQL Editor 中执行

```sql
-- 1. 启用 pg_cron 扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. 创建定时任务（每5分钟执行一次）
SELECT cron.schedule(
  'retry-failed-migrations',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM system_config WHERE key = 'supabase_url') || '/functions/v1/retry-failed-migrations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT value FROM system_config WHERE key = 'service_role_key')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- 3. 验证 Cron 任务已创建
SELECT * FROM cron.job WHERE jobname = 'retry-failed-migrations';
```

### 3.2 确认输出

应该看到一条记录：
```
jobid | schedule      | command | nodename | ...
------|---------------|---------|----------|-----
  XX  | */5 * * * *  | ...     | ...      | ...
```

---

## ✅ 验证部署

### 查看系统健康

```sql
SELECT * FROM migration_health;
```

期望输出：
```
completed_count: 5
failed_count: 15
retriable_count: 12  -- 可以重试的视频
success_rate_percent: 25.00
```

### 手动测试重试

```sql
SELECT auto_retry_failed_migrations();
```

期望输出：
```json
{
  "success": true,
  "retriedCount": 5,
  "skippedCount": 7,
  "message": "已重试 5 个视频，跳过 7 个（等待时间不足）"
}
```

### 查看 Cron 执行历史

```sql
-- 等待5分钟后执行这个查询
SELECT
  run_id,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-migrations')
ORDER BY start_time DESC
LIMIT 10;
```

---

## 🎯 预期效果

### 部署后（等待5-20分钟）

```sql
-- 再次查看健康状况
SELECT * FROM migration_health;
```

应该看到：
- `retriable_count` 减少（正在重试）
- `completed_count` 增加（重试成功）
- `success_rate_percent` 提升

---

## 📊 监控命令

### 实时监控重试进度

```sql
-- 查看正在重试的视频
SELECT
  id,
  title,
  migration_status,
  migration_attempts,
  migration_last_attempt_at
FROM videos
WHERE migration_status IN ('pending', 'downloading', 'uploading')
ORDER BY migration_last_attempt_at DESC;
```

### 查看失败原因

```sql
SELECT * FROM migration_failures;
```

### 查看需要人工介入的视频

```sql
-- 已重试3次仍失败的视频
SELECT
  id,
  title,
  migration_error,
  migration_attempts,
  video_url
FROM videos
WHERE migration_status = 'failed'
  AND migration_attempts >= 3
ORDER BY migration_last_attempt_at DESC;
```

---

## 🐛 常见问题

### Q1: Cron 任务没有执行？

**检查1: 确认 pg_cron 已启用**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

**检查2: 查看 Cron 任务列表**
```sql
SELECT * FROM cron.job;
```

**检查3: 查看执行日志**
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Q2: Edge Function 调用失败？

**检查1: system_config 配置**
```sql
SELECT key, value FROM system_config
WHERE key IN ('supabase_url', 'service_role_key');
```

**检查2: 手动调用 Edge Function**
```bash
curl -X POST \
  https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/retry-failed-migrations \
  -H "Authorization: Bearer <service-role-key>"
```

### Q3: 重试一直失败？

**查看具体错误**
```sql
SELECT
  migration_error,
  COUNT(*) as count
FROM videos
WHERE migration_status = 'failed'
GROUP BY migration_error
ORDER BY count DESC;
```

**常见错误和解决方案：**
- `下载失败` → 检查阿里云 OSS 权限
- `R2上传失败` → 检查 R2 API 密钥
- `超时` → 增加超时时间或检查网络

---

## 🔧 高级配置

### 调整 Cron 频率

**更频繁（每2分钟）：**
```sql
SELECT cron.unschedule('retry-failed-migrations');
SELECT cron.schedule('retry-failed-migrations', '*/2 * * * *', $$...$$);
```

**更少（每10分钟）：**
```sql
SELECT cron.unschedule('retry-failed-migrations');
SELECT cron.schedule('retry-failed-migrations', '*/10 * * * *', $$...$$);
```

### 暂停/恢复 Cron

**暂停：**
```sql
SELECT cron.unschedule('retry-failed-migrations');
```

**恢复：**
```sql
-- 重新执行步骤3的 cron.schedule 命令
```

### 手动触发重试

不等待 Cron，立即重试：
```sql
SELECT auto_retry_failed_migrations();
```

---

## 📈 成功指标

### 1周后检查

```sql
SELECT
  completed_count,
  failed_count,
  success_rate_percent,
  retriable_count,
  permanently_failed_count
FROM migration_health;
```

**目标：**
- `success_rate_percent` > 90%
- `retriable_count` < 5
- `permanently_failed_count` < 3

---

## 🎉 完成！

系统已部署完成，现在会：
- ✅ 每5分钟自动检查失败的迁移
- ✅ 智能重试（2分钟 → 5分钟 → 10分钟）
- ✅ 最多重试3次
- ✅ 自动恢复，无需人工干预

**下一步：**
- 等待5-20分钟观察效果
- 使用监控命令跟踪进度
- 查看 `migration_health` 视图确认改善

---

**需要帮助？** 查看完整文档：`R2_AUTO_RETRY_GUIDE.md`
