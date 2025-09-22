-- 临时禁用外键检查并创建不同的点赞数据

-- 首先清空现有数据
DELETE FROM template_likes;

-- 禁用外键约束检查
SET session_replication_role = replica;

-- 为每个模板插入不同数量的随机点赞（这里手动生成几个示例）

-- 获取所有模板ID并为每个生成不同数量的点赞
DO $$
DECLARE
    template_record RECORD;
    like_count INTEGER;
    i INTEGER;
    virtual_user_id UUID;
BEGIN
    -- 遍历所有激活的公开模板
    FOR template_record IN 
        SELECT id, slug FROM templates 
        WHERE is_active = true AND is_public = true
    LOOP
        -- 为每个模板生成20-1000之间的随机点赞数
        like_count := floor(random() * (1000 - 20 + 1)) + 20;
        
        RAISE NOTICE '模板 % 将获得 % 个点赞', template_record.slug, like_count;
        
        -- 为该模板创建指定数量的点赞记录
        FOR i IN 1..like_count LOOP
            virtual_user_id := gen_random_uuid();
            
            INSERT INTO template_likes (template_id, user_id, created_at)
            VALUES (
                template_record.id,
                virtual_user_id,
                NOW() - (random() * interval '30 days')
            );
        END LOOP;
    END LOOP;
END $$;

-- 重新启用外键约束检查
SET session_replication_role = DEFAULT;

-- 验证结果
SELECT 
    t.slug,
    COUNT(tl.id) as like_count
FROM templates t
LEFT JOIN template_likes tl ON t.id = tl.template_id
WHERE t.is_active = true AND t.is_public = true
GROUP BY t.id, t.slug
ORDER BY like_count DESC
LIMIT 15;