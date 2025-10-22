-- 删除冗余的 seo_prompt_templates 表
--
-- 背景:
-- 该表在之前的会话中创建,用于存储SEO内容生成提示词。
-- 现在已经迁移到 seo_content_templates 表,该表不再使用。
--
-- 相关表:
-- - seo_content_templates: 新的内容生成提示词表 (替代 seo_prompt_templates)
-- - ai_prompt_templates: AI评分提示词表 (SEO评分、EEAT评分)
--
-- 创建时间: 2025-10-19
-- 作者: Claude AI Assistant

-- 删除表(如果存在)
DROP TABLE IF EXISTS seo_prompt_templates CASCADE;

-- 记录操作
COMMENT ON SCHEMA public IS '已删除冗余表 seo_prompt_templates (2025-10-19)';
