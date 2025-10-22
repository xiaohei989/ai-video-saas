#!/usr/bin/env node
/**
 * 视频查询工具
 * 用法:
 *   node scripts/query_video.js "视频标题"
 *   node scripts/query_video.js --id "video-id"
 *   node scripts/query_video.js --title "部分标题"
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 缺少环境变量: VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 使用 service role key 绕过 RLS
const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * 格式化显示视频信息
 */
function displayVideo(video, index = null) {
  const header = index !== null ? `视频 ${index}` : '视频信息';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${header}`);
  console.log('='.repeat(60));
  console.log('📌 ID:', video.id);
  console.log('📝 标题:', video.title || '(无标题)');
  console.log('⏰ 创建时间:', new Date(video.created_at).toLocaleString('zh-CN'));
  console.log('📊 状态:', video.status);
  console.log('📐 宽高比:', video.parameters?.aspectRatio || '未设置');
  console.log('🎬 视频URL:', video.video_url || '无');
  console.log('🖼️  缩略图URL:', video.thumbnail_url || '无');
  console.log('🎨 缩略图状态:', video.thumbnail_generation_status || '未设置');

  if (video.error_message) {
    console.log('\n❌ 错误信息:');
    console.log(video.error_message);
  }

  if (video.parameters) {
    console.log('\n📦 完整 Parameters:');
    console.log(JSON.stringify(video.parameters, null, 2));
  }
}

/**
 * 根据ID查询视频
 */
async function queryById(id) {
  console.log(`🔍 正在查询视频 ID: ${id}\n`);

  const { data, error } = await supabase
    .from('videos')
    .select('id, title, status, video_url, thumbnail_url, thumbnail_generation_status, error_message, parameters, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error) {
    console.error('❌ 查询错误:', error.message);
    return null;
  }

  if (data) {
    displayVideo(data);
    return data;
  } else {
    console.log('❌ 未找到该视频');
    return null;
  }
}

/**
 * 根据标题查询视频
 */
async function queryByTitle(title, exact = false) {
  console.log(`🔍 正在查询标题${exact ? '(精确)' : '(模糊)'}: ${title}\n`);

  let query = supabase
    .from('videos')
    .select('id, title, status, video_url, thumbnail_url, thumbnail_generation_status, error_message, parameters, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (exact) {
    query = query.eq('title', title);
  } else {
    query = query.ilike('title', `%${title}%`);
  }

  const { data, error } = await query.limit(10);

  if (error) {
    console.error('❌ 查询错误:', error.message);
    return [];
  }

  if (data && data.length > 0) {
    console.log(`✅ 找到 ${data.length} 个匹配的视频:\n`);
    data.forEach((video, i) => displayVideo(video, i + 1));
    return data;
  } else {
    console.log('❌ 未找到匹配的视频');
    return [];
  }
}

/**
 * 列出最近的视频
 */
async function listRecent(limit = 10) {
  console.log(`🔍 正在查询最近的 ${limit} 个视频\n`);

  const { data, error, count } = await supabase
    .from('videos')
    .select('id, title, status, video_url, thumbnail_url, thumbnail_generation_status, error_message, parameters, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ 查询错误:', error.message);
    return [];
  }

  console.log(`📊 数据库中共有 ${count} 个视频`);
  console.log(`显示最近的 ${data.length} 个:\n`);

  if (data && data.length > 0) {
    data.forEach((video, i) => displayVideo(video, i + 1));
    return data;
  } else {
    console.log('❌ 数据库中没有视频');
    return [];
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📖 视频查询工具使用说明
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

用法:
  node scripts/query_video.js "视频标题"              # 模糊搜索标题
  node scripts/query_video.js --id <video-id>        # 根据ID查询
  node scripts/query_video.js --title "标题"         # 模糊搜索标题
  node scripts/query_video.js --exact "完整标题"     # 精确搜索标题
  node scripts/query_video.js --recent [数量]        # 列出最近的视频(默认10个)

示例:
  node scripts/query_video.js "Cozy Firelight"
  node scripts/query_video.js --id "0b72ade8-675f-487f-bfef-f2b9748e001f"
  node scripts/query_video.js --exact "Cozy Firelight Charm with a Smile"
  node scripts/query_video.js --recent 20

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
    process.exit(0);
  }

  // 解析参数
  if (args[0] === '--id' && args[1]) {
    await queryById(args[1]);
  } else if (args[0] === '--title' && args[1]) {
    await queryByTitle(args[1], false);
  } else if (args[0] === '--exact' && args[1]) {
    await queryByTitle(args[1], true);
  } else if (args[0] === '--recent') {
    const limit = args[1] ? parseInt(args[1]) : 10;
    await listRecent(limit);
  } else {
    // 默认模糊搜索标题
    await queryByTitle(args.join(' '), false);
  }
}

main().catch(console.error);
