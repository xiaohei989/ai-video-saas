# 视频生成队列系统设置指南

## 快速设置

### 步骤1: 应用数据库迁移

1. 登录到您的 [Supabase Dashboard](https://app.supabase.com)
2. 选择项目: `hvkzwrnvxsleeonqqrzq`
3. 进入 **SQL Editor**
4. 复制 `manual_migration.sql` 文件的内容
5. 粘贴到SQL编辑器中并点击 **Run** 执行

### 步骤2: 验证设置

执行迁移后，您应该看到以下成功消息：
```
队列系统数据库迁移完成！
已添加的功能:
- videos表队列字段
- subscriptions表 (如果之前不存在)
- 队列管理索引和约束
- 队列管理函数和触发器
- 为现有用户创建免费订阅
```

### 步骤3: 重新启动应用

数据库迁移完成后，队列系统将自动启用。

## 功能特性

### 并发限制
- **免费用户**: 1个并发视频
- **基础用户**: 3个并发视频  
- **专业用户**: 5个并发视频
- **高级用户**: 10个并发视频
- **系统总限制**: 20个并发视频

### 队列管理
- 自动队列调度
- 优先级处理
- 预估等待时间
- 实时状态更新

### 用户体验
- 简化的等待提示
- 排队位置显示
- 自动队列处理
- 无需手动干预

## 故障排除

### 如果看到数据库错误

队列系统已添加容错处理：
- 如果数据库字段缺失，系统将以"回退模式"运行
- 用户仍可正常生成视频，但没有队列功能
- 应用迁移后，队列功能将自动启用

### 环境变量

队列系统配置已添加到 `.env` 文件：
```env
VITE_SYSTEM_MAX_CONCURRENT_VIDEOS=20
VITE_QUEUE_CHECK_INTERVAL=5000
VITE_USER_CONCURRENT_FREE=1
VITE_USER_CONCURRENT_BASIC=3
VITE_USER_CONCURRENT_PRO=5
VITE_USER_CONCURRENT_PREMIUM=10
```

### 日志监控

在浏览器控制台中查看队列相关日志：
- `[QUEUE SERVICE]` - 队列服务状态
- 正常启动应显示: "Queue service initialized successfully"
- 回退模式显示: "Running in fallback mode"

## 技术细节

### 数据库表结构

队列功能使用以下新字段：
- `videos.queue_position` - 队列位置
- `videos.queue_entered_at` - 入队时间
- `videos.queue_started_at` - 开始处理时间
- `videos.queue_priority` - 队列优先级

### 服务架构

- `videoQueueService.ts` - 队列管理核心
- 内存队列 + 数据库持久化
- 5秒间隔队列处理
- 自动状态恢复

---

如有问题，请检查浏览器控制台日志或联系技术支持。