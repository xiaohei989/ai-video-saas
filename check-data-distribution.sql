-- 检查template_likes表中数据的实际分布情况

-- 1. 查看有多少个不同的template_id
SELECT COUNT(DISTINCT template_id) as unique_template_ids
FROM template_likes;

-- 2. 查看每个template_id的点赞数分布
SELECT 
    tl.template_id,
    t.slug,
    COUNT(*) as like_count
FROM template_likes tl
LEFT JOIN templates t ON tl.template_id = t.id
GROUP BY tl.template_id, t.slug
ORDER BY like_count DESC
LIMIT 10;

-- 3. 查看是否有template_likes中的template_id不在templates表中
SELECT 
    tl.template_id,
    COUNT(*) as orphaned_likes
FROM template_likes tl
LEFT JOIN templates t ON tl.template_id = t.id
WHERE t.id IS NULL
GROUP BY tl.template_id;

-- 4. 查看templates表中哪些模板没有点赞数据
SELECT 
    t.slug,
    t.id,
    COUNT(tl.id) as like_count
FROM templates t
LEFT JOIN template_likes tl ON t.id = tl.template_id
WHERE t.is_active = true AND t.is_public = true AND t.audit_status = 'approved'
GROUP BY t.id, t.slug
HAVING COUNT(tl.id) = 0
ORDER BY t.slug;

-- 5. 检查数据插入的时间分布
SELECT 
    DATE(created_at) as date,
    COUNT(*) as likes_inserted
FROM template_likes
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 5;