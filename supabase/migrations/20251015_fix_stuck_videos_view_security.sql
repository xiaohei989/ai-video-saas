-- Fix stuck_videos view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the view uses the permissions of the querying user, not the creator

-- Drop the existing view
DROP VIEW IF EXISTS public.stuck_videos;

-- Recreate the view with SECURITY INVOKER
CREATE VIEW public.stuck_videos
WITH (security_invoker = true)
AS
SELECT
  id,
  title,
  status,
  migration_status,
  EXTRACT(epoch FROM now() - updated_at) / 60::numeric AS stuck_minutes,
  created_at,
  updated_at,
  migration_attempts,
  migration_error,
  video_url IS NOT NULL AS has_video,
  r2_url IS NOT NULL AS has_r2
FROM videos
WHERE migration_status = ANY (ARRAY['pending'::text, 'downloading'::text, 'uploading'::text])
  AND status = 'completed'::video_status
  AND (EXTRACT(epoch FROM now() - updated_at) / 60::numeric) > 5::numeric
ORDER BY updated_at;

-- Grant appropriate permissions
GRANT SELECT ON public.stuck_videos TO authenticated;
GRANT SELECT ON public.stuck_videos TO service_role;

-- Add comment
COMMENT ON VIEW public.stuck_videos IS 'View for identifying videos stuck in migration process. Uses SECURITY INVOKER for proper permission enforcement.';
