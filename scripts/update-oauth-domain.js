#!/usr/bin/env node

/**
 * OAuth域名更新脚本
 * 用于将OAuth登录域名从Supabase默认域名改为自定义域名
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.dirname(__dirname)

// 配置
const CONFIG = {
  oldDomain: 'hvkzwrnvxsleeonqqrzq.supabase.co',
  newDomain: 'api.veo3video.me', // 推荐使用子域名
  // 或者使用: 'auth.veo3video.me'
  
  // 需要更新的环境变量文件
  envFiles: [
    '.env',
    '.env.local',
    '.env.production', 
    '.env.cloudflare'
  ],
  
  // 需要检查的代码文件
  codeFiles: [
    'src/lib/supabase.ts',
    'src/contexts/AuthContext.tsx',
    'src/pages/auth/AuthCallback.tsx',
    'supabase-apple-oauth-config.md'
  ]
}

class OAuthDomainUpdater {
  constructor() {
    this.updatedFiles = []
    this.warnings = []
  }

  log(message) {
    console.log(`[OAuth域名更新] ${message}`)
  }

  warn(message) {
    console.warn(`[警告] ${message}`)
    this.warnings.push(message)
  }

  error(message) {
    console.error(`[错误] ${message}`)
  }

  // 更新环境变量文件
  updateEnvFiles() {
    this.log('开始更新环境变量文件...')
    
    CONFIG.envFiles.forEach(filename => {
      const filePath = path.join(projectRoot, filename)
      
      if (!fs.existsSync(filePath)) {
        this.warn(`环境文件 ${filename} 不存在，跳过`)
        return
      }
      
      try {
        let content = fs.readFileSync(filePath, 'utf8')
        const originalContent = content
        
        // 更新VITE_SUPABASE_URL
        const supabaseUrlRegex = /VITE_SUPABASE_URL=https:\/\/[^\\s]+/g
        const newSupabaseUrl = `VITE_SUPABASE_URL=https://${CONFIG.newDomain}`
        
        if (supabaseUrlRegex.test(content)) {
          content = content.replace(supabaseUrlRegex, newSupabaseUrl)
          this.log(`更新 ${filename} 中的 VITE_SUPABASE_URL`)
        } else {
          this.warn(`在 ${filename} 中未找到 VITE_SUPABASE_URL`)
        }
        
        // 检查是否有其他需要更新的URL引用
        if (content.includes(CONFIG.oldDomain)) {
          this.warn(`${filename} 中仍包含旧域名 ${CONFIG.oldDomain}，请手动检查`)
        }
        
        if (content !== originalContent) {
          // 创建备份
          fs.writeFileSync(`${filePath}.backup`, originalContent)
          // 写入更新后的内容
          fs.writeFileSync(filePath, content)
          this.updatedFiles.push(filename)
          this.log(`✅ 已更新 ${filename}`)
        }
        
      } catch (error) {
        this.error(`更新 ${filename} 时出错: ${error.message}`)
      }
    })
  }

  // 检查代码文件中的域名引用
  checkCodeFiles() {
    this.log('检查代码文件中的域名引用...')
    
    CONFIG.codeFiles.forEach(filename => {
      const filePath = path.join(projectRoot, filename)
      
      if (!fs.existsSync(filePath)) {
        this.warn(`代码文件 ${filename} 不存在，跳过`)
        return
      }
      
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        
        if (content.includes(CONFIG.oldDomain)) {
          this.warn(`${filename} 中包含旧域名引用，请手动检查和更新`)
          
          // 查找具体的行号
          const lines = content.split('\\n')
          lines.forEach((line, index) => {
            if (line.includes(CONFIG.oldDomain)) {
              console.log(`  第 ${index + 1} 行: ${line.trim()}`)
            }
          })
        } else {
          this.log(`✅ ${filename} 无需更新`)
        }
        
      } catch (error) {
        this.error(`检查 ${filename} 时出错: ${error.message}`)
      }
    })
  }

  // 生成DNS配置提示
  generateDNSConfig() {
    this.log('生成DNS配置说明...')
    
    const dnsConfig = `
DNS配置要求：
==============

请在您的域名DNS提供商（如Cloudflare）中添加以下CNAME记录：

类型: CNAME
名称: ${CONFIG.newDomain.replace('.veo3video.me', '').replace('veo3video.me', '@')}
值: ${CONFIG.oldDomain}
TTL: 300 (或自动)

示例（如果使用Cloudflare）：
1. 登录Cloudflare Dashboard
2. 选择域名 veo3video.me
3. 进入 DNS 设置
4. 点击 "Add record"
5. 选择类型: CNAME
6. 名称: ${CONFIG.newDomain.split('.')[0]} 
7. 目标: ${CONFIG.oldDomain}
8. 点击保存

配置完成后，请等待DNS传播（通常需要几分钟到几小时）
`
    
    console.log(dnsConfig)
    
    // 保存DNS配置说明到文件
    fs.writeFileSync(
      path.join(projectRoot, 'dns-config-instructions.txt'), 
      dnsConfig
    )
  }

  // 生成OAuth提供商更新清单
  generateOAuthUpdateChecklist() {
    const checklist = `
OAuth提供商配置更新清单：
==========================

✅ Google OAuth Console 更新：
1. 访问: https://console.cloud.google.com/apis/credentials
2. 找到您的OAuth 2.0客户端ID
3. 编辑 "已获授权的重定向URI"
4. 添加: https://${CONFIG.newDomain}/auth/v1/callback
5. 删除: https://${CONFIG.oldDomain}/auth/v1/callback
6. 保存更改

✅ Apple Developer Console 更新：
1. 访问: https://developer.apple.com/account/resources/identifiers/list/serviceId
2. 选择 Service ID: com.veo3video.webapp.web
3. 编辑 "Sign In with Apple" 配置
4. 在 "Return URLs" 中：
   - 添加: https://${CONFIG.newDomain}/auth/v1/callback
   - 删除: https://${CONFIG.oldDomain}/auth/v1/callback
5. 保存更改

✅ Supabase Dashboard 更新：
1. 访问: https://supabase.com/dashboard/project/hvkzwrnvxsleeonqqrzq/settings/general
2. 进入 "Custom domains" 部分
3. 添加自定义域名: ${CONFIG.newDomain}
4. 等待SSL证书自动配置完成
5. 测试域名可访问性

⚠️  注意事项：
- DNS配置需要时间传播，请在配置完成后等待
- 建议先在开发环境测试
- 现有用户可能需要重新登录
- 保留环境文件备份以便回滚
`
    
    console.log(checklist)
    
    // 保存到文件
    fs.writeFileSync(
      path.join(projectRoot, 'oauth-update-checklist.txt'), 
      checklist
    )
  }

  // 验证配置
  async validateConfiguration() {
    this.log('开始验证配置...')
    
    // 检查新域名的DNS解析
    try {
      const dns = await import('dns')
      const { promisify } = await import('util')
      const resolveCname = promisify(dns.resolveCname)
      
      try {
        const records = await resolveCname(CONFIG.newDomain)
        if (records.includes(CONFIG.oldDomain)) {
          this.log(`✅ DNS配置正确: ${CONFIG.newDomain} -> ${CONFIG.oldDomain}`)
        } else {
          this.warn(`DNS配置可能有问题: ${CONFIG.newDomain} 解析到 ${records.join(', ')}`)
        }
      } catch (dnsError) {
        this.warn(`DNS检查失败: ${dnsError.message}`)
        this.warn('请确保DNS记录已正确配置并传播')
      }
      
    } catch (error) {
      this.warn(`无法执行DNS检查: ${error.message}`)
    }
  }

  // 主执行方法
  async run() {
    console.log('🚀 开始OAuth域名更新过程...')
    console.log(`从: ${CONFIG.oldDomain}`)
    console.log(`到: ${CONFIG.newDomain}`)
    console.log('')
    
    // 执行更新步骤
    this.updateEnvFiles()
    console.log('')
    
    this.checkCodeFiles()
    console.log('')
    
    this.generateDNSConfig()
    console.log('')
    
    this.generateOAuthUpdateChecklist()
    console.log('')
    
    await this.validateConfiguration()
    console.log('')
    
    // 总结报告
    this.generateSummary()
  }

  generateSummary() {
    console.log('📊 更新总结:')
    console.log('=================')
    
    if (this.updatedFiles.length > 0) {
      console.log(`✅ 已更新文件 (${this.updatedFiles.length}):`)
      this.updatedFiles.forEach(file => console.log(`   - ${file}`))
    } else {
      console.log('ℹ️  没有文件需要更新')
    }
    
    if (this.warnings.length > 0) {
      console.log(`⚠️  警告 (${this.warnings.length}):`)
      this.warnings.forEach(warning => console.log(`   - ${warning}`))
    }
    
    console.log('')
    console.log('📋 后续步骤:')
    console.log('1. 配置DNS记录（参考 dns-config-instructions.txt）')
    console.log('2. 更新OAuth提供商配置（参考 oauth-update-checklist.txt）') 
    console.log('3. 在Supabase Dashboard中配置自定义域名')
    console.log('4. 测试OAuth登录功能')
    console.log('5. 如有问题，使用备份文件回滚')
    
    console.log('')
    console.log('🎯 完成后，OAuth登录将显示您的品牌域名！')
  }
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new OAuthDomainUpdater()
  updater.run().catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
}

export default OAuthDomainUpdater