-- 为点赞数为0的模板添加随机点赞数据（修复版）
-- 每个模板获得1-1000个随机点赞

DO $$
DECLARE
    template_id_text TEXT;
    like_count INTEGER;
    i INTEGER;
    templates_with_zero_likes TEXT[] := ARRAY[
        '5f7e8d9c-3b4a-5c6d-7e8f-9a0b1c2d3e4f', -- fireplace-cozy-selfie
        '8c9d7e6f-2a3b-4c5d-6e7f-8a9b0c1d2e3f', -- ocean-selfie-surprise
        '4f8d6e2a-9b3c-4e7a-8f2d-1a5b6c7d8e9f', -- baby-profession-interview
        '7e9a2b4c-6d8f-4c2a-9e7b-3a1f5d8c2e4b', -- country-historical-evolution
        '6f5e4d3c-2b1a-4e9f-8c7d-1a2b3c4d5e6f', -- blueprint-to-product
        'c1d2e3f4-a5b6-7890-1234-567890abcdef', -- city-landmarks-book
        '8d6dbb97-75a2-422d-8bf2-f5cdd6fd2279', -- finger-touch-activation
        'b8c7d6e5-f4a3-2918-7b6c-9e8d7c6b5a43', -- skydiving-adventure
        'a7b8c9d0-e1f2-3456-7890-abcdef123456', -- magical-creature-summon
        'f9e8d7c6-b5a4-3928-1e0f-6c5b4a392817', -- living-book-storms
        'f3e6b9c2-5d8a-4f7e-9c1b-8a2f5e3d6c1b', -- time-travel-ancient-livestream
        'e5b8f1c4-9a7d-3f6e-2b8c-7e4a1d5b8f9e', -- yeti-mountain-life-vlog
        'b7f4c8e1-2d9a-6f3b-8c5e-1a7d4b2f8e9c', -- bigfoot-survival-vlog
        'f3e6b9c2-5d8a-7f4e-0c9b-8a2f5e3d6c1b', -- baby-adult-anxiety-comedy
        'd9a3f6e8-4c7b-5e9d-1a4f-8b2e6d9a3c5f', -- newborn-baby-interview-comedy
        'c8f2d5a9-3e7b-4c6d-9a8f-1b5e8c2a4d7c', -- windowsill-animal-interview
        'a8c5f2d9-4e7b-3a6c-8f1d-2b9e5a8c4f7e', -- crystal-fruit-biting-asmr
        'f2d3e5a7-0c8f-4b1e-9a6d-3e7c2b8a5f4d', -- cctv-animal-rider-surveillance
        'e1a2c6f5-9d7a-8b0e-3f4c-7e2a5b9d8c1f', -- olympic-animal-diving-broadcast
        'd0f1b5e4-8c6d-7f9e-2a3b-6c1e9d4a7b8c', -- surveillance-animal-trampoline
        'c9e0a4f3-7d5b-6a8c-1f2e-5b0d8c3f9a6b', -- animal-skateboarding-street
        'b8d9f3e2-6c4a-5f7b-0e1d-4a9c7b2e8f5a', -- energy-object-cutting-asmr
        'a7c8e4f1-5b2d-4e8a-9c7f-2d6b3a8e5c9d', -- natural-phenomenon-cutting-asmr
        '5a46006a-7da2-47a1-909a-9d4cda1c096d', -- miniature-animals-surprise
        'f01f880a-b9b3-4dc3-9b5f-34f2fc9fb736', -- art-coffee-machine
        '8151cddb-757c-45ec-a490-463d6dbe7e88', -- surveillance-animal-encounter
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890', -- selfie-vlog-animals
        'c9605a16-353e-4c6a-ac7a-d5b327dab9fd'  -- tiny-pet-fingertip
    ];
BEGIN
    -- 暂时禁用外键约束检查
    SET session_replication_role = replica;
    
    RAISE NOTICE '🚀 开始为28个模板添加随机点赞数据...';
    
    -- 为每个0点赞的模板添加随机点赞
    FOREACH template_id_text IN ARRAY templates_with_zero_likes
    LOOP
        -- 生成1-1000之间的随机点赞数
        like_count := floor(random() * 1000) + 1;
        
        RAISE NOTICE '📝 为模板 % 添加 % 个点赞', template_id_text, like_count;
        
        -- 为这个模板插入指定数量的点赞记录
        FOR i IN 1..like_count LOOP
            INSERT INTO template_likes (
                template_id,
                user_id,
                created_at
            ) VALUES (
                template_id_text::uuid,
                gen_random_uuid(), -- 生成随机用户ID
                NOW() - (random() * interval '30 days') -- 随机时间（最近30天内）
            );
        END LOOP;
    END LOOP;
    
    -- 恢复外键约束检查
    SET session_replication_role = DEFAULT;
    
    RAISE NOTICE '✅ 所有28个模板的随机点赞数据添加完成！';
    
END $$;