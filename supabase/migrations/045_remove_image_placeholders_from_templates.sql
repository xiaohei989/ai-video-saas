-- =====================================================
-- 移除 SEO 模板中的图片占位符功能
-- =====================================================
--
-- 原因: 用户不需要在 SEO 文章中生成图片占位符
-- 操作: 从 how-to, alternatives, platform-specific 三个模板中删除图片相关章节
-- =====================================================

-- ========== 1. 移除 how-to 模板中的图片章节 ==========
UPDATE seo_content_templates
SET
  prompt_template = REGEXP_REPLACE(
    prompt_template,
    '#### 7\.3 图片Alt Text占位符[^#]*?(?=####|### 8\. 格式要求)',
    '',
    'g'
  ),
  updated_at = NOW()
WHERE slug = 'how-to';

-- ========== 2. 移除 alternatives 模板中的图片章节 ==========
UPDATE seo_content_templates
SET
  prompt_template = REGEXP_REPLACE(
    prompt_template,
    '### 7\. 图片Alt Text占位符[^#]*?(?=## 输出格式)',
    '',
    'g'
  ),
  updated_at = NOW()
WHERE slug = 'alternatives';

-- ========== 3. 移除 platform-specific 模板中的图片章节 ==========
UPDATE seo_content_templates
SET
  prompt_template = REGEXP_REPLACE(
    prompt_template,
    '### 7\. 图片Alt Text占位符[^#]*?(?=## 输出格式)',
    '',
    'g'
  ),
  updated_at = NOW()
WHERE slug = 'platform-specific';

-- 验证删除结果
DO $$
DECLARE
  how_to_has_image BOOLEAN;
  alt_has_image BOOLEAN;
  platform_has_image BOOLEAN;
BEGIN
  SELECT prompt_template LIKE '%图片Alt Text%' INTO how_to_has_image
  FROM seo_content_templates WHERE slug = 'how-to';

  SELECT prompt_template LIKE '%图片Alt Text%' INTO alt_has_image
  FROM seo_content_templates WHERE slug = 'alternatives';

  SELECT prompt_template LIKE '%图片Alt Text%' INTO platform_has_image
  FROM seo_content_templates WHERE slug = 'platform-specific';

  IF NOT how_to_has_image AND NOT alt_has_image AND NOT platform_has_image THEN
    RAISE NOTICE '✅ 已成功从所有模板中移除图片占位符功能';
  ELSE
    RAISE WARNING '⚠️ 某些模板仍包含图片相关内容:';
    IF how_to_has_image THEN
      RAISE WARNING '  - how-to 模板仍包含图片章节';
    END IF;
    IF alt_has_image THEN
      RAISE WARNING '  - alternatives 模板仍包含图片章节';
    END IF;
    IF platform_has_image THEN
      RAISE WARNING '  - platform-specific 模板仍包含图片章节';
    END IF;
  END IF;
END $$;

-- 显示更新后的模板长度
SELECT
  slug,
  LENGTH(prompt_template) as new_length,
  (prompt_template LIKE '%图片%')::int as still_has_image,
  to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at
FROM seo_content_templates
WHERE slug IN ('how-to', 'alternatives', 'platform-specific')
ORDER BY slug;
