-- Fix migration_failures view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the view uses the permissions of the querying user, not the creator

-- Drop the existing view
DROP VIEW IF EXISTS public.migration_failures;

-- Recreate the view with SECURITY INVOKER
CREATE VIEW public.migration_failures
WITH (security_invoker = true)
AS
SELECT
  migration_error,
  migration_attempts,
  count(*) AS failure_count,
  max(migration_last_attempt_at) AS last_occurrence,
  array_agg(id ORDER BY migration_last_attempt_at DESC) AS recent_video_ids
FROM videos
WHERE migration_status = 'failed'
GROUP BY migration_error, migration_attempts
ORDER BY count(*) DESC;

-- Grant appropriate permissions
GRANT SELECT ON public.migration_failures TO authenticated;
GRANT SELECT ON public.migration_failures TO service_role;

-- Add comment
COMMENT ON VIEW public.migration_failures IS 'View for monitoring video migration failures. Uses SECURITY INVOKER for proper permission enforcement.';
