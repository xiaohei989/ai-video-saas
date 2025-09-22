-- ============================================
-- 视频分享与短链接系统
-- Version: 20250909
-- Description: 为视频分享功能创建短链接与事件追踪表
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 短链接表：存储视频分享短码及元数据
CREATE TABLE IF NOT EXISTS public.video_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  short_code TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  platform TEXT CHECK (platform IS NULL OR platform IN (
    'twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'copy', 'email', 'embed'
  )),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 每个视频 + 平台仅允许存在一条短链接记录（平台为空时也唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_share_links_video_platform
  ON public.video_share_links (video_id, COALESCE(platform, '__any__'))
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_video_share_links_code_active
  ON public.video_share_links (short_code, is_active)
  WHERE is_active = TRUE;

-- 分享事件表：记录分享与点击等行为
CREATE TABLE IF NOT EXISTS public.video_share_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  short_code TEXT,
  platform TEXT,
  action TEXT NOT NULL CHECK (action IN ('share', 'click', 'copy')),
  subscription_tier TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_share_events_video_action
  ON public.video_share_events (video_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_share_events_short_code
  ON public.video_share_events (short_code) WHERE short_code IS NOT NULL;

-- 自动更新时间戳
CREATE OR REPLACE FUNCTION public.set_video_share_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_share_links_updated_at ON public.video_share_links;
CREATE TRIGGER trg_video_share_links_updated_at
  BEFORE UPDATE ON public.video_share_links
  FOR EACH ROW
  EXECUTE FUNCTION public.set_video_share_links_updated_at();

-- 行级安全策略
ALTER TABLE public.video_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_share_events ENABLE ROW LEVEL SECURITY;

-- 允许视频拥有者读取自己的短链接
CREATE POLICY "视频作者可以读取自己的短链接" ON public.video_share_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.id = video_id AND v.user_id = auth.uid()
    )
  );

-- 允许视频作者创建短链接
CREATE POLICY "视频作者可以创建短链接" ON public.video_share_links
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.id = video_id AND v.user_id = auth.uid()
    )
  );

-- 允许视频作者更新/关闭自己的短链接
CREATE POLICY "视频作者可以更新短链接" ON public.video_share_links
  FOR UPDATE USING (
    created_by = auth.uid()
  ) WITH CHECK (
    created_by = auth.uid()
  );

-- 限制删除操作，仅允许作者或服务角色
CREATE POLICY "视频作者可以删除短链接" ON public.video_share_links
  FOR DELETE USING (
    created_by = auth.uid()
  );

-- 分享事件读取策略：仅允许作者或拥有 service_role key 的请求（Edge Functions 默认使用 service role）
CREATE POLICY "视频作者可以查看分享事件" ON public.video_share_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.id = video_id AND v.user_id = auth.uid()
    )
  );

-- 作者可以记录分享事件（分享按钮上报）
CREATE POLICY "视频作者可以记录分享事件" ON public.video_share_events
  FOR INSERT WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.videos v
      WHERE v.id = video_id AND v.user_id = auth.uid()
    )
  );

-- 服务角色（Edge Function）默认绕过RLS，无需额外策略

-- 提示：短链接重定向 Edge Function 将使用 service key，允许管理 click_count

-- 计数更新函数
CREATE OR REPLACE FUNCTION increment_share_click(p_link_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.video_share_links
  SET click_count = click_count + 1,
      updated_at = NOW()
  WHERE id = p_link_id;
END;
$$;

-- 确保函数对 authenticated 角色可执行
GRANT EXECUTE ON FUNCTION increment_share_click(UUID) TO authenticated;
