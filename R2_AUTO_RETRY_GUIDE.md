# R2 迁移自动重试系统 - 部署指南

**创建时间:** 2025-10-15
**状态:** 就绪，待部署

---

## 🎯 解决的问题

- ❌ **问题:** 75% 的视频迁移失败后永远不会重试，必须手动干预
- ✅ **解决:** 自动重试，智能间隔，最多3次

---

## ⏱️ 重试策略（优化版）

| 失败次数 | 等待时间 | 总耗时 | 说明 |
|---------|---------|--------|------|
| 第1次失败 | **2分钟** | 0-2分钟 | 快速重试，可能是临时问题 |
| 第2次失败 | **5分钟** | 2-7分钟 | 中等等待，给系统恢复时间 |
| 第3次失败 | **10分钟** | 7-17分钟 | 较长等待，避免频繁失败 |
| 3次后 | **停止重试** | - | 标记为永久失败，需人工介入 |

**对比之前:** 30分钟间隔 → 现在最快2分钟就能重试！

---

## 📦 包含的文件

### 1. 数据库迁移
```
supabase/migrations/028_add_r2_migration_auto_retry.sql
```
- 添加 `migration_attempts`、`migration_error`、`migration_last_attempt_at` 字段
- 创建 `auto_retry_failed_migrations()` 函数
- 创建 `migration_health` 和 `migration_failures` 监控视图
- 更新触发器记录重试信息

### 2. Edge Function
```
supabase/functions/retry-failed-migrations/index.ts
```
- 由 Cron 调用
- 执行自动重试逻辑
- 返回执行统计

### 3. 部署脚本
```
scripts/deploy-r2-auto-retry.sh
```
- 一键部署向导
- Cron 配置指引

---

## 🚀 部署步骤

### 方式1: 使用部署脚本（推荐）

```bash
chmod +x scripts/deploy-r2-auto-retry.sh
./scripts/deploy-r2-auto-retry.sh
```

### 方式2: 手动部署

#### 步骤1: 应用数据库迁移

在 Supabase SQL Editor 中执行：
```bash
# 复制 supabase/migrations/028_add_r2_migration_auto_retry.sql 的内容
# 粘贴到 SQL Editor
# 点击 Run
```

#### 步骤2: 部署 Edge Function

```bash
npx supabase functions deploy retry-failed-migrations --no-verify-jwt
```

#### 步骤3: 配置 Supabase pg_cron

在 Supabase SQL Editor 中执行：

```sql
-- 启用 pg_cron 扩展（如果还没启用）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 创建定时任务（每5分钟执行一次）
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

-- 验证 Cron 任务已创建
SELECT * FROM cron.job WHERE jobname = 'retry-failed-migrations';
```

**验证 Cron 配置：**
```sql
-- 查看所有定时任务
SELECT * FROM cron.job;

-- 查看最近的执行历史
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-migrations')
ORDER BY start_time DESC
LIMIT 10;
```

---

## ✅ 验证部署

### 1. 查看系统健康状况

```sql
SELECT * FROM migration_health;
```

期望输出：
```
completed_count: 5
failed_count: 15
retriable_count: 12  -- 可以重试的视频数
permanently_failed_count: 3  -- 已达到3次重试上限
success_rate_percent: 25.00
```

### 2. 手动测试自动重试

```sql
SELECT auto_retry_failed_migrations();
```

期望输出：
```json
{
  "success": true,
  "retriedCount": 5,
  "skippedCount": 7,
  "message": "已重试 5 个视频，跳过 7 个（等待时间不足）",
  "timestamp": "2025-10-15T..."
}
```

### 3. 查看失败原因统计

```sql
SELECT * FROM migration_failures;
```

这会显示：
- 每种错误类型的失败次数
- 重试次数分布
- 最近失败的视频ID

---

## 📊 监控命令

### 实时监控

