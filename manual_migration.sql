-- ============================================
-- 视频队列系统 - 手动迁移脚本
-- 请在 Supabase Dashboard > SQL Editor 中执行此脚本
-- ============================================

-- 检查并添加队列相关字段到videos表
DO $$
BEGIN
    -- 添加 queue_position 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'videos' 
                   AND column_name = 'queue_position') THEN
        ALTER TABLE public.videos ADD COLUMN queue_position INTEGER;
        RAISE NOTICE 'Added queue_position column';
    END IF;

    -- 添加 queue_entered_at 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'videos' 
                   AND column_name = 'queue_entered_at') THEN
        ALTER TABLE public.videos ADD COLUMN queue_entered_at TIMESTAMPTZ;
        RAISE NOTICE 'Added queue_entered_at column';
    END IF;

    -- 添加 queue_started_at 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'videos' 
                   AND column_name = 'queue_started_at') THEN
        ALTER TABLE public.videos ADD COLUMN queue_started_at TIMESTAMPTZ;
        RAISE NOTICE 'Added queue_started_at column';
    END IF;

    -- 添加 queue_priority 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'videos' 
                   AND column_name = 'queue_priority') THEN
        ALTER TABLE public.videos ADD COLUMN queue_priority INTEGER DEFAULT 0;
        RAISE NOTICE 'Added queue_priority column';
    END IF;
END $$;

-- 检查并创建 subscriptions 表（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'subscriptions') THEN
        
        -- 创建订阅状态枚举
        DO $enum$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
                CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'premium');
                RAISE NOTICE 'Created subscription_tier enum';
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
                CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');
                RAISE NOTICE 'Created subscription_status enum';
            END IF;
        END $enum$;

        -- 创建 subscriptions 表
        CREATE TABLE public.subscriptions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            tier subscription_tier NOT NULL DEFAULT 'free',
            status subscription_status NOT NULL DEFAULT 'active',
            stripe_subscription_id TEXT UNIQUE,
            stripe_customer_id TEXT,
            current_period_start TIMESTAMPTZ,
            current_period_end TIMESTAMPTZ,
            cancel_at_period_end BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, status)
        );
        
        RAISE NOTICE 'Created subscriptions table';
        
        -- 创建索引
        CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
        CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
        
        -- 启用 RLS
        ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
        
        -- 创建 RLS 策略
        CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
            FOR SELECT USING (auth.uid() = user_id);
            
        RAISE NOTICE 'Created subscriptions table policies and indexes';
    END IF;
END $$;

-- 添加队列相关索引
DO $$
BEGIN
    -- 检查并创建索引
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'videos' AND indexname = 'idx_videos_queue_status') THEN
        CREATE INDEX idx_videos_queue_status ON public.videos(status) WHERE status IN ('pending', 'processing');
        RAISE NOTICE 'Created idx_videos_queue_status index';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'videos' AND indexname = 'idx_videos_queue_position') THEN
        CREATE INDEX idx_videos_queue_position ON public.videos(queue_position) WHERE queue_position IS NOT NULL;
        RAISE NOTICE 'Created idx_videos_queue_position index';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'videos' AND indexname = 'idx_videos_user_status') THEN
        CREATE INDEX idx_videos_user_status ON public.videos(user_id, status) WHERE status = 'processing';
        RAISE NOTICE 'Created idx_videos_user_status index';
    END IF;
END $$;

-- 添加约束
DO $$
BEGIN
    -- 添加队列位置约束（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c
                   JOIN pg_class t ON c.conrelid = t.oid
                   JOIN pg_namespace n ON t.relnamespace = n.oid
                   WHERE c.conname = 'queue_position_positive' 
                   AND t.relname = 'videos'
                   AND n.nspname = 'public') THEN
        ALTER TABLE public.videos ADD CONSTRAINT queue_position_positive 
        CHECK (queue_position IS NULL OR queue_position > 0);
        RAISE NOTICE 'Added queue_position_positive constraint';
    END IF;
END $$;

-- 创建队列管理函数
CREATE OR REPLACE FUNCTION get_user_active_video_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM public.videos 
    WHERE user_id = p_user_id 
    AND status = 'processing' 
    AND is_deleted = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(queue_position) + 1 FROM public.videos WHERE queue_position IS NOT NULL),
    1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：当视频状态从pending改变时，清理队列字段
CREATE OR REPLACE FUNCTION cleanup_queue_fields_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果状态从pending变为其他状态，清理队列字段
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.queue_position := NULL;
    NEW.queue_started_at := CASE 
      WHEN NEW.status = 'processing' THEN NOW() 
      ELSE NEW.queue_started_at 
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用触发器（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                   WHERE trigger_name = 'trigger_cleanup_queue_fields' 
                   AND event_object_table = 'videos') THEN
        CREATE TRIGGER trigger_cleanup_queue_fields
            BEFORE UPDATE OF status ON public.videos
            FOR EACH ROW
            EXECUTE FUNCTION cleanup_queue_fields_on_status_change();
        RAISE NOTICE 'Created trigger_cleanup_queue_fields trigger';
    END IF;
END $$;

-- 为所有现有用户创建默认的免费订阅（如果他们还没有订阅）
INSERT INTO public.subscriptions (user_id, tier, status)
SELECT p.id, 'free'::subscription_tier, 'active'::subscription_status
FROM public.profiles p
LEFT JOIN public.subscriptions s ON p.id = s.user_id AND s.status = 'active'
WHERE s.id IS NULL
ON CONFLICT (user_id, status) DO NOTHING;

-- 添加注释
COMMENT ON COLUMN public.videos.queue_position IS '队列中的位置，NULL表示不在队列中';
COMMENT ON COLUMN public.videos.queue_entered_at IS '进入队列的时间';
COMMENT ON COLUMN public.videos.queue_started_at IS '开始处理的时间';
COMMENT ON COLUMN public.videos.queue_priority IS '队列优先级，数值越高优先级越高';

-- 显示完成消息
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '队列系统数据库迁移完成！';
    RAISE NOTICE '已添加的功能:';
    RAISE NOTICE '- videos表队列字段 (queue_position, queue_entered_at, queue_started_at, queue_priority)';
    RAISE NOTICE '- subscriptions表 (如果之前不存在)';
    RAISE NOTICE '- 队列管理索引和约束';
    RAISE NOTICE '- 队列管理函数和触发器';
    RAISE NOTICE '- 为现有用户创建免费订阅';
    RAISE NOTICE '===========================================';
END $$;