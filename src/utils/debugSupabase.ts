/**
 * Supabase 调试工具
 * 用于测试和调试数据库连接和权限问题
 */

import { supabase } from '@/lib/supabase'

export async function debugSupabaseConnection() {
  console.log('=== Supabase 连接调试 ===')
  
  try {
    // 1. 测试基本连接
    console.log('1. 测试基本连接...')
    const { data: connectionTest, error: connectionError } = await supabase
      .from('templates')
      .select('count')
      .limit(1)
    
    if (connectionError) {
      console.error('连接错误:', connectionError)
      return false
    }
    console.log('✅ 基本连接正常')

    // 2. 测试用户认证状态
    console.log('2. 检查用户认证状态...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('用户认证错误:', userError)
    } else {
      console.log('用户状态:', user ? `已认证 (${user.id})` : '未认证')
    }

    // 3. 测试模板查询
    console.log('3. 测试模板查询...')
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('id, name, slug, like_count')
      .limit(5)
    
    if (templatesError) {
      console.error('模板查询错误:', templatesError)
    } else {
      console.log('✅ 模板查询成功:', templates?.length, '条记录')
      console.log('模板示例:', templates?.[0])
    }

    // 4. 测试点赞表查询
    console.log('4. 测试点赞表查询...')
    const { data: likes, error: likesError } = await supabase
      .from('template_likes')
      .select('*')
      .limit(5)
    
    if (likesError) {
      console.error('❌ 点赞表查询错误:', likesError)
      console.error('错误详情:', {
        code: likesError.code,
        message: likesError.message,
        details: likesError.details,
        hint: likesError.hint
      })
    } else {
      console.log('✅ 点赞表查询成功:', likes?.length, '条记录')
    }

    // 5. 测试特定模板的点赞查询
    if (templates && templates.length > 0) {
      const templateId = templates[0].id
      console.log('5. 测试特定模板点赞查询...')
      
      const { data: specificLikes, error: specificError } = await supabase
        .from('template_likes')
        .select('id, user_id, template_id, created_at')
        .eq('template_id', templateId)
      
      if (specificError) {
        console.error('❌ 特定模板点赞查询错误:', specificError)
      } else {
        console.log('✅ 特定模板点赞查询成功:', specificLikes?.length, '条记录')
      }
    }

    return true
  } catch (error) {
    console.error('调试过程中出现异常:', error)
    return false
  }
}

export async function testLikeOperation(templateId: string) {
  console.log('=== 测试点赞操作 ===')
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.log('❌ 用户未认证，无法进行点赞操作')
      return false
    }

    console.log('用户ID:', user.id)
    console.log('模板ID:', templateId)

    // 测试查询现有点赞
    console.log('1. 查询现有点赞...')
    const { data: existingLike, error: queryError } = await supabase
      .from('template_likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('template_id', templateId)
      .single()

    if (queryError && queryError.code !== 'PGRST116') { // PGRST116 是 "not found" 错误
      console.error('❌ 查询点赞失败:', queryError)
      return false
    }

    console.log('现有点赞:', existingLike ? '已点赞' : '未点赞')

    if (existingLike) {
      // 测试取消点赞
      console.log('2. 测试取消点赞...')
      const { error: deleteError } = await supabase
        .from('template_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('template_id', templateId)

      if (deleteError) {
        console.error('❌ 取消点赞失败:', deleteError)
        return false
      }
      console.log('✅ 取消点赞成功')
    } else {
      // 测试添加点赞
      console.log('2. 测试添加点赞...')
      const { error: insertError } = await supabase
        .from('template_likes')
        .insert({
          user_id: user.id,
          template_id: templateId
        })

      if (insertError) {
        console.error('❌ 添加点赞失败:', insertError)
        return false
      }
      console.log('✅ 添加点赞成功')
    }

    return true
  } catch (error) {
    console.error('点赞操作测试异常:', error)
    return false
  }
}

// 在浏览器控制台中暴露调试函数
if (typeof window !== 'undefined') {
  (window as any).debugSupabase = debugSupabaseConnection;
  (window as any).testLikeOperation = testLikeOperation;
}