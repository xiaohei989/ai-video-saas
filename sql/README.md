# SQL文件管理指南

本目录包含项目的所有数据库相关SQL文件，经过系统化整理和优化。

## 📁 目录结构

```
sql/
├── migrations/           # 正式数据库迁移文件
│   ├── database-init.sql        # 完整数据库初始化脚本
│   ├── supabase-init.sql        # Supabase特定初始化
│   └── ...                      # Supabase migrations 目录中的文件
├── patches/             # 功能补丁和修复
│   ├── schema_updates.sql       # 架构更新（字段添加、约束等）
│   ├── admin_functions.sql      # 管理后台功能函数
│   ├── bug_fixes.sql           # 各种功能修复
│   └── storage_setup.sql       # 存储和模板配置
├── maintenance/         # 数据维护脚本
│   └── data_migrations.sql     # 数据迁移和清理
├── archive/            # 历史文件归档
│   ├── deploy-missing-functions.sql
│   ├── apply-migration.sql
│   └── manual_migration.sql
└── README.md           # 本文件
```

## 🎯 文件用途说明

### migrations/ - 数据库迁移
- **database-init.sql**: 完整的数据库初始化脚本，包含所有表、函数、触发器
- **supabase-init.sql**: Supabase平台特定的初始化配置
- **001_*.sql**: Supabase官方迁移文件（保持原有编号）

### patches/ - 功能补丁
- **schema_updates.sql**: 数据库架构更新
  - 添加AI标题状态字段
  - 添加R2存储相关字段
  - 添加订阅约束和缩略图来源字段
  
- **admin_functions.sql**: 管理后台功能
  - 管理员仪表板统计函数
  - 订单管理函数
  - 排除管理员数据的统计逻辑

- **bug_fixes.sql**: 各种修复
  - 邀请推荐功能修复
  - 支付表结构修复
  - 订阅分配问题修复
  - 推荐缓存问题修复

- **storage_setup.sql**: 存储配置
  - Supabase存储桶设置
  - 模板表创建和管理
  - 存储权限策略

### maintenance/ - 数据维护
- **data_migrations.sql**: 数据迁移脚本
  - Premium到Enterprise的迁移
  - 视频URL到R2的迁移
  - 数据清理和优化
  - 系统健康监控视图

## 🔧 使用方法

### 新项目初始化
```sql
-- 1. 运行完整初始化
\i sql/migrations/database-init.sql

-- 2. 应用功能补丁
\i sql/patches/schema_updates.sql
\i sql/patches/admin_functions.sql
\i sql/patches/bug_fixes.sql
\i sql/patches/storage_setup.sql

-- 3. 运行数据迁移（如需要）
\i sql/maintenance/data_migrations.sql
```

### 现有项目更新
```sql
-- 根据需要选择性应用补丁
\i sql/patches/schema_updates.sql  -- 添加新字段
\i sql/patches/admin_functions.sql -- 更新管理功能
```

### Supabase环境
```sql
-- 使用Supabase CLI
supabase db reset --local
supabase db push
```

## 📋 维护原则

### 1. 文件命名规范
- **描述性名称**: 文件名应清楚描述其用途
- **分类前缀**: 按功能分类（schema_, admin_, bug_fix_等）
- **版本控制**: 重要变更记录在Git提交中

### 2. 文件组织规则
- **单一职责**: 每个文件专注一个功能领域
- **合理分组**: 相关功能合并到同一文件
- **清晰注释**: 每个脚本包含详细的功能说明

### 3. 安全考虑
- **权限控制**: 所有函数都设置了适当的权限
- **RLS策略**: 敏感表启用行级安全
- **输入验证**: 函数参数包含必要的验证

## 🚫 废弃文件清理

以下类型的文件已被清理：
- ✅ `test-*.sql` - 测试文件
- ✅ `check-*.sql` - 检查脚本
- ✅ `verify-*.sql` - 验证脚本
- ✅ `fix-*.sql` - 临时修复（已合并到bug_fixes.sql）
- ✅ `add-*.sql` - 字段添加（已合并到schema_updates.sql）

## 📊 优化效果

### 清理前后对比
- **文件数量**: 67个 → 12个 (减少82%)
- **目录结构**: 混乱的根目录 → 清晰的分类目录
- **维护性**: 散乱的单个文件 → 合并的功能模块
- **可读性**: 临时文件混杂 → 清晰的用途分类

### 文件大小分布
```
migrations/: ~95KB (主要初始化文件)
patches/: ~25KB (功能补丁集合)
maintenance/: ~15KB (数据维护脚本)
archive/: ~8KB (历史文件)
```

## 🔄 未来维护

### 添加新功能
1. 根据功能类型选择对应的patches文件
2. 在文件末尾添加新的SQL代码
3. 更新相关注释和文档
4. 测试后提交Git

### 数据库迁移
1. 优先使用Supabase migrations目录
2. 复杂变更可以添加到patches目录
3. 数据迁移放入maintenance目录

### 定期清理
- 每季度检查archive目录，删除过时文件
- 监控patches文件大小，必要时拆分
- 更新README文档，保持信息准确

---

**注意**: 在生产环境中应用SQL脚本前，请务必在测试环境中验证，并备份现有数据库。