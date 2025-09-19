# AI视频SaaS项目死代码分析报告

生成时间：2025-09-19
工具版本：Knip v5.63.1, ts-prune v0.10.3

## 📊 检测结果总览

### Knip 检测结果
- **未使用文件**: 23个
- **未使用依赖包**: 41个
- **未使用开发依赖**: 1个
- **未列出的依赖**: 2个
- **未列出的二进制文件**: 1个
- **未解析的导入**: 2个

### ts-prune 检测结果
- **未使用的导出**: 约350+个导出

## 🎯 分类清理计划

### 第一批：安全删除类（高优先级）

#### 1.1 明确未使用的脚本文件（23个）
```
✅ 安全删除 - 调试和测试脚本
- check-duplicates.mjs
- check-pending-videos.mjs
- check-second-user.mjs
- check-test-video-detail.mjs
- check-user-status.mjs
- cleanup-duplicates.mjs
- delete-pending-videos.mjs
- diagnose-rate-limit.mjs
- find-hamster-video.mjs
- fix-rate-limit-system.mjs
- get-latest-video.mjs
- manual-migrate-test-video.mjs
- monitor-new-hamster-video.mjs
- monitor-test-video.mjs
- retry-test-video-migration.mjs
- sync-templates-to-db.mjs

✅ 安全删除 - 管理脚本
- scripts/analyze-credits.js
- scripts/check-user-subscriptions.js
- scripts/cleanup-duplicate-subscriptions.js
- scripts/fix-subscription.js
- scripts/sync-templates.js
```

#### 1.2 未使用的工具函数（高置信度）
```
✅ 安全删除的工具函数：
- src/test-completion-fix.ts（测试文件）
- src/config/backgroundVideos.ts 中的多个未使用函数：
  - getBackgroundVideoConfig
  - validateVideoSources
  - getRandomBackgroundVideo
  - getRandomBackgroundVideos
  - getTimeBasedBackgroundVideo
- src/config/credits.ts:formatCredits
- src/config/stripe.ts 中的未使用函数：
  - getStripePriceIds
  - getPriceId
  - getEnvironmentInfo
  - TEST_PRICE_IDS
  - PRODUCTION_PRICE_IDS
```

### 第二批：需要确认类（中优先级）

#### 2.1 可能被动态使用的服务
```
⚠️ 需要确认 - 可能被动态导入：
- src/services/ 下的多个 default 导出
- src/hooks/ 下的自定义hooks
- src/utils/ 下的工具函数

🔍 重点检查：
- AI相关服务（aiContentService, promptAnalyzer等）
- 安全相关服务（securityMonitorService, csrfService等）
- 性能监控服务（analyticsService, performanceGuard等）
```

#### 2.2 UI组件导出
```
⚠️ 需要确认 - 可能被条件性使用：
- src/components/ui/ 下的多个组件变体
- src/components/admin/ 下的管理组件
- src/components/debug/ 下的调试组件

优先检查：
- FlowingButton 相关组件
- Admin相关组件
- Debug面板组件
```

### 第三批：暂时保留类（低优先级）

#### 3.1 类型定义和接口
```
🛡️ 保留 - 类型安全相关：
- src/types/ 下的所有类型定义
- 各种 Props 接口
- API响应类型
```

#### 3.2 配置和常量
```
🛡️ 保留 - 配置相关：
- 环境配置相关的导出
- 常量定义
- 配置对象
```

## 📦 依赖包清理分析

### 未使用的生产依赖（需要谨慎处理）
```
高风险删除（核心功能相关）：
- @aws-sdk/client-s3（R2存储）
- @google/genai（AI功能）
- @stripe/stripe-js（支付）
- @supabase/supabase-js（数据库）
- @tanstack/react-query（数据获取）

中等风险删除（UI组件）：
- @radix-ui/*（多个UI组件）
- lucide-react（图标）
- react-admin（管理后台）

低风险删除（工具库）：
- class-variance-authority
- clsx
- tailwind-merge
- zod
```

### 确认未使用的依赖
```
✅ 可以删除：
- tailwindcss（devDependencies中，但项目使用@tailwindcss/postcss）
```

## 🚨 特别注意事项

### 1. 动态导入检查
- 许多services可能通过动态import()使用
- React组件可能通过路由懒加载
- 工具函数可能在字符串模板中引用

### 2. 测试覆盖
- 删除前确保有充分的测试覆盖
- 特别关注核心业务逻辑

### 3. 依赖关系
- 某些"未使用"的导出可能被其他导出内部使用
- 需要检查间接依赖关系

## 🎯 清理执行顺序建议

### 阶段1：脚本文件清理
1. 删除明确的调试脚本（*.mjs文件）
2. 删除临时的管理脚本
3. 验证构建和基本功能

### 阶段2：工具函数清理
1. 删除测试文件
2. 删除未使用的配置函数
3. 删除明确未使用的工具函数
4. 运行完整测试套件

### 阶段3：组件清理
1. 删除调试组件
2. 删除未使用的UI变体
3. 确认管理后台功能正常

### 阶段4：依赖包清理
1. 删除确认未使用的devDependencies
2. 谨慎处理生产依赖
3. 验证构建和部署流程

## 📈 预期清理效果

- **文件数量减少**: 约30-50个文件
- **代码行数减少**: 约15,000-25,000行
- **依赖包减少**: 约5-10个包
- **构建时间优化**: 预计提升10-20%
- **Bundle大小减少**: 预计减少15-25%

## ⚡ 下一步行动

1. 从最安全的脚本文件开始清理
2. 逐步清理明确未使用的函数
3. 建立CI/CD检查机制
4. 定期运行死代码检测