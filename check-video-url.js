import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data } = await supabase
  .from('videos')
  .select('video_url')
  .ilike('title', '%Puppy Trampoline Party Night Vision%')
  .single();

console.log('Video URL:', data.video_url);
