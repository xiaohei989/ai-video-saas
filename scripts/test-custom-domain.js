#!/usr/bin/env node

/**
 * 自定义域名配置测试脚本
 * 用于验证OAuth域名配置是否正确
 */

import https from 'https'
import { URL } from 'url'

const CONFIG = {
  customDomain: 'api.veo3video.me',
  originalDomain: 'hvkzwrnvxsleeonqqrzq.supabase.co',
  testEndpoints: [
    '/auth/v1/settings',
    '/rest/v1/',
    '/auth/v1/authorize'
  ]
}

class DomainTester {
  constructor() {
    this.results = []
  }

  log(message) {
    console.log(`[域名测试] ${message}`)
  }

  async testHttpsRequest(domain, endpoint) {
    return new Promise((resolve) => {
      const url = `https://${domain}${endpoint}`
      const startTime = Date.now()
      
      const req = https.request(url, { timeout: 5000 }, (res) => {
        const endTime = Date.now()
        const responseTime = endTime - startTime
        
        resolve({
          success: true,
          status: res.statusCode,
          responseTime,
          headers: res.headers,
          error: null
        })
      })
      
      req.on('error', (error) => {
        const endTime = Date.now()
        const responseTime = endTime - startTime
        
        resolve({
          success: false,
          status: null,
          responseTime,
          headers: {},
          error: error.message
        })
      })
      
      req.on('timeout', () => {
        req.destroy()
        resolve({
          success: false,
          status: null,
          responseTime: 5000,
          headers: {},
          error: 'Request timeout'
        })
      })
      
      req.end()
    })
  }

  async testDomain(domain) {
    this.log(`测试域名: ${domain}`)
    const domainResults = []
    
    for (const endpoint of CONFIG.testEndpoints) {
      this.log(`  测试端点: ${endpoint}`)
      const result = await this.testHttpsRequest(domain, endpoint)
      
      domainResults.push({
        endpoint,
        ...result
      })
      
      if (result.success) {
        this.log(`    ✅ ${result.status} (${result.responseTime}ms)`)
      } else {
        this.log(`    ❌ ${result.error} (${result.responseTime}ms)`)
      }
    }
    
    return domainResults
  }

  async compareDomains() {
    console.log('🔍 开始域名配置测试...')
    console.log('')
    
    // 测试原域名
    console.log('1. 测试原始Supabase域名:')
    const originalResults = await this.testDomain(CONFIG.originalDomain)
    console.log('')
    
    // 测试自定义域名
    console.log('2. 测试自定义域名:')
    const customResults = await this.testDomain(CONFIG.customDomain)
    console.log('')
    
    // 生成对比报告
    this.generateComparisonReport(originalResults, customResults)
  }

  generateComparisonReport(originalResults, customResults) {
    console.log('📊 域名配置对比报告:')
    console.log('=' .repeat(50))
    
    const table = []
    
    CONFIG.testEndpoints.forEach((endpoint, index) => {
      const original = originalResults[index]
      const custom = customResults[index]
      
      table.push({
        endpoint,
        original: original.success ? `✅ ${original.status}` : `❌ ${original.error}`,
        custom: custom.success ? `✅ ${custom.status}` : `❌ ${custom.error}`,
        status: custom.success && original.success ? '🟢 正常' : 
                custom.success && !original.success ? '🟡 自定义域名可用' :
                !custom.success && original.success ? '🔴 自定义域名不可用' : '🔴 都不可用'
      })
    })
    
    // 打印表格
    console.log(`端点路径${' '.repeat(20)}原域名${' '.repeat(10)}自定义域名${' '.repeat(8)}状态`)
    console.log('-'.repeat(70))
    
    table.forEach(row => {
      const endpoint = row.endpoint.padEnd(25)
      const original = row.original.padEnd(15)
      const custom = row.custom.padEnd(15)
      console.log(`${endpoint} ${original} ${custom} ${row.status}`)
    })
    
    console.log('')
    
    // 生成建议
    this.generateRecommendations(customResults)
  }

  generateRecommendations(customResults) {
    const successfulTests = customResults.filter(r => r.success).length
    const totalTests = customResults.length
    
    console.log('💡 配置建议:')
    console.log('-'.repeat(30))
    
    if (successfulTests === totalTests) {
      console.log('🎉 恭喜！自定义域名配置完全正常')
      console.log('✅ 您可以安全地更新应用配置使用自定义域名')
      console.log('✅ OAuth登录将显示您的品牌域名')
    } else if (successfulTests > 0) {
      console.log(`⚠️  自定义域名部分可用 (${successfulTests}/${totalTests})`)
      console.log('🔧 建议检查:')
      console.log('   - DNS配置是否完全传播')
      console.log('   - SSL证书是否正确安装') 
      console.log('   - Supabase自定义域名配置状态')
    } else {
      console.log('❌ 自定义域名暂不可用')
      console.log('🔧 请检查:')
      console.log('   1. DNS CNAME记录是否正确配置')
      console.log('   2. 域名是否已传播（使用 nslookup 检查）')
      console.log('   3. Supabase Dashboard中自定义域名配置')
      console.log('   4. SSL证书状态')
    }
    
    console.log('')
    console.log('🔗 有用的检查命令:')
    console.log(`   nslookup ${CONFIG.customDomain}`)
    console.log(`   dig ${CONFIG.customDomain} CNAME`)
    console.log(`   curl -I https://${CONFIG.customDomain}/rest/v1/`)
  }

  async checkDNSPropagation() {
    this.log('检查DNS传播状态...')
    
    try {
      const dns = await import('dns')
      const { promisify } = await import('util')
      const resolveCname = promisify(dns.resolveCname)
      
      try {
        const records = await resolveCname(CONFIG.customDomain)
        this.log(`DNS CNAME记录: ${CONFIG.customDomain} -> ${records.join(', ')}`)
        
        if (records.includes(CONFIG.originalDomain)) {
          this.log('✅ DNS配置正确')
          return true
        } else {
          this.log('⚠️ DNS配置可能有问题')
          return false
        }
      } catch (error) {
        this.log(`❌ DNS查询失败: ${error.message}`)
        this.log('💡 可能原因: DNS记录未配置或未传播')
        return false
      }
    } catch (importError) {
      this.log('⚠️ 无法检查DNS (模块导入失败)')
      return null
    }
  }

  async run() {
    console.log(`🧪 OAuth自定义域名配置测试`)
    console.log(`自定义域名: ${CONFIG.customDomain}`)
    console.log(`原始域名: ${CONFIG.originalDomain}`)
    console.log('')
    
    // 检查DNS
    await this.checkDNSPropagation()
    console.log('')
    
    // 对比测试
    await this.compareDomains()
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new DomainTester()
  tester.run().catch(error => {
    console.error('测试失败:', error)
    process.exit(1)
  })
}

export default DomainTester