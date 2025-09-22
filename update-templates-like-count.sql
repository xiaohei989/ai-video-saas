-- 统计template_likes表数据并更新templates.like_count字段
-- 简化点赞系统，使用简单的数值计数器

DO $$
DECLARE
    template_record RECORD;
    calculated_likes INTEGER;
BEGIN
    RAISE NOTICE '🚀 开始更新templates表的like_count字段...';
    
    -- 遍历所有活跃的公开模板
    FOR template_record IN 
        SELECT id, slug, like_count as current_like_count
        FROM templates 
        WHERE is_active = true AND is_public = true AND audit_status = 'approved'
        ORDER BY slug
    LOOP
        -- 统计该模板在template_likes表中的实际点赞数
        SELECT COUNT(*) INTO calculated_likes
        FROM template_likes 
        WHERE template_id = template_record.id;
        
        -- 确保点赞数至少为50
        IF calculated_likes < 50 THEN
            calculated_likes := 50 + floor(random() * 950); -- 50-999随机数
            RAISE NOTICE '📝 模板 % 原有 % 个点赞，设置为 % 个', 
                template_record.slug, 
                calculated_likes - (50 + floor(random() * 950)),
                calculated_likes;
        ELSE
            RAISE NOTICE '📝 模板 % 统计得到 % 个点赞', 
                template_record.slug, calculated_likes;
        END IF;
        
        -- 更新templates表的like_count字段
        UPDATE templates 
        SET like_count = calculated_likes,
            updated_at = NOW()
        WHERE id = template_record.id;
        
    END LOOP;
    
    RAISE NOTICE '✅ 所有模板的like_count字段更新完成！';
    
    -- 显示更新后的统计
    RAISE NOTICE '📊 更新后的统计：';
    FOR template_record IN 
        SELECT slug, like_count
        FROM templates 
        WHERE is_active = true AND is_public = true AND audit_status = 'approved'
        ORDER BY like_count ASC
        LIMIT 10
    LOOP
        RAISE NOTICE '  %: % 个点赞', template_record.slug, template_record.like_count;
    END LOOP;
    
    -- 显示总体统计
    DECLARE
        total_templates INTEGER;
        min_likes INTEGER;
        max_likes INTEGER;
        avg_likes NUMERIC;
        templates_below_50 INTEGER;
    BEGIN
        SELECT 
            COUNT(*),
            MIN(like_count),
            MAX(like_count),
            ROUND(AVG(like_count), 1)
        INTO total_templates, min_likes, max_likes, avg_likes
        FROM templates 
        WHERE is_active = true AND is_public = true AND audit_status = 'approved';
        
        SELECT COUNT(*) INTO templates_below_50
        FROM templates 
        WHERE is_active = true AND is_public = true AND audit_status = 'approved'
        AND like_count < 50;
        
        RAISE NOTICE '📈 总体统计:';
        RAISE NOTICE '  总模板数: %', total_templates;
        RAISE NOTICE '  最少点赞: %', min_likes;
        RAISE NOTICE '  最多点赞: %', max_likes;
        RAISE NOTICE '  平均点赞: %', avg_likes;
        RAISE NOTICE '  低于50点赞的模板数: %', templates_below_50;
        
        IF templates_below_50 = 0 THEN
            RAISE NOTICE '🎉 所有模板点赞数都已达到50以上！';
        ELSE
            RAISE NOTICE '❌ 还有 % 个模板点赞数不足50', templates_below_50;
        END IF;
    END;
    
END $$;