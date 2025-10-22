-- =====================================================
-- 优化FAQ配置 - 符合Google 2025 SEO最佳实践
-- Version: 041
-- =====================================================
--
-- 目的: 优化SEO内容模板中的FAQ配置
--
-- 优化内容:
-- 1. 减少FAQ数量到Google推荐范围 (3-7个)
-- 2. 添加FAQ答案长度指导
-- 3. 提升用户体验和Rich Snippet友好度
--
-- 变更对比:
-- How-To:            5-8个 → 4-6个
-- Alternatives:      5-7个 → 4-6个
-- Platform-Specific: 6-8个 → 5-7个
--
-- 依据:
-- - Google 2025研究显示页面内FAQ最佳数量为3-5个
-- - Rich Snippet通常只显示前2个FAQ
-- - 过多FAQ会降低页面可读性和用户体验
-- =====================================================

-- ========== 1. 更新 How-To 模板FAQ配置 ==========
UPDATE seo_content_templates
SET
  structure_schema = jsonb_set(
    jsonb_set(
      jsonb_set(
        structure_schema,
        '{faq_config,min_items}',
        '4'::jsonb
      ),
      '{faq_config,max_items}',
      '6'::jsonb
    ),
    '{faq_config,answer_length_guide}',
    '{
      "en": "80-120 words (concise and focused)",
      "zh": "150-250 characters",
      "ja": "150-250 characters",
      "ko": "150-250 characters",
      "es": "80-120 words",
      "de": "80-120 words",
      "fr": "80-120 words",
      "ar": "150-250 characters"
    }'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'how-to';

-- ========== 2. 更新 Alternatives 模板FAQ配置 ==========
UPDATE seo_content_templates
SET
  structure_schema = jsonb_set(
    jsonb_set(
      jsonb_set(
        structure_schema,
        '{faq_config,min_items}',
        '4'::jsonb
      ),
      '{faq_config,max_items}',
      '6'::jsonb
    ),
    '{faq_config,answer_length_guide}',
    '{
      "en": "80-120 words (concise and focused)",
      "zh": "150-250 characters",
      "ja": "150-250 characters",
      "ko": "150-250 characters",
      "es": "80-120 words",
      "de": "80-120 words",
      "fr": "80-120 words",
      "ar": "150-250 characters"
    }'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'alternatives';

-- ========== 3. 更新 Platform-Specific 模板FAQ配置 ==========
UPDATE seo_content_templates
SET
  structure_schema = jsonb_set(
    jsonb_set(
      jsonb_set(
        structure_schema,
        '{faq_config,min_items}',
        '5'::jsonb
      ),
      '{faq_config,max_items}',
      '7'::jsonb
    ),
    '{faq_config,answer_length_guide}',
    '{
      "en": "80-120 words (concise and focused)",
      "zh": "150-250 characters",
      "ja": "150-250 characters",
      "ko": "150-250 characters",
      "es": "80-120 words",
      "de": "80-120 words",
      "fr": "80-120 words",
      "ar": "150-250 characters"
    }'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'platform-specific';

-- ========== 4. 验证更新结果 ==========
DO $$
DECLARE
  howto_min INTEGER;
  howto_max INTEGER;
  alt_min INTEGER;
  alt_max INTEGER;
  plat_min INTEGER;
  plat_max INTEGER;
BEGIN
  -- 读取更新后的值
  SELECT
    (structure_schema->'faq_config'->>'min_items')::INTEGER,
    (structure_schema->'faq_config'->>'max_items')::INTEGER
  INTO howto_min, howto_max
  FROM seo_content_templates
  WHERE slug = 'how-to';

  SELECT
    (structure_schema->'faq_config'->>'min_items')::INTEGER,
    (structure_schema->'faq_config'->>'max_items')::INTEGER
  INTO alt_min, alt_max
  FROM seo_content_templates
  WHERE slug = 'alternatives';

  SELECT
    (structure_schema->'faq_config'->>'min_items')::INTEGER,
    (structure_schema->'faq_config'->>'max_items')::INTEGER
  INTO plat_min, plat_max
  FROM seo_content_templates
  WHERE slug = 'platform-specific';

  -- 验证更新
  IF howto_min = 4 AND howto_max = 6 THEN
    RAISE NOTICE '✅ How-To模板FAQ配置已更新: %-%个', howto_min, howto_max;
  ELSE
    RAISE WARNING '❌ How-To模板FAQ配置更新失败: %-%个', howto_min, howto_max;
  END IF;

  IF alt_min = 4 AND alt_max = 6 THEN
    RAISE NOTICE '✅ Alternatives模板FAQ配置已更新: %-%个', alt_min, alt_max;
  ELSE
    RAISE WARNING '❌ Alternatives模板FAQ配置更新失败: %-%个', alt_min, alt_max;
  END IF;

  IF plat_min = 5 AND plat_max = 7 THEN
    RAISE NOTICE '✅ Platform-Specific模板FAQ配置已更新: %-%个', plat_min, plat_max;
  ELSE
    RAISE WARNING '❌ Platform-Specific模板FAQ配置更新失败: %-%个', plat_min, plat_max;
  END IF;

  RAISE NOTICE '📊 FAQ优化完成! 新配置符合Google 2025 SEO最佳实践';
END $$;

-- ========== 5. 查看更新后的配置 ==========
SELECT
  slug,
  name,
  structure_schema->'faq_config'->>'min_items' as faq_min,
  structure_schema->'faq_config'->>'max_items' as faq_max,
  structure_schema->'faq_config'->'answer_length_guide'->>'en' as answer_length_en,
  structure_schema->'faq_config'->'answer_length_guide'->>'zh' as answer_length_zh,
  updated_at
FROM seo_content_templates
ORDER BY sort_order;
