import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

console.log('🔍 检查点赞数据是否重复定义...')

// 1. 检查模板表结构
console.log('\n📊 检查templates表的点赞相关字段:')
const { data: templates, error: templatesError } = await supabase
  .from('templates')
  .select('id, slug, like_count')
  .limit(5)

if (templatesError) {
  console.error('❌ templates表查询错误:', templatesError)
} else {
  console.log('templates表结构包含 like_count 字段:')
  templates?.forEach(t => {
    console.log(`  - ${t.slug}: like_count = ${t.like_count}`)
  })
}

// 2. 检查template_likes表结构
console.log('\n📊 检查template_likes表结构:')
const { data: templateLikes, error: likesError } = await supabase
  .from('template_likes')
  .select('*')
  .limit(3)

if (likesError) {
  console.error('❌ template_likes表查询错误:', likesError)
} else {
  console.log('template_likes表字段结构:')
  if (templateLikes && templateLikes.length > 0) {
    console.log('字段:', Object.keys(templateLikes[0]))
    console.log('示例数据:', templateLikes[0])
  }
}

// 3. 检查是否有其他点赞相关表
console.log('\n🔍 检查是否还有其他点赞相关的表...')

// 尝试查询可能的其他表
const possibleTables = ['likes', 'user_likes', 'template_user_likes', 'post_likes']

for (const tableName of possibleTables) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)
    
    if (!error && data) {
      console.log(`✅ 找到表: ${tableName}`)
      if (data.length > 0) {
        console.log(`  字段:`, Object.keys(data[0]))
      }
    }
  } catch (e) {
    // 表不存在，忽略
  }
}

// 4. 分析数据重复情况
console.log('\n🧮 分析点赞数据的重复定义问题:')
console.log('发现的问题:')
console.log('1. templates表有 like_count 字段 - 用于存储聚合的点赞总数')
console.log('2. template_likes表存储具体的点赞记录 - 用于追踪谁点了赞')
console.log('3. 这两个数据应该保持同步，但目前不同步')

console.log('\n💡 建议的解决方案:')
console.log('- templates.like_count 应该等于对应 template_likes 记录的数量')
console.log('- 需要一个同步机制来保持数据一致性')
console.log('- 可以通过触发器或定期任务来维护同步')