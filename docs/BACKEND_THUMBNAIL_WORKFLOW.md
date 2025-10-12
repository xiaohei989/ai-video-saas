# 后端自动缩略图生成流程文档

## 📋 概述

当前系统采用**完全后端驱动**的自动缩略图生成方案，用户无需保持页面打开，视频完成后自动生成缩略图。

---

## 🔄 完整工作流程

### 1️⃣ 视频生成完成阶段

```
用户创建视频
    ↓
Veo3 API 处理视频
    ↓
视频状态更新: processing → completed
    ↓
[触发点] 数据库 UPDATE 事件
```

**关键文件**: `src/services/veo3Service.ts`

### 2️⃣ 数据库触发器阶段

```sql
-- 触发器配置
TRIGGER: on_video_completed_auto_thumbnail
事件: AFTER UPDATE ON videos
条件:
  ✓ NEW.status = 'completed'
  ✓ OLD.status != 'completed'  (状态刚变为 completed)
  ✓ NEW.video_url IS NOT NULL  (视频 URL 存在)
  ✓ NEW.thumbnail_url IS NULL OR 占位符  (尚无缩略图)
```

**触发器函数**: `trigger_auto_generate_thumbnail()`

**流程**:
```
1. 从 system_config 表读取配置
   - supabase_url
   - service_role_key
   - project_ref

2. 构造 Edge Function URL
   https://hvkzwrnvxsleeonqqrzq.supabase.co/functions/v1/auto-generate-thumbnail

3. 使用 pg_net.http_post 发送异步 HTTP 请求
   Headers:
     - Content-Type: application/json
     - Authorization: Bearer <service_role_key>
   Body:
     {
       "videoId": "uuid",
       "videoUrl": "https://cdn.veo3video.me/videos/xxx.mp4"
     }

4. 记录 response_id 到 thumbnail_metadata (可选)
```

**关键文件**:
- `supabase/migrations/021_auto_thumbnail_trigger.sql`
- `supabase/migrations/022_fix_auto_thumbnail_trigger.sql`

**特点**:
- ✅ **异步执行**: 不阻塞视频状态更新
- ✅ **错误容忍**: 触发器失败不影响视频记录
- ✅ **完全自动**: 无需前端参与

### 3️⃣ Edge Function 处理阶段

**Edge Function**: `auto-generate-thumbnail`

**入口文件**: `supabase/functions/auto-generate-thumbnail/index.ts`

**执行流程**:

```typescript
1. 接收请求并验证
   - videoId: string
   - videoUrl: string

2. 检查是否已有缩略图
   SELECT thumbnail_url FROM videos WHERE id = videoId
   如果已有 → 跳过生成，直接返回

3. 使用 Cloudflare Media Transformations 生成缩略图
   URL 格式:
   https://veo3video.me/cdn-cgi/media/mode=frame,time=0.1s,format=jpg,width=960,height=540,fit=cover,quality=95/<VIDEO_URL>

   参数说明:
   - mode=frame: 提取视频帧（而非播放视频）
   - time=0.1s: 提取 0.1 秒位置的帧
   - format=jpg: 输出 JPG 格式
   - width=960: 宽度 960px
   - height=540: 高度 540px (16:9 比例)
   - fit=cover: 覆盖整个区域（裁剪）
   - quality=95: 质量 95%（专业级）

4. 将 Blob 转换为 Base64
   blobToBase64(thumbnailBlob)

5. 上传高清缩略图到 Cloudflare R2
   调用 Edge Function: upload-thumbnail
   参数:
   - videoId: 视频 ID
   - base64Data: Base64 图片数据
   - contentType: 'image/jpeg'
   - version: 'v2'
   - directUpload: true

   返回: https://cdn.veo3video.me/thumbnails/<videoId>-v2.jpg

6. 生成模糊缩略图（可选，失败不影响主流程）
   调用 Edge Function: generate-blur-thumbnail
   参数:
   - videoId: 视频 ID
   - thumbnailUrl: 高清缩略图 URL
   - width: 48
   - quality: 30

   返回: https://cdn.veo3video.me/thumbnails/<videoId>-blur.webp

7. 更新数据库
   UPDATE videos SET
     thumbnail_url = '<fullUrl>',
     thumbnail_blur_url = '<blurUrl>',  -- 如果生成成功
     thumbnail_generated_at = NOW(),
     thumbnail_metadata = {
       "method": "cloudflare_media_transformations",
       "timestamp": "...",
       "generatedBy": "auto-generate-thumbnail"
     }
   WHERE id = videoId

8. 返回成功响应
```

