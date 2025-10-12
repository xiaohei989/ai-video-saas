import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('videos')
  .select('*')
  .ilike('title', '%Puppy Trampoline Party Night Vision%')
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('Found video:');
  console.log('ID:', data.id);
  console.log('Title:', data.title);
  console.log('Status:', data.status);
  console.log('Migration Status:', data.migration_status);
  console.log('Created:', data.created_at);
  console.log('Processing Completed:', data.processing_completed_at);
  console.log('R2 Uploaded:', data.r2_uploaded_at);
  console.log('Thumbnail Generated:', data.thumbnail_generated_at);
  console.log('Thumbnail URL:', data.thumbnail_url);
}