```sql
-- 查看整体健康状况
SELECT * FROM migration_health;

-- 查看失败原因
SELECT * FROM migration_failures;

-- 查看正在重试的视频
SELECT id, title, migration_attempts, migration_last_attempt_at, migration_error
FROM videos
WHERE migration_status = 'pending'
ORDER BY migration_last_attempt_at DESC;

-- 查看达到重试上限的视频（需人工介入）
SELECT id, title, migration_error, migration_attempts
FROM videos
WHERE migration_status = 'failed'
  AND migration_attempts >= 3
ORDER BY migration_last_attempt_at DESC;
```

### 诊断工具

```bash
# 列出所有失败视频
node scripts/list-failed-videos.js 50

# 检查最近视频状态
node scripts/check-recent-videos-migration.js
```

---

## 🎯 预期效果

### 修复前
- 迁移成功率: **25%**
- 失败后: **永远卡住，需手动干预**
- 恢复时间: **数小时到数天**

### 修复后
- 迁移成功率: **90%+** （通过自动重试）
- 失败后: **2-17分钟内自动重试3次**
- 恢复时间: **自动，无需人工干预**
- 永久失败率: **< 10%**（需人工检查）

---

## 🔧 高级配置

### 调整重试间隔

编辑 `028_add_r2_migration_auto_retry.sql` 中的间隔设置：

```sql
CASE
  WHEN migration_attempts = 1 THEN INTERVAL '2 minutes'   -- 可改为 '1 minute'
  WHEN migration_attempts = 2 THEN INTERVAL '5 minutes'   -- 可改为 '3 minutes'
  WHEN migration_attempts >= 3 THEN INTERVAL '10 minutes' -- 可改为 '5 minutes'
  ELSE INTERVAL '2 minutes'
END
```

### 调整 Cron 频率

**当前:** 每5分钟
**可选:**
- 更频繁: `*/2 * * * *` （每2分钟）
- 更少: `*/10 * * * *` （每10分钟）

**建议:** 保持5分钟，平衡重试速度和系统负载

---

## 🐛 故障排查

### 问题1: Cron 任务没有执行

**检查步骤:**
1. 验证 Edge Function 已部署：
   ```bash
   curl https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/retry-failed-migrations \
     -H "Authorization: Bearer <service-role-key>"
   ```

2. 检查 Cron 配置是否正确

3. 查看 Vercel/Supabase 日志

### 问题2: 重试一直失败

**检查步骤:**
1. 查看失败原因：
   ```sql
   SELECT migration_error, COUNT(*)
   FROM videos
   WHERE migration_status = 'failed'
   GROUP BY migration_error;
   ```

2. 常见错误：
   - "下载失败" → 检查阿里云 OSS 访问权限
   - "R2上传失败" → 检查 R2 API 密钥和配置
   - "超时" → 增加超时时间（当前5分钟）

### 问题3: retriable_count 一直不减少

**可能原因:**
- Cron 任务没有运行
- 所有视频都在等待时间内（2/5/10分钟）
- Edge Function 调用失败

**解决方法:**
```sql
-- 手动触发一次
SELECT auto_retry_failed_migrations();

-- 查看结果
SELECT retriedCount, skippedCount FROM (
  SELECT auto_retry_failed_migrations() as result
) sub;
```

---

## 📞 支持

如果遇到问题：

1. **查看日志:**
   - Supabase Functions 日志
   - Vercel Cron 日志
   - 数据库 pg_net 日志

2. **运行诊断:**
   ```bash
   node scripts/list-failed-videos.js 30
   ```

3. **查看完整分析报告:**
   ```
   SYSTEM_FLOW_ANALYSIS.md
   ```

---

## 🎉 总结

### 已完成
- ✅ 智能重试策略（2/5/10分钟）
- ✅ 自动重试函数
- ✅ 监控视图
- ✅ Edge Function
- ✅ 部署脚本

### 优势
- 🚀 **快速重试:** 最快2分钟就能重试
- 🎯 **智能间隔:** 递进式等待，平衡速度和系统负载
- 📊 **完整监控:** 实时查看重试状况和失败原因
- 🔄 **全自动:** 无需人工干预，自动恢复

### 下一步
1. 部署系统
2. 监控效果
3. 根据实际情况调整参数