**关键依赖**:
- `upload-thumbnail` Edge Function: 上传图片到 R2
- `generate-blur-thumbnail` Edge Function: 生成模糊缩略图

---

## 🛠️ 技术栈

| 组件 | 技术 | 用途 | 费用 |
|------|------|------|------|
| 数据库触发器 | PostgreSQL + pg_net | 监听视频状态变化，发送 HTTP 请求 | 免费 |
| Edge Function | Deno Runtime | 处理缩略图生成逻辑 | 免费额度内 |
| 缩略图生成 | Cloudflare Media Transformations | 从视频提取帧 | 免费（至2025年11月，之后5000次/月免费） |
| 存储 | Cloudflare R2 | 存储缩略图 | 免费配额 10GB |
| CDN | Cloudflare CDN | 分发缩略图 | 免费 |

---

## 📊 配置管理

### 系统配置表 (system_config)

```sql
SELECT * FROM system_config WHERE key IN (
  'supabase_url',
  'service_role_key',
  'project_ref'
);
```

| key | value | description |
|-----|-------|-------------|
| supabase_url | https://hvkzwrnvxsleeonqqrzq.supabase.co | Supabase 项目 URL |
| service_role_key | eyJhbGci... | Service Role JWT (用于 Edge Function 认证) |
| project_ref | hvkzwrnvxsleeonqqrzq | 项目引用 ID |

**更新配置**:
```sql
UPDATE system_config
SET value = '<new_value>'
WHERE key = 'service_role_key';
```

### 环境变量配置

**前端配置** (`.env`, `.env.local`, `.env.production`):
```bash
# 禁用前端缩略图生成，完全依赖后端
VITE_ENABLE_FRONTEND_THUMBNAIL=false
```

**Cloudflare Pages 环境变量**:
```bash
VITE_ENABLE_FRONTEND_THUMBNAIL=false
```

**wrangler.toml**:
```toml
[env.production.vars]
VITE_ENABLE_FRONTEND_THUMBNAIL = "false"
```

---

## 🧪 测试和调试

### 1. 测试 pg_net 连接

```sql
-- 测试 pg_net 是否正常工作
SELECT test_pgnet_connection();
```

### 2. 查看 pg_net HTTP 响应

```sql
-- 查看最近的 HTTP 请求响应
SELECT * FROM pg_net_recent_responses LIMIT 10;
```

**响应字段**:
- `status_code`: HTTP 状态码 (200 = 成功, 401 = 认证失败, 500 = 服务器错误)
- `error_msg`: 错误信息
- `timed_out`: 是否超时
- `content_preview`: 响应内容预览

### 3. 手动触发单个视频

```sql
-- 手动触发指定视频的缩略图生成
SELECT manually_trigger_thumbnail_generation('video-uuid-here');
```

### 4. 批量触发历史视频

```sql
-- 批量处理最近 50 个没有缩略图的视频
SELECT batch_trigger_thumbnail_generation(50);
```

### 5. 查看待处理视频

```sql
-- 查看所有需要生成缩略图的视频
SELECT * FROM videos_pending_auto_thumbnails LIMIT 20;
```

### 6. 使用 Node.js 测试脚本

```bash
# 测试完整的后端自动触发流程
node test-backend-auto-trigger.js

# 测试配置是否正确
node test-frontend-thumbnail-config.js

# 修复 service_role_key 并测试
node fix-and-test-trigger.js
```

---

## 🔍 故障排查

### 问题 1: 缩略图未自动生成

**检查步骤**:

1. **确认触发器已启用**
```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_video_completed_auto_thumbnail';
```

2. **检查视频状态**
```sql
SELECT id, status, video_url, thumbnail_url, thumbnail_generated_at
FROM videos
WHERE id = 'video-uuid'
ORDER BY created_at DESC;
```

3. **查看 pg_net 响应**
```sql
SELECT * FROM pg_net_recent_responses
WHERE created > NOW() - INTERVAL '1 hour'
ORDER BY created DESC;
```

**常见错误**:
- **401 Invalid JWT**: `service_role_key` 配置错误
- **500 Internal Server Error**: Edge Function 执行失败
- **超时**: 视频文件太大或网络问题

### 问题 2: service_role_key 认证失败 (401)

