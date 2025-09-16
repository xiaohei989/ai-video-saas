/**
 * 使用Node.js和S3 SDK配置R2 CORS
 * 替代AWS CLI的解决方案
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'

// 配置
const config = {
  accountId: process.env.VITE_CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.VITE_CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  bucketName: process.env.VITE_CLOUDFLARE_R2_BUCKET_NAME || 'ai-video-storage'
}

console.log('🔧 ========== R2 CORS配置 ==========')
console.log('📋 配置检查:')
console.log(`  Account ID: ${config.accountId ? '✅' : '❌'}`)
console.log(`  Access Key: ${config.accessKeyId ? '✅' : '❌'}`)
console.log(`  Secret Key: ${config.secretAccessKey ? '✅' : '❌'}`)
console.log(`  Bucket Name: ${config.bucketName}`)
console.log('')

if (!config.accountId || !config.accessKeyId || !config.secretAccessKey) {
  console.error('❌ 错误: 缺少必要的环境变量')
  console.log('请确保设置了以下环境变量:')
  console.log('- VITE_CLOUDFLARE_ACCOUNT_ID')
  console.log('- VITE_CLOUDFLARE_R2_ACCESS_KEY_ID')
  console.log('- VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY')
  process.exit(1)
}

// 初始化R2客户端
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
})

// CORS配置
const corsConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://veo3video.me',
        'https://*.veo3video.me',
        'https://ai-video-saas.pages.dev'
      ],
      AllowedMethods: [
        'GET',
        'PUT', 
        'POST',
        'DELETE',
        'HEAD'
      ],
      AllowedHeaders: [
        '*'
      ],
      ExposeHeaders: [
        'ETag',
        'x-amz-request-id',
        'x-amz-id-2'
      ],
      MaxAgeSeconds: 3600
    }
  ]
}

async function configureCORS() {
  try {
    // 1. 应用CORS配置
    console.log('🚀 应用CORS配置到R2存储桶...')
    
    const putCommand = new PutBucketCorsCommand({
      Bucket: config.bucketName,
      CORSConfiguration: corsConfiguration
    })
    
    await r2Client.send(putCommand)
    console.log('✅ CORS配置成功应用')
    console.log('')
    
    // 2. 验证CORS配置
    console.log('🔍 验证CORS配置...')
    
    const getCommand = new GetBucketCorsCommand({
      Bucket: config.bucketName
    })
    
    const response = await r2Client.send(getCommand)
    console.log('✅ CORS配置验证成功')
    console.log('')
    console.log('📋 当前CORS配置:')
    console.log(JSON.stringify(response.CORSConfiguration, null, 2))
    console.log('')
    
    // 3. 配置总结
    console.log('🎉 ========== 配置总结 ==========')
    console.log('✅ CORS规则已成功应用到存储桶')
    console.log('📝 配置详情:')
    console.log('   - 允许的域名: localhost, veo3video.me, pages.dev')
    console.log('   - 允许的方法: GET, PUT, POST, DELETE, HEAD')
    console.log('   - 允许的头部: 所有 (*)')
    console.log('   - 缓存时间: 3600秒 (1小时)')
    console.log('')
    console.log('🧪 现在可以测试预签名URL上传功能')
    
    return { success: true }
    
  } catch (error) {
    console.error('💥 CORS配置失败:', error.message)
    console.log('')
    console.log('🔍 故障排除建议:')
    console.log('1. 检查环境变量是否正确设置')
    console.log('2. 验证R2 API密钥权限')
    console.log('3. 确认存储桶名称正确')
    console.log('4. 检查网络连接')
    
    return { success: false, error: error.message }
  }
}

// 运行配置
configureCORS()
  .then(result => {
    process.exit(result.success ? 0 : 1)
  })
  .catch(error => {
    console.error('配置执行异常:', error)
    process.exit(1)
  })