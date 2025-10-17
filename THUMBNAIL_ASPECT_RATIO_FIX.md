# 缩略图 AspectRatio 修复总结

## 📋 问题诊断

### 发现的问题

1. **前端生成未传递 aspectRatio** ❌
   - [supabaseVideoService.ts:1151](src/services/supabaseVideoService.ts#L1151) - `autoGenerateThumbnailOnComplete()`
   - [supabaseVideoService.ts:1235](src/services/supabaseVideoService.ts#L1235) - `regenerateThumbnail()`
   - [thumbnailRepairService.ts:56](src/services/thumbnailRepairService.ts#L56) - `repairThumbnail()`
   - **影响**: 所有视频都使用默认 16:9 (960x540)，9:16 视频缩略图变形

2. **后端 Edge Function 硬编码尺寸** ❌
   - [auto-generate-thumbnail/index.ts:90-91](supabase/functions/auto-generate-thumbnail/index.ts#L90-L91)
   - 固定使用 `width=960, height=540`
   - **影响**: 数据库触发器生成的缩略图忽略视频实际宽高比

3. **数据库触发器未传递 aspectRatio** ❌
   - [030_fix_thumbnail_trigger_with_video_url.sql](supabase/migrations/030_fix_thumbnail_trigger_with_video_url.sql)
   - 只传递 `videoId` 和 `videoUrl`
   - **影响**: 后端无法获取视频宽高比信息

4. **缺少 CORS 诊断信息** ⚠️
   - 视频加载失败时没有详细的错误日志
   - 难以判断是 CORS 问题还是其他网络问题

## ✅ 修复内容

### 1. 前端修复

#### 文件: `src/services/supabaseVideoService.ts`

**autoGenerateThumbnailOnComplete() (第1147-1155行)**
```typescript
// ✅ 修复前
const fullUrl = await extractAndUploadThumbnail(video.video_url, video.id)

// ✅ 修复后
const aspectRatio = (video.parameters?.aspectRatio || '16:9') as '16:9' | '9:16'
console.log(`[Thumbnail] 生成缩略图 - 视频ID: ${video.id}, aspectRatio: ${aspectRatio}`)
const fullUrl = await extractAndUploadThumbnail(video.video_url, video.id, { aspectRatio })
```

**regenerateThumbnail() (第1233-1243行)**
```typescript
// ✅ 修复前
const fullUrl = await extractAndUploadThumbnail(v.video_url, v.id, { frameTime })

// ✅ 修复后
const aspectRatio = (v.parameters?.aspectRatio || '16:9') as '16:9' | '9:16'
console.log(`[RegenerateThumbnail] 重新生成缩略图 - 视频ID: ${v.id}, aspectRatio: ${aspectRatio}, frameTime: ${frameTime}`)
const fullUrl = await extractAndUploadThumbnail(v.video_url, v.id, { frameTime, aspectRatio })
```

#### 文件: `src/services/thumbnailRepairService.ts`

**repairThumbnail() (第35-65行)**
```typescript
// ✅ 新增：从数据库查询 parameters 字段
const { data: video, error: queryError } = await supabase
  .from('videos')
  .select('id, title, video_url, status, parameters')  // ✅ 新增 parameters
  .eq('id', videoId)
  .single()

// ✅ 新增：提取 aspectRatio
const aspectRatio = ((video.parameters as any)?.aspectRatio || '16:9') as '16:9' | '9:16'
console.log(`[ThumbnailRepair] 检测到视频 aspectRatio: ${aspectRatio}`)

// ✅ 修复：传递 aspectRatio 参数
const thumbnailUrl = await extractAndUploadThumbnail(video.video_url, videoId, {
  frameTime: frameTime,
  quality: 0.9,
  format: 'webp',
  aspectRatio  // ✅ 新增
})
```

### 2. 后端修复

#### 文件: `supabase/functions/auto-generate-thumbnail/index.ts`

**接口定义 (第19-25行)**
```typescript
interface AutoGenerateRequest {
  videoId: string
  videoUrl: string
  aspectRatio?: '16:9' | '9:16'  // ✅ 新增
  migrationCompletedAt?: string
  timeSinceMigration?: number
}
```

**attemptThumbnailGeneration() (第87-104行)**
```typescript
// ✅ 修复前：硬编码尺寸
const options = [
  'mode=frame',
  'time=0.1s',
  'format=jpg',
  'width=960',   // ❌ 固定值
  'height=540',  // ❌ 固定值
  'fit=cover',
  'quality=95'
].join(',')

// ✅ 修复后：动态尺寸
async function attemptThumbnailGeneration(videoUrl: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<Blob> {
  const baseUrl = 'https://veo3video.me'

  // 🎯 根据宽高比动态设置分辨率
  const [width, height] = aspectRatio === '9:16' ? [540, 960] : [960, 540]
  console.log(`[ThumbnailGeneration] aspectRatio: ${aspectRatio}, dimensions: ${width}x${height}`)

  const options = [
    'mode=frame',
    'time=0.1s',
    'format=jpg',
    `width=${width}`,   // ✅ 动态宽度
    `height=${height}`,  // ✅ 动态高度
    'fit=cover',
    'quality=95'
  ].join(',')
  // ...
}
```

**generateWithCloudflareMedia() (第132-151行)**
```typescript
// ✅ 修复：传递 aspectRatio 参数
async function generateWithCloudflareMedia(videoUrl: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<Blob> {
  console.log('[AutoThumbnail] 使用 Cloudflare Media Transformations 生成缩略图')
  console.log(`[AutoThumbnail] 视频 URL: ${videoUrl}`)
  console.log(`[AutoThumbnail] 宽高比: ${aspectRatio}`)  // ✅ 新增日志

  // ...
  const blob = await attemptThumbnailGeneration(videoUrl, aspectRatio)  // ✅ 传递参数
  // ...
}
```

**主处理函数 (第181-244行)**
```typescript
// ✅ 读取 aspectRatio 参数
const { videoUrl, aspectRatio = '16:9', timeSinceMigration } = requestData
console.log(`[AutoThumbnail] 宽高比: ${aspectRatio}`)  // ✅ 新增日志

// ✅ 传递给生成函数
thumbnailBlob = await generateWithCloudflareMedia(videoUrl, aspectRatio)
```

### 3. 数据库触发器修复

#### 文件: `supabase/migrations/031_fix_thumbnail_trigger_with_aspect_ratio.sql`

```sql
-- ✅ 从 parameters 中提取 aspectRatio
v_aspect_ratio := COALESCE(NEW.parameters->>'aspectRatio', '16:9');
RAISE LOG '[AutoThumbnail] 提取 aspectRatio: %', v_aspect_ratio;

-- ✅ 传递给 Edge Function
SELECT net.http_post(
  url := edge_function_url,
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_service_role_key
  ),
  body := jsonb_build_object(
    'videoId', NEW.id,
    'videoUrl', NEW.video_url,
    'aspectRatio', v_aspect_ratio  -- ✅ 新增
  ),
  timeout_milliseconds := 60000
) INTO response_id;
```

### 4. CORS 诊断增强

#### 文件: `src/utils/videoThumbnail.ts`

**extractAndUploadThumbnail() (第119-140行)**
```typescript
// 🔍 增强错误处理 - 添加详细的CORS诊断信息
video.addEventListener('error', (e) => {
  const errorDetails = {
    videoId,
    videoUrl,
    aspectRatio: config.aspectRatio || '16:9',
    error: e,
    videoSrc: video.src,
    crossOrigin: video.crossOrigin,
    networkState: video.networkState,  // 3 = NETWORK_NO_SOURCE (CORS错误)
    readyState: video.readyState,
    currentTime: video.currentTime
  }
  console.error(`[ThumbnailUpload] 视频加载失败 - CORS诊断:`, errorDetails)

  // 检查是否是CORS错误
  if (video.networkState === 3) {
    console.error(`[ThumbnailUpload] ❌ 可能的CORS错误 - 检查R2 Bucket CORS配置`)
  }

  reject(new Error(`Failed to load video: ${JSON.stringify(errorDetails)}`))
})
```

**extractVideoThumbnail() (第402-414行)**
```typescript
// 🔍 增强错误处理
video.addEventListener('error', async (e) => {
  const errorDetails = {
    videoUrl,
    error: e,
    videoSrc: video.src,
    crossOrigin: video.crossOrigin,
    networkState: video.networkState,
    readyState: video.readyState,
    errorCode: (video.error as any)?.code,
    errorMessage: (video.error as any)?.message
  }
  console.error(`[VIDEO THUMBNAIL] 视频加载失败 - CORS诊断:`, errorDetails)
  // ...
})
```

## 🧪 测试方法

### 执行数据库迁移

```bash
cd /Users/chishengyang/Desktop/AI_ASMR/ai-video-saas
npx supabase db push
```

或手动执行:
```bash
PGPASSWORD="huixiangyigou2025!" psql \
  -h aws-1-us-west-1.pooler.supabase.com \
  -p 6543 \
  -d postgres \
  -U postgres.hvkzwrnvxsleeonqqrzq \
  -f supabase/migrations/031_fix_thumbnail_trigger_with_aspect_ratio.sql
```

### 运行测试脚本

```bash
npx tsx test-thumbnail-aspect-ratio-fix.ts
```

### 前端手动测试

1. 打开浏览器控制台
2. 导入服务:
```javascript
import { supabaseVideoService } from '@/services/supabaseVideoService'
```

3. 测试重新生成缩略图 (替换为实际的 9:16 视频ID):
```javascript
const result = await supabaseVideoService.regenerateThumbnail('your-video-id-here')
console.log('结果:', result)
```

4. 检查控制台日志:
```
[RegenerateThumbnail] 重新生成缩略图 - 视频ID: xxx, aspectRatio: 9:16, frameTime: 1.5
[ThumbnailUpload] 开始提取和上传缩略图: xxx
[ThumbnailUpload] 配置: { width: 540, height: 960, quality: 0.95, ... }
```

### 后端自动测试

1. 创建一个新的 9:16 视频
2. 观察 Edge Function 日志:
```bash
supabase functions logs auto-generate-thumbnail --tail
```

3. 检查日志输出:
```
[AutoThumbnail] 宽高比: 9:16
[ThumbnailGeneration] aspectRatio: 9:16, dimensions: 540x960
```

### 验证缩略图尺寸

1. 下载生成的缩略图
2. 检查实际尺寸:
   - **16:9 视频**: 960×540 像素
   - **9:16 视频**: 540×960 像素

### CORS 错误诊断

如果缩略图生成失败，检查控制台:
```
[ThumbnailUpload] 视频加载失败 - CORS诊断: {
  videoId: "...",
  networkState: 3,  // ← 如果是 3，说明是 CORS 问题
  crossOrigin: "anonymous",
  ...
}
```

如果 `networkState === 3`，需要检查 R2 Bucket CORS 配置:
```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["Content-Length", "Content-Type"]
}
```

## 📊 预期效果

### 修复前
- ❌ 所有缩略图都是 960×540 (16:9)
- ❌ 9:16 视频缩略图被拉伸变形
- ❌ 无法诊断 CORS 错误原因

### 修复后
- ✅ 16:9 视频生成 960×540 缩略图
- ✅ 9:16 视频生成 540×960 缩略图
- ✅ 详细的 CORS 错误诊断日志
- ✅ 前端和后端都正确处理宽高比

## 🔍 关键日志验证点

### 前端日志
```
[Thumbnail] 生成缩略图 - 视频ID: xxx, aspectRatio: 9:16
[ThumbnailUpload] 配置: { width: 540, height: 960, ... }
[ThumbnailUpload] R2上传成功: xxx -> https://...
```

### 后端日志
```
[AutoThumbnail] 宽高比: 9:16
[ThumbnailGeneration] aspectRatio: 9:16, dimensions: 540x960
[AutoThumbnail] ✅ 缩略图生成成功，大小: 45.23 KB
```

### 数据库日志
```
[AutoThumbnail] 提取 aspectRatio: 9:16
[AutoThumbnail] 缩略图生成请求已排队: response_id=123, aspectRatio=9:16
```

## 📁 修改文件清单

1. ✅ `src/services/supabaseVideoService.ts` - 前端缩略图生成服务
2. ✅ `src/services/thumbnailRepairService.ts` - 缩略图修复服务
3. ✅ `supabase/functions/auto-generate-thumbnail/index.ts` - 后端 Edge Function
4. ✅ `supabase/migrations/031_fix_thumbnail_trigger_with_aspect_ratio.sql` - 数据库触发器
5. ✅ `src/utils/videoThumbnail.ts` - 缩略图工具函数 (CORS诊断)
6. ✅ `test-thumbnail-aspect-ratio-fix.ts` - 测试脚本

## 🚀 部署步骤

1. **提交代码**
```bash
git add .
git commit -m "修复缩略图 aspectRatio 支持和 CORS 诊断

主要更新:
- 前端生成缩略图时传递 aspectRatio 参数
- 后端 Edge Function 支持动态宽高比
- 数据库触发器传递 aspectRatio 给 Edge Function
- 增强 CORS 错误诊断日志
- 16:9 视频生成 960x540 缩略图
- 9:16 视频生成 540x960 缩略图

🤖 Generated with Claude Code"
```

2. **执行数据库迁移**
```bash
npx supabase db push
```

3. **部署 Edge Function**
```bash
npx supabase functions deploy auto-generate-thumbnail
```

4. **验证部署**
```bash
# 运行测试脚本
npx tsx test-thumbnail-aspect-ratio-fix.ts

# 创建测试视频验证
# 观察日志确认 aspectRatio 正确传递
```

---

✅ 修复完成！现在缩略图生成系统完全支持 16:9 和 9:16 两种宽高比。
