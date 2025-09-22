-- 为所有模板添加正确的随机点赞数据
-- 使用数据库中的真实模板ID

DO $$
DECLARE
    template_record RECORD;
    like_count INTEGER;
    i INTEGER;
BEGIN
    -- 暂时禁用外键约束检查
    SET session_replication_role = replica;
    
    RAISE NOTICE '🚀 开始为所有模板添加随机点赞数据...';
    
    -- 遍历所有活跃的公开模板
    FOR template_record IN 
        SELECT id, slug 
        FROM templates 
        WHERE is_active = true AND is_public = true AND audit_status = 'approved'
        ORDER BY slug
    LOOP
        -- 生成1-1000之间的随机点赞数
        like_count := floor(random() * 1000) + 1;
        
        RAISE NOTICE '📝 为模板 % (%) 添加 % 个点赞', template_record.slug, template_record.id, like_count;
        
        -- 为这个模板插入指定数量的点赞记录
        FOR i IN 1..like_count LOOP
            INSERT INTO template_likes (
                template_id,
                user_id,
                created_at
            ) VALUES (
                template_record.id,
                gen_random_uuid(), -- 生成随机用户ID
                NOW() - (random() * interval '30 days') -- 随机时间（最近30天内）
            );
        END LOOP;
    END LOOP;
    
    -- 恢复外键约束检查
    SET session_replication_role = DEFAULT;
    
    RAISE NOTICE '✅ 所有模板的随机点赞数据添加完成！';
    
    -- 显示最终统计
    RAISE NOTICE '📊 最终统计：';
    FOR template_record IN 
        SELECT t.slug, COUNT(tl.id) as like_count
        FROM templates t
        LEFT JOIN template_likes tl ON t.id = tl.template_id
        WHERE t.is_active = true AND t.is_public = true AND t.audit_status = 'approved'
        GROUP BY t.id, t.slug
        ORDER BY like_count DESC
        LIMIT 10
    LOOP
        RAISE NOTICE '  %: % 个点赞', template_record.slug, template_record.like_count;
    END LOOP;
    
    -- 显示总计
    DECLARE
        total_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO total_count FROM template_likes;
        RAISE NOTICE '📈 总点赞数: %', total_count;
    END;
    
END $$;