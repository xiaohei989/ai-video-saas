# 🔧 视频生成超时误判问题修复总结

## 📋 问题描述

### 用户报告的问题
在手机上测试生成新的视频流程时，出现以下情况：
1. 点击生成后把浏览器退到后台
2. 等几分钟再打开 App，任务提示"生成视频超时" ❌
3. 刷新"我的视频"页面，视频显示正常且可以播放 ✅

### 问题现象
- 视频实际已成功生成
- 但超时检测错误地将其标记为失败
- 明显是超时判断逻辑出错

---

## 🔍 根本原因分析

### 问题1：时间基准点选择错误（主要问题）

#### 错误代码
```typescript
// VideoPollingService.ts:254 (修复前)
const elapsedTime = Date.now() - currentTask.startedAt.getTime()

// VideoTaskManager.ts:344 (修复前)
const startedAt = video.processing_started_at
  ? new Date(video.processing_started_at)    // ✅ 正确
  : new Date(video.created_at)               // ❌ 错误 fallback
```

#### 问题根源
超时计算使用了错误的时间基准点：
- **应该使用**：`processing_started_at`（实际处理开始时间）
- **实际使用**：当 `processing_started_at` 为 NULL 时，fallback 到 `created_at`（视频创建时间）
- **后果**：队列等待时间被错误地计入超时时间

#### 场景示例
```
T0 = 14:00 - 创建视频 (created_at = 14:00, status = 'pending')
T1 = 14:01 - 队列轮到它，开始处理 (processing_started_at = 14:01, status = 'processing')
T15 = 14:15 - 视频生成完成（实际处理 14 分钟）

❌ 错误计算（使用 created_at）：
   elapsed = 14:15 - 14:00 = 15 分钟
   TIMEOUT_FORCE_FAIL = 15 分钟
   判定：超时！

✅ 正确计算（使用 processing_started_at）：
   elapsed = 14:15 - 14:01 = 14 分钟
   未达到 15 分钟阈值
   判定：正常
```

---

### 问题2：移动端后台挂起导致数据同步滞后

#### 移动端特殊行为
1. 用户点击生成后退到后台
2. 移动端浏览器暂停 JavaScript 执行
3. `setTimeout` 停止工作，轮询服务暂停
4. `processing_started_at` 的设置可能延迟或丢失

#### 时间计算的实际情况
- `Date.now()` **不受影响**（永远返回真实系统时间）
- 但数据库状态更新可能滞后
- 前端可能读取到过期的任务状态

---

### 问题3：超时检测缺少数据验证

#### 缺少的检查
```typescript
// 修复前：直接使用 currentTask.startedAt，没有验证来源
const elapsedTime = Date.now() - currentTask.startedAt.getTime()
if (elapsedTime > TIMEOUT_FORCE_FAIL) {
  // 标记失败
}
```

#### 应该添加的检查
- 验证 `processing_started_at` 是否存在
- 如果不存在，使用更宽松的超时阈值（30分钟 vs 15分钟）
- 记录时间来源，便于调试

---

## ✅ 修复方案

### 修复1：确保 `processing_started_at` 正确设置

#### 文件：`src/services/supabaseVideoService.ts`

**createVideo 方法**：
```typescript
// ✅ 修复：如果创建时状态就是 processing，立即设置开始时间
if (data.status === 'processing') {
  insertData.processing_started_at = now
  console.log('[CREATE VIDEO] ✅ 状态为processing，立即设置processing_started_at:', now)
}
```

**updateVideo 方法**：
```typescript
// ✅ 修复：检查数据库中是否已有 processing_started_at
if (updates.status === 'processing') {
  if (!updates.processing_started_at) {
    const { data: currentVideo } = await supabase
      .from('videos')
      .select('processing_started_at')
      .eq('id', id)
      .single()

    // 只有数据库中也没有时，才设置新的开始时间
    if (!currentVideo?.processing_started_at) {
      updateData.processing_started_at = now
      console.log('[UPDATE VIDEO] ✅ 设置processing_started_at:', now)
    }
  }
}
```

---

### 修复2：改进超时检测逻辑

#### 文件：`src/services/VideoPollingService.ts`

**主要改进**：
1. 重新从数据库获取最新的 `processing_started_at`
2. 根据时间来源使用不同的超时阈值
3. 添加详细日志记录

