-- ============================================
-- Template Likes Only Migration
-- Version: 003_fixed
-- Description: 只创建点赞功能需要的核心表和功能
-- ============================================

-- ============================================
-- 1. 扩展 profiles 表 (如果需要)
-- ============================================
DO $$ 
BEGIN
  -- 添加社交功能字段（如果不存在）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'follower_count') THEN
    ALTER TABLE public.profiles 
    ADD COLUMN follower_count INTEGER DEFAULT 0,
    ADD COLUMN following_count INTEGER DEFAULT 0,
    ADD COLUMN template_count INTEGER DEFAULT 0,
    ADD COLUMN is_verified BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================
-- 2. 创建或扩展 templates 表
-- ============================================
DO $$ 
BEGIN
  -- 检查 templates 表是否存在
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'templates' AND table_schema = 'public') THEN
    -- 创建 templates 表（使用TEXT类型的ID以匹配前端）
    CREATE TABLE public.templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      is_public BOOLEAN DEFAULT true,
      is_featured BOOLEAN DEFAULT false,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      favorite_count INTEGER DEFAULT 0,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    -- 添加缺失的列
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'like_count') THEN
      ALTER TABLE public.templates 
      ADD COLUMN author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN is_public BOOLEAN DEFAULT true,
      ADD COLUMN is_featured BOOLEAN DEFAULT false,
      ADD COLUMN like_count INTEGER DEFAULT 0,
      ADD COLUMN comment_count INTEGER DEFAULT 0,
      ADD COLUMN share_count INTEGER DEFAULT 0,
      ADD COLUMN view_count INTEGER DEFAULT 0,
      ADD COLUMN favorite_count INTEGER DEFAULT 0,
      ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
  END IF;
END $$;

-- ============================================
-- 3. 创建模板点赞表
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- ============================================
-- 4. 创建模板收藏表
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- ============================================
-- 5. 创建索引优化查询性能
-- ============================================
CREATE INDEX IF NOT EXISTS idx_templates_like_count ON public.templates(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public);
CREATE INDEX IF NOT EXISTS idx_template_likes_user_id ON public.template_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_template_likes_template_id ON public.template_likes(template_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_user_id ON public.template_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_template_id ON public.template_favorites(template_id);

-- ============================================
-- 6. 创建触发器函数
-- ============================================

-- 更新点赞数触发器
CREATE OR REPLACE FUNCTION update_template_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.templates 
    SET like_count = like_count + 1 
    WHERE id = NEW.template_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.templates 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.template_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 删除已存在的触发器（如果有）
DROP TRIGGER IF EXISTS trigger_update_template_like_count ON public.template_likes;

-- 创建触发器
CREATE TRIGGER trigger_update_template_like_count
AFTER INSERT OR DELETE ON public.template_likes
FOR EACH ROW EXECUTE FUNCTION update_template_like_count();

-- 更新收藏数触发器
CREATE OR REPLACE FUNCTION update_template_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.templates 
    SET favorite_count = favorite_count + 1 
    WHERE id = NEW.template_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.templates 
    SET favorite_count = GREATEST(0, favorite_count - 1) 
    WHERE id = OLD.template_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 删除已存在的触发器（如果有）
DROP TRIGGER IF EXISTS trigger_update_template_favorite_count ON public.template_favorites;

-- 创建触发器
CREATE TRIGGER trigger_update_template_favorite_count
AFTER INSERT OR DELETE ON public.template_favorites
FOR EACH ROW EXECUTE FUNCTION update_template_favorite_count();

-- ============================================
-- 7. RLS (Row Level Security) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE public.template_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_favorites ENABLE ROW LEVEL SECURITY;

-- template_likes 策略
DROP POLICY IF EXISTS "Public can view template likes" ON public.template_likes;
CREATE POLICY "Public can view template likes" ON public.template_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own likes" ON public.template_likes;
CREATE POLICY "Users can manage own likes" ON public.template_likes
  FOR ALL USING (auth.uid() = user_id);

-- template_favorites 策略
DROP POLICY IF EXISTS "Users can view own favorites" ON public.template_favorites;
CREATE POLICY "Users can view own favorites" ON public.template_favorites
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own favorites" ON public.template_favorites;
CREATE POLICY "Users can manage own favorites" ON public.template_favorites
  FOR ALL USING (auth.uid() = user_id);

-- templates 表的 RLS 策略（如果需要）
DO $$
BEGIN
  -- 检查是否已启用 RLS
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'templates' 
    AND n.nspname = 'public' 
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 公开模板可被所有人查看
DROP POLICY IF EXISTS "Public templates are viewable by everyone" ON public.templates;
CREATE POLICY "Public templates are viewable by everyone" ON public.templates
  FOR SELECT USING (is_public = true);

-- 用户可以查看和管理自己的模板
DROP POLICY IF EXISTS "Users can view own templates" ON public.templates;
CREATE POLICY "Users can view own templates" ON public.templates
  FOR SELECT USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can manage own templates" ON public.templates;
CREATE POLICY "Users can manage own templates" ON public.templates
  FOR ALL USING (auth.uid() = author_id);

-- ============================================
-- 8. 辅助函数
-- ============================================

-- 获取用户是否点赞了某个模板
CREATE OR REPLACE FUNCTION has_user_liked_template(
  p_user_id UUID,
  p_template_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.template_likes
    WHERE user_id = p_user_id AND template_id = p_template_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户是否收藏了某个模板
CREATE OR REPLACE FUNCTION has_user_favorited_template(
  p_user_id UUID,
  p_template_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.template_favorites
    WHERE user_id = p_user_id AND template_id = p_template_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授予必要的权限
GRANT EXECUTE ON FUNCTION has_user_liked_template TO authenticated, anon;
GRANT EXECUTE ON FUNCTION has_user_favorited_template TO authenticated, anon;

-- ============================================
-- 9. 插入示例模板数据（如果表为空）
-- ============================================
DO $$
BEGIN
  -- 检查 templates 表是否为空
  IF NOT EXISTS (SELECT 1 FROM public.templates LIMIT 1) THEN
    -- 插入示例模板数据
    INSERT INTO public.templates (id, name, description, is_public, like_count) VALUES
    ('art-coffee-machine', '艺术咖啡机魔法创作', '将经典艺术作品或自定义图片通过神奇咖啡机转化为杯中的流体艺术', true, 520),
    ('asmr-surreal-toast-spread', 'ASMR超现实吐司涂抹', '将各种意想不到的微型物品当作黄油涂抹在吐司上，创造视觉冲击的ASMR体验', true, 342),
    ('glass-cutting-asmr', '玻璃水果切割ASMR', 'Create mesmerizing ASMR videos of cutting translucent glass fruits', true, 489),
    ('magic-pen-3d-bloom', '魔法画笔3D绽放', '用魔法画笔在书页上触发3D立体绽放效果的ASMR视频', true, 678),
    ('miniature-animals-surprise', '微型动物惊喜', '超现实的微型动物藏在意想不到的容器中，开门瞬间的惊喜揭露', true, 756),
    ('surveillance-animal-encounter', '监控动物奇遇', '创建独特的监控摄像头视角动物互动视频，带有夜视效果和鱼眼镜头畸变', true, 423),
    ('tiny-pet-fingertip', '指尖萌宠', '拍摄一只站在指尖上的超迷你可爱动物，展现温馨治愈的画面', true, 234);
  END IF;
END $$;

-- ============================================
-- 迁移完成
-- ============================================