-- 查询所有模板
SELECT id, slug, is_active, created_at
FROM templates
ORDER BY created_at DESC
LIMIT 5;