```typescript
// ✅ 修复：验证时间基准点是否有效
const latestVideo = await supabaseVideoService.getVideo(taskId)

// 确定正确的时间基准点
let timeBase: Date | null = null
let timeSource: string = 'unknown'

if (latestVideo.processing_started_at) {
  timeBase = new Date(latestVideo.processing_started_at)
  timeSource = 'processing_started_at'
} else {
  timeBase = new Date(latestVideo.created_at)
  timeSource = 'created_at(fallback)'
  console.warn(`[POLLING] ⚠️ 缺少 processing_started_at，使用 created_at`)
}

// ✅ 修复：根据时间来源使用不同的超时阈值
const TIMEOUT_THRESHOLD = timeSource === 'processing_started_at'
  ? TIMEOUT_FORCE_FAIL    // 15分钟（有准确开始时间）
  : 30 * 60 * 1000         // 30分钟（fallback时更宽松）

const elapsedTime = Date.now() - timeBase.getTime()

// 超时检测
if (elapsedTime > TIMEOUT_THRESHOLD) {
  const thresholdMinutes = Math.round(TIMEOUT_THRESHOLD / (1000 * 60))
  console.log(`[POLLING] ⏰ 任务运行超过${thresholdMinutes}分钟（时间基准: ${timeSource}）`)

  // 检查视频URL是否已存在
  if (latestVideo?.video_url) {
    // 标记为完成，而非失败
  } else {
    // 真正超时，标记失败
  }
}
```

---

### 修复3：移动端后台恢复时强制同步

#### 文件：`src/hooks/useVideoTasks.ts`

**添加页面可见性监听**：
```typescript
// ✅ 修复：监听页面可见性变化，移动端后台恢复时强制同步任务状态
useEffect(() => {
  if (!enablePolling || !user?.id) return

  const handleVisibilityChange = async () => {
    // 只在页面从隐藏变为可见时处理
    if (!document.hidden && activeTasks.size > 0) {
      console.log('[useVideoTasks] 📱 页面从后台恢复，强制同步任务状态')

      // 强制重新从数据库加载任务状态
      await refreshTasks()

      // 重启轮询服务（带强制同步标志）
      videoPollingService.start({
        userId: user.id,
        onTaskUpdate: handleTaskUpdate,
        onTaskComplete: handleTaskComplete,
        onTaskFailed: handleTaskFailed
      }, true) // forceSync = true
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [enablePolling, user?.id, activeTasks.size, refreshTasks, ...])
```

---

### 修复4：优化 videoToTask 转换逻辑

#### 文件：`src/services/VideoTaskManager.ts` 和 `VideoPollingService.ts`

**改进时间基准点选择**：
```typescript
// ✅ 修复：优先使用 processing_started_at，添加日志记录
let startedAt: Date
let timeSource: string

if (video.processing_started_at) {
  startedAt = new Date(video.processing_started_at)
  timeSource = 'processing_started_at'
} else {
  startedAt = new Date(video.created_at)
  timeSource = 'created_at(fallback)'
  console.warn(`[POLLING] ⚠️ 缺少 processing_started_at: ${video.id}`)
}
```

---

## 🎯 修复效果

### 修复前
- ❌ 队列等待时间被计入超时
- ❌ 移动端后台恢复后容易误判超时
- ❌ 15分钟超时阈值过于严格
- ❌ 实际已完成的视频被标记为失败

### 修复后
- ✅ 超时只计算实际处理时间（从 `processing_started_at` 开始）
- ✅ 队列等待时间不计入超时
- ✅ 缺少 `processing_started_at` 时使用 30 分钟宽松阈值
- ✅ 移动端后台恢复时自动强制同步状态
- ✅ 超时前检查视频 URL 是否存在，避免误判
- ✅ 详细日志记录，便于问题追踪

---

## 🔍 调试建议

### 日志关键词
当遇到超时问题时，在浏览器控制台搜索以下关键词：

```
[POLLING] ⏰ 任务运行 N 分钟，时间基准: processing_started_at
[POLLING] ⚠️ 缺少 processing_started_at，使用 created_at
[CREATE VIDEO] ✅ 状态为processing，立即设置processing_started_at
[UPDATE VIDEO] ✅ 设置processing_started_at
[useVideoTasks] 📱 页面从后台恢复，强制同步任务状态
```

### 检查数据库
```sql
-- 检查视频的时间戳
SELECT
  id,
  status,
  created_at,
  processing_started_at,
  processing_completed_at,
  EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))/60 as actual_minutes
FROM videos
WHERE id = '<video-id>';
```

---

## 📌 相关配置

### 超时阈值配置

**文件：`src/services/VideoPollingService.ts`**

```typescript
const TIMEOUT_START = 8 * 60 * 1000      // 8分钟后开始检查
const TIMEOUT_FORCE_COMPLETE = 12 * 60 * 1000  // 12分钟强制完成（99%进度）
const TIMEOUT_FORCE_FAIL = 15 * 60 * 1000      // 15分钟强制失败（有processing_started_at）
const FALLBACK_TIMEOUT = 30 * 60 * 1000        // 30分钟（缺少processing_started_at时）
```

---

## ✅ 修复完成时间
2025-10-19

## 📝 修复人员
Claude Code (AI Assistant)
