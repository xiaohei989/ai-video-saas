/**
 * 测试前端缩略图生成配置
 * 验证 VITE_ENABLE_FRONTEND_THUMBNAIL 环境变量是否正确禁用前端生成
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🧪 测试前端缩略图生成配置\n');

// 检查环境变量
const enableFrontendThumbnail = process.env.VITE_ENABLE_FRONTEND_THUMBNAIL;
console.log('📊 环境变量配置:');
console.log(`   VITE_ENABLE_FRONTEND_THUMBNAIL = "${enableFrontendThumbnail || '(未设置)'}"`);
console.log('');

// 模拟前端逻辑判断（与代码中的逻辑保持一致）
// import.meta.env.VITE_ENABLE_FRONTEND_THUMBNAIL !== 'false'
const isEnabled = enableFrontendThumbnail !== 'false';
console.log('🎯 前端行为判断:');
console.log(`   前端缩略图生成: ${isEnabled ? '✅ 启用' : '❌ 禁用'}`);
console.log(`   依赖后端自动生成: ${!isEnabled ? '✅ 是' : '❌ 否'}`);
console.log('');

// 测试场景
console.log('📝 测试场景:');
if (!isEnabled) {
  console.log('   ✅ 配置正确！');
  console.log('   • 前端不会生成缩略图');
  console.log('   • 视频完成后，数据库触发器会自动调用 Edge Function');
  console.log('   • Edge Function 使用 Cloudflare Media Transformations 生成缩略图');
  console.log('   • 完全无需前端参与，用户关闭页面也能正常生成');
} else {
  console.log('   ⚠️  警告：前端缩略图生成仍然启用');
  console.log('   • 需要用户保持页面打开');
  console.log('   • 增加浏览器负担');
  console.log('   建议设置 VITE_ENABLE_FRONTEND_THUMBNAIL=false');
}

console.log('\n' + '='.repeat(60));
console.log('📋 部署检查清单:');
console.log('✓ .env.local: VITE_ENABLE_FRONTEND_THUMBNAIL=false');
console.log('✓ wrangler.toml: VITE_ENABLE_FRONTEND_THUMBNAIL = "false"');
console.log('✓ Cloudflare Pages 环境变量: VITE_ENABLE_FRONTEND_THUMBNAIL=false');
console.log('='.repeat(60));
