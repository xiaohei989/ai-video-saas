import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

console.log('Testing Supabase connection...');
console.log('URL:', process.env.VITE_SUPABASE_URL);
console.log('Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Present' : '✗ Missing');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error, count } = await supabase
  .from('videos')
  .select('id, title', { count: 'exact' })
  .limit(1);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Success! Total videos:', count);
  console.log('Sample:', data);
}
