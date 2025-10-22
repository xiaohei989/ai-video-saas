#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('templates')
    .select('slug, name, preview_url, thumbnail_url')
    .order('slug', { ascending: true });

  if (error) {
    console.error('查询失败:', error);
    return;
  }

  const hasPreviewUrl = data.filter(t => t.preview_url).length;
  const noPreviewUrl = data.length - hasPreviewUrl;

  console.log('\n📊 数据库模板预览URL统计:');
  console.log('='.repeat(60));
  console.log(`总模板数: ${data.length}`);
  console.log(`有预览URL: ${hasPreviewUrl} 个 (${((hasPreviewUrl/data.length)*100).toFixed(1)}%)`);
  console.log(`无预览URL: ${noPreviewUrl} 个 (${((noPreviewUrl/data.length)*100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  if (noPreviewUrl > 0) {
    console.log('\n⚠️  缺少预览URL的模板:\n');
    data.filter(t => !t.preview_url).forEach((t, i) => {
      const nameEn = typeof t.name === 'object' ? t.name.en : t.name;
      console.log(`${i + 1}. ${t.slug} (${nameEn || 'N/A'})`);
    });
  } else {
    console.log('\n✅ 所有模板都有预览URL!');
  }

  console.log('');
})();
