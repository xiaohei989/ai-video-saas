import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkVideoData() {
  const { data, error } = await supabase.from('videos').select('id, title, video_url, thumbnail_url').limit(3)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('视频数据样本:')
  data?.forEach(v => {
    console.log(`- ID: ${v.id}`)
    console.log(`  Title: ${v.title}`)
    console.log(`  Video URL: ${v.video_url}`)
    console.log(`  Thumbnail URL: ${v.thumbnail_url}`)
    console.log('')
  })
}

checkVideoData()