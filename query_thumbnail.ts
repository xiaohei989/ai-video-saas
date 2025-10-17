import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hvkzwrnvxsleeonqqrzq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3p3cm52eHNsZWVvbnFxcnpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc2NDU2MCwiZXhwIjoyMDcxMzQwNTYwfQ.kzSgiC0WxY_MFKeLzR0gXSdDVkiTviddr1LePQjDPvI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryVideo() {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, thumbnail_url, parameters')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('查询结果:');
  console.log(JSON.stringify(data, null, 2));

  if (data && data.length > 0) {
    data.forEach((video: any) => {
      console.log('\n---');
      console.log('标题:', video.title);
      console.log('缩略图URL:', video.thumbnail_url);
      console.log('参数:', JSON.stringify(video.parameters, null, 2));

      if (video.thumbnail_url) {
        // 判断URL中是否包含9:16的特征
        if (video.thumbnail_url.includes('_9-16') || video.thumbnail_url.includes('_916') || video.thumbnail_url.includes('portrait')) {
          console.log('✅ 缩略图可能是 9:16 格式');
        } else if (video.thumbnail_url.includes('_16-9') || video.thumbnail_url.includes('_169') || video.thumbnail_url.includes('landscape')) {
          console.log('❌ 缩略图可能是 16:9 格式');
        } else {
          console.log('❓ 无法从URL判断比例，需要查看图片实际尺寸');
        }
      }
    });
  }
}

queryVideo();
