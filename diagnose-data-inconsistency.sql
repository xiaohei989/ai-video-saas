-- 诊断API查询与数据库直接查询不一致的问题

-- 1. 检查templates表结构
\d templates

-- 2. 检查template_likes表结构  
\d template_likes

-- 3. 检查templates表中的ID格式
SELECT id, slug, pg_typeof(id) as id_type 
FROM templates 
WHERE is_active = true AND is_public = true AND audit_status = 'approved'
LIMIT 5;

-- 4. 检查template_likes表中的template_id格式
SELECT template_id, pg_typeof(template_id) as template_id_type, user_id
FROM template_likes 
LIMIT 5;

-- 5. 检查是否存在外键约束
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (tc.table_name = 'template_likes' OR tc.table_name = 'templates');

-- 6. 检查是否存在行级安全策略 (RLS)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('templates', 'template_likes');

-- 7. 检查表的RLS是否启用
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables 
WHERE tablename IN ('templates', 'template_likes');

-- 8. 测试ID匹配情况
WITH template_ids AS (
    SELECT id as template_id
    FROM templates 
    WHERE is_active = true AND is_public = true AND audit_status = 'approved'
),
like_template_ids AS (
    SELECT DISTINCT template_id
    FROM template_likes
)
SELECT 
    'templates' as table_name,
    COUNT(*) as count
FROM template_ids
UNION ALL
SELECT 
    'template_likes_unique' as table_name,
    COUNT(*) as count
FROM like_template_ids
UNION ALL
SELECT 
    'matching_ids' as table_name,
    COUNT(*) as count
FROM template_ids t
INNER JOIN like_template_ids l ON t.template_id = l.template_id;

-- 9. 检查具体的ID值是否匹配
SELECT 
    t.slug,
    t.id as template_id,
    COUNT(tl.id) as like_count
FROM templates t
LEFT JOIN template_likes tl ON t.id = tl.template_id
WHERE t.is_active = true AND t.is_public = true AND t.audit_status = 'approved'
GROUP BY t.id, t.slug
ORDER BY like_count ASC
LIMIT 10;

-- 10. 检查template_likes表中是否有不匹配的template_id
SELECT 
    tl.template_id,
    COUNT(*) as orphaned_likes
FROM template_likes tl
LEFT JOIN templates t ON tl.template_id = t.id
WHERE t.id IS NULL
GROUP BY tl.template_id
LIMIT 10;