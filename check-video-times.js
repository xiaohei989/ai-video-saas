import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ids = ['0271fac7-e515-4d4a-b45e-447e8416cf26', '04c347fe-d4e3-40b0-8886-875777de4ba1'];

for (const id of ids) {
  const { data } = await supabase
    .from('videos')
    .select('title, created_at, updated_at, status')
    .eq('id', id)
    .single();
  
  const now = new Date();
  const created = new Date(data.created_at);
  const ageMinutes = Math.floor((now - created) / 1000 / 60);
  
  console.log(`${data.title}`);
  console.log(`  创建: ${data.created_at}`);
  console.log(`  年龄: ${ageMinutes} 分钟`);
  console.log(`  状态: ${data.status}\n`);
}
