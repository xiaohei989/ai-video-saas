-- ============================================
-- 重建模板系统 - 统一使用UUID
-- Version: 006
-- Description: 完全重构模板ID系统，统一使用UUID
-- ============================================

-- ============================================
-- 1. 清理现有数据（测试环境可以安全删除）
-- ============================================

-- 删除现有的点赞相关表和数据
DROP TABLE IF EXISTS public.template_likes CASCADE;
DROP TABLE IF EXISTS public.template_favorites CASCADE;

-- 删除现有的模板数据但保留表结构
DELETE FROM public.templates;

-- ============================================
-- 2. 重建模板表结构（统一使用UUID）
-- ============================================

-- 确保表有正确的列
DO $$
BEGIN
  -- 检查并添加缺失的列
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'slug') THEN
    ALTER TABLE public.templates ADD COLUMN slug TEXT UNIQUE;
  END IF;
  
  -- 确保ID是UUID类型（如果不是则转换）
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'id' AND data_type = 'text') THEN
    -- 先删除所有数据
    DELETE FROM public.templates;
    
    -- 修改ID字段类型为UUID
    ALTER TABLE public.templates ALTER COLUMN id TYPE UUID USING uuid_generate_v4();
    ALTER TABLE public.templates ALTER COLUMN id SET DEFAULT uuid_generate_v4();
  END IF;
END $$;

-- ============================================
-- 3. 重建点赞系统表（使用UUID）
-- ============================================

CREATE TABLE public.template_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- 创建收藏表（为未来功能准备）
CREATE TABLE public.template_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- ============================================
-- 4. 创建性能优化索引
-- ============================================

-- 模板表索引
CREATE INDEX IF NOT EXISTS idx_templates_id ON public.templates(id);
CREATE INDEX IF NOT EXISTS idx_templates_slug ON public.templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_like_count ON public.templates(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_author_id ON public.templates(author_id);

-- 点赞表索引  
CREATE INDEX IF NOT EXISTS idx_template_likes_user_id ON public.template_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_template_likes_template_id ON public.template_likes(template_id);
CREATE INDEX IF NOT EXISTS idx_template_likes_user_template ON public.template_likes(user_id, template_id);
CREATE INDEX IF NOT EXISTS idx_template_likes_created_at ON public.template_likes(created_at DESC);

-- 收藏表索引
CREATE INDEX IF NOT EXISTS idx_template_favorites_user_id ON public.template_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_template_id ON public.template_favorites(template_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_user_template ON public.template_favorites(user_id, template_id);

-- ============================================
-- 5. 创建触发器维护计数器
-- ============================================

-- 点赞数触发器
CREATE OR REPLACE FUNCTION update_template_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.templates 
    SET like_count = like_count + 1 
    WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.templates 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_like_count
  AFTER INSERT OR DELETE ON public.template_likes
  FOR EACH ROW EXECUTE FUNCTION update_template_like_count();

-- 收藏数触发器
CREATE OR REPLACE FUNCTION update_template_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.templates 
    SET favorite_count = favorite_count + 1 
    WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.templates 
    SET favorite_count = GREATEST(0, favorite_count - 1) 
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_favorite_count
  AFTER INSERT OR DELETE ON public.template_favorites
  FOR EACH ROW EXECUTE FUNCTION update_template_favorite_count();

-- ============================================
-- 6. 设置 RLS 策略
-- ============================================

-- 启用行级安全
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_favorites ENABLE ROW LEVEL SECURITY;

-- 模板表策略
CREATE POLICY "templates_select_public" ON public.templates
  FOR SELECT USING (is_public = true OR auth.uid() = author_id);

CREATE POLICY "templates_insert_authenticated" ON public.templates
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "templates_update_owner" ON public.templates
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "templates_delete_owner" ON public.templates
  FOR DELETE USING (auth.uid() = author_id);

-- 点赞表策略（简化且明确）
CREATE POLICY "template_likes_select_all" ON public.template_likes
  FOR SELECT USING (true);

CREATE POLICY "template_likes_insert_authenticated" ON public.template_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "template_likes_delete_owner" ON public.template_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 收藏表策略
CREATE POLICY "template_favorites_select_owner" ON public.template_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "template_favorites_insert_authenticated" ON public.template_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "template_favorites_delete_owner" ON public.template_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. 设置角色权限
-- ============================================

-- 匿名用户权限
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.templates TO anon;
GRANT SELECT ON public.template_likes TO anon;

-- 认证用户权限
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.templates TO authenticated;
GRANT ALL ON public.template_likes TO authenticated;
GRANT ALL ON public.template_favorites TO authenticated;

-- ============================================
-- 8. 插入新的模板数据（使用固定UUID）
-- ============================================

INSERT INTO public.templates (id, slug, name, description, is_public, like_count, credit_cost, tags) VALUES
('f01f880a-b9b3-4dc3-9b5f-34f2fc9fb736', 'art-coffee-machine', '艺术咖啡机魔法创作', '将经典艺术作品或自定义图片通过神奇咖啡机转化为杯中的流体艺术', true, 520, 1, ARRAY['coffee', 'art', 'magic', 'creative', 'asmr']),
('401bf980-9845-4ae9-bf01-d1731e3d9e04', 'asmr-surreal-toast-spread', 'ASMR超现实吐司涂抹', '将各种意想不到的微型物品当作黄油涂抹在吐司上，创造视觉冲击的ASMR体验', true, 342, 1, ARRAY['asmr', 'food', 'surreal', 'creative']),
('2dbea2dc-48f3-427e-9db9-694289bde441', 'glass-cutting-asmr', '玻璃水果切割ASMR', 'Create mesmerizing ASMR videos of cutting translucent glass fruits', true, 489, 1, ARRAY['asmr', 'cutting', 'glass', 'satisfying']),
('09423d7c-ef56-4ba6-8955-0d9b8b35dbff', 'magic-pen-3d-bloom', '魔法画笔3D绽放', '用魔法画笔在书页上触发3D立体绽放效果的ASMR视频', true, 678, 1, ARRAY['magic', 'art', '3d', 'bloom', 'asmr']),
('5a46006a-7da2-47a1-909a-9d4cda1c096d', 'miniature-animals-surprise', '微型动物惊喜', '超现实的微型动物藏在意想不到的容器中，开门瞬间的惊喜揭露', true, 756, 1, ARRAY['animals', 'miniature', 'surprise', 'cute']),
('8151cddb-757c-45ec-a490-463d6dbe7e88', 'surveillance-animal-encounter', '监控动物奇遇', '创建独特的监控摄像头视角动物互动视频，带有夜视效果和鱼眼镜头畸变', true, 423, 1, ARRAY['surveillance', 'animals', 'security', 'night-vision']),
('c9605a16-353e-4c6a-ac7a-d5b327dab9fd', 'tiny-pet-fingertip', '指尖萌宠', '拍摄一只站在指尖上的超迷你可爱动物，展现温馨治愈的画面', true, 234, 1, ARRAY['pets', 'tiny', 'cute', 'fingertip']);

-- ============================================
-- 9. 验证设置
-- ============================================

-- 测试查询
SELECT COUNT(*) as template_count FROM public.templates;
SELECT COUNT(*) as likes_count FROM public.template_likes;

-- 显示表结构
\d public.templates
\d public.template_likes

RAISE NOTICE '===========================================';
RAISE NOTICE '模板系统重建完成！';
RAISE NOTICE '所有模板现在使用UUID格式';
RAISE NOTICE '===========================================';