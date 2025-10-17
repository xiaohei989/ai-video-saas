-- 检查是否已经存在模板
SELECT COUNT(*) as template_count FROM public.seo_content_templates;

-- 如果数量为0，则执行插入
-- 这个文件可以在Supabase SQL Editor中直接运行
