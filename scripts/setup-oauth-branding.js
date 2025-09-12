#!/usr/bin/env node

/**
 * OAuth品牌化设置指南脚本
 * 帮助用户配置Google OAuth的品牌显示
 */

import fs from 'fs'
import path from 'path'

const CONFIG = {
  appName: 'Veo3Video',
  domain: 'veo3video.me',
  logoPath: './public/logo.png', // 假设Logo路径
}

class OAuthBrandingHelper {
  constructor() {
    this.instructions = []
  }

  log(message) {
    console.log(`[OAuth品牌化] ${message}`)
  }

  generateGoogleConsoleInstructions() {
    const instructions = `
🎨 Google OAuth品牌化配置指南
================================

📍 目标：让Google登录显示 "${CONFIG.appName}" 而不是复杂的域名

🔗 访问链接：
https://console.cloud.google.com/apis/credentials/consent

📋 配置步骤：

1️⃣ **OAuth同意屏幕基本信息**：
   ✅ 应用名称: ${CONFIG.appName}
   ✅ 用户支持电子邮件: 您的邮箱
   ✅ 应用徽标: 上传您的Logo (建议尺寸: 120x120px)

2️⃣ **应用域名信息**：
   ✅ 应用首页链接: https://${CONFIG.domain}
   ✅ 应用隐私政策链接: https://${CONFIG.domain}/privacy
   ✅ 应用服务条款链接: https://${CONFIG.domain}/terms
   ✅ 已获授权的域名: 
      - ${CONFIG.domain}
      - hvkzwrnvxsleeonqqrzq.supabase.co

3️⃣ **范围配置**：
   ✅ 添加范围: 
      - .../auth/userinfo.email
      - .../auth/userinfo.profile

4️⃣ **测试用户**（开发阶段）：
   ✅ 添加您的测试邮箱地址

💡 配置完成后的效果：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 Google 登录
   [您的Logo] ${CONFIG.appName} 想要访问您的 Google 帐号
   这将允许 ${CONFIG.appName} 执行以下操作：
   • 查看您的电子邮件地址
   • 查看您的个人信息
   
   [继续] [取消]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ 预计配置时间：5分钟
🚀 生效时间：立即生效
`

    console.log(instructions)
    return instructions
  }

  generateAppleBrandingInstructions() {
    const instructions = `
🍎 Apple OAuth品牌化配置指南
===============================

📍 Apple的品牌显示相对简单，主要通过App名称显示

🔗 访问链接：
https://developer.apple.com/account/resources/identifiers/list

📋 配置步骤：

1️⃣ **App ID配置**：
   ✅ 确保App ID描述清晰
   ✅ 描述: "${CONFIG.appName} - AI Video Generation Platform"

2️⃣ **Service ID配置**：
   ✅ 描述: ${CONFIG.appName}
   ✅ 标识符: com.veo3video.webapp.web

💡 Apple登录显示效果：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 使用Apple登录
   
   [Apple Logo] 继续使用Apple登录 ${CONFIG.appName}
   
   ${CONFIG.appName} 将能够查看您的姓名和电子邮件地址。
   
   [继续使用Apple登录] [取消]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`

    console.log(instructions)
    return instructions
  }

  checkLogoFile() {
    if (fs.existsSync(CONFIG.logoPath)) {
      this.log(`✅ 找到Logo文件: ${CONFIG.logoPath}`)
      return true
    } else {
      this.log(`⚠️ 未找到Logo文件: ${CONFIG.logoPath}`)
      this.log('💡 建议准备一个 120x120px 的Logo文件用于Google OAuth')
      return false
    }
  }

  generateBrandingChecklist() {
    const checklist = `
✅ OAuth品牌化配置检查清单
========================

🎨 **品牌素材准备**：
- [ ] 应用Logo (建议120x120px PNG格式)
- [ ] 应用名称确定: ${CONFIG.appName}
- [ ] 隐私政策页面已创建
- [ ] 服务条款页面已创建

🔧 **Google OAuth配置**：
- [ ] 访问Google Cloud Console OAuth同意屏幕
- [ ] 设置应用名称为: ${CONFIG.appName}
- [ ] 上传应用Logo
- [ ] 配置应用首页链接: https://${CONFIG.domain}
- [ ] 配置隐私政策链接
- [ ] 配置服务条款链接
- [ ] 添加授权域名: ${CONFIG.domain}
- [ ] 保存配置

🍎 **Apple OAuth配置**：
- [ ] 访问Apple Developer Console
- [ ] 确认Service ID描述为: ${CONFIG.appName}
- [ ] 验证配置正确

🧪 **测试验证**：
- [ ] 测试Google OAuth登录
- [ ] 确认显示品牌名称而非域名
- [ ] 测试Apple OAuth登录
- [ ] 确认用户体验良好

🎯 **预期效果**：
用户在OAuth登录时将看到专业的品牌名称和Logo，
而不是复杂的技术域名，大大提升用户信任度。
`

    console.log(checklist)
    
    // 保存检查清单到文件
    fs.writeFileSync(
      path.join(process.cwd(), 'oauth-branding-checklist.txt'),
      checklist
    )
    
    return checklist
  }

  async run() {
    console.log('🎨 OAuth品牌化配置助手')
    console.log(`应用名称: ${CONFIG.appName}`)
    console.log(`域名: ${CONFIG.domain}`)
    console.log('')
    
    // 检查Logo文件
    this.checkLogoFile()
    console.log('')
    
    // 生成Google配置指南
    this.generateGoogleConsoleInstructions()
    console.log('')
    
    // 生成Apple配置指南
    this.generateAppleBrandingInstructions()
    console.log('')
    
    // 生成检查清单
    this.generateBrandingChecklist()
    
    console.log('')
    console.log('📋 说明：')
    console.log('- 所有配置文件已保存到项目根目录')
    console.log('- 建议先配置Google OAuth，因为使用更频繁')
    console.log('- 配置完成后立即生效，无需重启应用')
    console.log('- 这种方案无技术风险，只是品牌展示优化')
  }
}

// 运行助手
if (import.meta.url === `file://${process.argv[1]}`) {
  const helper = new OAuthBrandingHelper()
  helper.run().catch(error => {
    console.error('品牌化配置助手运行失败:', error)
    process.exit(1)
  })
}

export default OAuthBrandingHelper