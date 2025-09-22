-- ==========================================
-- SQL补丁应用脚本
-- 按正确顺序应用所有补丁文件
-- ==========================================

-- 检查数据库连接
SELECT 'Connected to database: ' || current_database() as status;
SELECT 'Timestamp: ' || NOW() as timestamp;

\echo '=========================================='
\echo '开始应用SQL补丁...'
\echo '=========================================='

-- 1. 应用架构更新
\echo '1. 应用架构更新 (schema_updates.sql)...'
\i sql/patches/schema_updates.sql

-- 2. 应用存储设置
\echo '2. 应用存储设置 (storage_setup.sql)...'
\i sql/patches/storage_setup.sql

-- 3. 应用管理功能
\echo '3. 应用管理功能 (admin_functions.sql)...'
\i sql/patches/admin_functions.sql

-- 4. 应用错误修复
\echo '4. 应用错误修复 (bug_fixes.sql)...'
\i sql/patches/bug_fixes.sql

-- 5. 应用数据迁移（可选）
\echo '5. 应用数据迁移 (data_migrations.sql)...'
\echo '注意: 数据迁移可能耗时较长，确认后继续...'
-- \i sql/maintenance/data_migrations.sql

\echo '=========================================='
\echo 'SQL补丁应用完成！'
\echo '=========================================='

-- 验证关键表是否存在
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'videos') 
    THEN '✅ videos表存在' 
    ELSE '❌ videos表缺失' 
  END as videos_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'templates') 
    THEN '✅ templates表存在' 
    ELSE '❌ templates表缺失' 
  END as templates_check;

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_admin_dashboard_stats') 
    THEN '✅ 管理统计函数存在' 
    ELSE '❌ 管理统计函数缺失' 
  END as admin_function_check;

-- 显示系统健康状态
SELECT * FROM v_system_health ORDER BY table_name;