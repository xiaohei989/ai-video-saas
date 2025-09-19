-- 创建templates表，存储模板基本信息
-- 执行命令：PGPASSWORD=huixiangyigou2025! psql -h aws-1-us-west-1.pooler.supabase.com -U postgres.hvkzwrnvxsleeonqqrzq -d postgres -f create-templates-table.sql

-- 创建templates表
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name JSONB NOT NULL,
  description JSONB,
  icon TEXT,
  credits INTEGER DEFAULT 0,
  tags TEXT[],
  preview_url TEXT,
  like_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_templates_slug ON templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_like_count ON templates(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active) WHERE is_active = true;

-- 确保template_likes表的外键约束正确
DO $$
BEGIN
    -- 检查外键约束是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'template_likes_template_id_fkey'
        AND table_name = 'template_likes'
    ) THEN
        -- 添加外键约束
        ALTER TABLE template_likes
        ADD CONSTRAINT template_likes_template_id_fkey 
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_templates_updated_at ON templates;
CREATE TRIGGER trigger_update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_templates_updated_at();

-- 显示创建结果
SELECT 'Templates table created successfully' as result;