**解决方案**:
```bash
# 运行修复脚本
node fix-and-test-trigger.js
```

或手动更新:
```sql
UPDATE system_config
SET value = 'eyJhbGci...'
WHERE key = 'service_role_key';
```

### 问题 3: Cloudflare Media Transformations 失败

**检查**:
1. 访问 Cloudflare Dashboard → Images → Transformations
2. 确认 Transformations 已启用
3. 确认 `cdn.veo3video.me` 在 Allowed origins 列表中

### 问题 4: 前端仍在生成缩略图

**确认环境变量**:
```bash
# 检查 .env 文件
grep VITE_ENABLE_FRONTEND_THUMBNAIL .env

# 应该显示:
VITE_ENABLE_FRONTEND_THUMBNAIL=false
```

**重新构建项目**:
```bash
npm run build:cloudflare:production
```

---

## 📈 监控和日志

### Edge Function 日志

```bash
# 查看 auto-generate-thumbnail 日志
npx supabase functions logs auto-generate-thumbnail --limit 50
```

### 数据库日志

PostgreSQL 日志会记录所有触发器活动:
```
[AutoThumbnail Trigger] 视频完成，触发缩略图生成: videoId=xxx, url=xxx
[AutoThumbnail Trigger] HTTP 请求已发送: response_id=123
```

### 成功率统计

```sql
-- 统计缩略图生成成功率
SELECT
  COUNT(*) as total_videos,
  COUNT(thumbnail_url) FILTER (WHERE thumbnail_url NOT LIKE 'data:image/svg%') as with_thumbnail,
  ROUND(100.0 * COUNT(thumbnail_url) FILTER (WHERE thumbnail_url NOT LIKE 'data:image/svg%') / COUNT(*), 2) as success_rate
FROM videos
WHERE status = 'completed' AND created_at > NOW() - INTERVAL '7 days';
```

---

## ✅ 优势总结

### 相比前端生成的优势

| 特性 | 后端生成 | 前端生成 |
|------|----------|----------|
| 用户体验 | ✅ 用户可立即关闭页面 | ❌ 需等待或保持页面打开 |
| 浏览器负担 | ✅ 无负担 | ❌ 需要处理视频（CPU/内存） |
| 可靠性 | ✅ 服务器保证执行 | ❌ 依赖用户网络和设备 |
| CORS 问题 | ✅ 无 CORS 限制 | ❌ 可能遇到 CORS 错误 |
| 成本 | ✅ 完全免费 | ✅ 完全免费 |
| 统一性 | ✅ 一致的图片质量 | ⚠️ 可能因设备而异 |
| 批量处理 | ✅ 可批量处理历史视频 | ❌ 只能逐个处理 |

---

## 📝 维护建议

1. **定期检查 pg_net 响应**
   ```bash
   # 每周运行一次
   node test-pgnet.js
   ```

2. **监控 Cloudflare Media Transformations 配额**
   - 当前免费（至2025年11月）
   - 之后每月 5000 次免费
   - 超出需付费

3. **定期更新 service_role_key**（如果密钥轮换）
   ```bash
   node fix-and-test-trigger.js
   ```

4. **批量处理历史视频**（如果有遗漏）
   ```sql
   SELECT batch_trigger_thumbnail_generation(100);
   ```

---

## 🔗 相关文件

### 数据库迁移
- `supabase/migrations/021_auto_thumbnail_trigger.sql` - 初始触发器
- `supabase/migrations/022_fix_auto_thumbnail_trigger.sql` - 改进版触发器

### Edge Functions
- `supabase/functions/auto-generate-thumbnail/index.ts` - 主要生成逻辑
- `supabase/functions/upload-thumbnail/index.ts` - R2 上传
- `supabase/functions/generate-blur-thumbnail/index.ts` - 模糊图生成

### 测试脚本
- `test-backend-auto-trigger.js` - 完整流程测试
- `fix-and-test-trigger.js` - 修复配置并测试
- `test-pgnet.js` - pg_net 功能测试
- `test-frontend-thumbnail-config.js` - 前端配置测试

### 前端代码
- `src/services/supabaseVideoService.ts` - 前端缩略图生成逻辑（已禁用）
- `src/utils/videoThumbnail.ts` - 前端缩略图工具（已禁用）

---

**文档版本**: v1.0
**最后更新**: 2025-10-07
**维护者**: AI Development Team
