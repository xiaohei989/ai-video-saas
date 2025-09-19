#!/usr/bin/env node
/**
 * 月度代码健康检查脚本
 * 生成详细的代码质量报告
 */

import { exec } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function runHealthCheck() {
  console.log('🏥 开始月度代码健康检查...')
  
  const report = {
    timestamp: new Date().toISOString(),
    checks: {},
    summary: {},
    recommendations: []
  }

  try {
    // 1. TypeScript 类型检查
    console.log('🔍 运行 TypeScript 类型检查...')
    try {
      const { stdout: tscOutput } = await execAsync('npm run type-check')
      report.checks.typescript = { 
        status: 'passed', 
        details: 'No type errors found' 
      }
    } catch (error) {
      const errorCount = (error.stdout.match(/error TS\d+/g) || []).length
      report.checks.typescript = { 
        status: 'failed', 
        errorCount,
        details: error.stdout 
      }
    }

    // 2. 死代码检测
    console.log('🧹 运行死代码检测...')
    try {
      const { stdout: knipOutput } = await execAsync('npm run dead-code:knip')
      report.checks.knip = { 
        status: 'passed', 
        output: knipOutput 
      }
    } catch (error) {
      report.checks.knip = { 
        status: 'issues_found', 
        output: error.stdout 
      }
    }

    try {
      const { stdout: pruneOutput } = await execAsync('npm run dead-code:prune')
      const unusedExports = pruneOutput.split('\n').filter(line => line.trim()).length
      report.checks.unusedExports = { 
        count: unusedExports,
        status: unusedExports > 500 ? 'warning' : 'acceptable',
        details: unusedExports > 500 ? '未使用导出数量过多，建议清理' : '未使用导出数量在可接受范围内'
      }
    } catch (error) {
      report.checks.unusedExports = { 
        status: 'error', 
        details: error.message 
      }
    }

    // 3. 依赖检查
    console.log('📦 检查依赖包健康状态...')
    try {
      const { stdout: auditOutput } = await execAsync('npm audit --json')
      const auditData = JSON.parse(auditOutput)
      report.checks.security = {
        vulnerabilities: auditData.metadata?.vulnerabilities || {},
        status: auditData.metadata?.vulnerabilities?.total > 0 ? 'warning' : 'passed'
      }
    } catch (error) {
      report.checks.security = { 
        status: 'error', 
        details: 'Unable to run security audit' 
      }
    }

    // 4. Bundle 大小检查
    console.log('📊 检查构建大小...')
    try {
      const { stdout: buildOutput } = await execAsync('npm run build')
      const bundleSizeMatch = buildOutput.match(/build\/assets\/index-\w+\.js\s+([\d,]+\.\d+)\s+kB/)
      if (bundleSizeMatch) {
        const bundleSize = parseFloat(bundleSizeMatch[1].replace(',', ''))
        report.checks.bundleSize = {
          size: bundleSize,
          status: bundleSize > 4000 ? 'warning' : 'good',
          details: bundleSize > 4000 ? 'Bundle 大小过大，建议优化' : 'Bundle 大小在合理范围内'
        }
      }
    } catch (error) {
      report.checks.bundleSize = { 
        status: 'error', 
        details: 'Build failed' 
      }
    }

    // 5. 生成总结和建议
    report.summary = generateSummary(report.checks)
    report.recommendations = generateRecommendations(report.checks)

    // 保存报告
    const reportPath = `health-reports/health-check-${new Date().toISOString().split('T')[0]}.json`
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    // 生成 Markdown 报告
    const markdownReport = generateMarkdownReport(report)
    writeFileSync(reportPath.replace('.json', '.md'), markdownReport)

    console.log('✅ 健康检查完成！')
    console.log(`📊 报告已保存到: ${reportPath}`)
    
    return report

  } catch (error) {
    console.error('❌ 健康检查失败:', error)
    throw error
  }
}

function generateSummary(checks) {
  const total = Object.keys(checks).length
  const passed = Object.values(checks).filter(check => check.status === 'passed').length
  const warnings = Object.values(checks).filter(check => check.status === 'warning').length
  const errors = Object.values(checks).filter(check => check.status === 'error' || check.status === 'failed').length

  return {
    total,
    passed,
    warnings,
    errors,
    score: Math.round((passed / total) * 100)
  }
}

function generateRecommendations(checks) {
  const recommendations = []

  if (checks.typescript?.status === 'failed') {
    recommendations.push('🔧 修复 TypeScript 类型错误以提升代码质量')
  }

  if (checks.unusedExports?.count > 400) {
    recommendations.push('🧹 运行死代码清理以减少代码库大小')
  }

  if (checks.security?.vulnerabilities?.total > 0) {
    recommendations.push('🔒 更新依赖包以修复安全漏洞')
  }

  if (checks.bundleSize?.size > 4000) {
    recommendations.push('📦 优化 bundle 大小，考虑代码分割和懒加载')
  }

  if (recommendations.length === 0) {
    recommendations.push('🎉 代码健康状况良好，继续保持！')
  }

  return recommendations
}

function generateMarkdownReport(report) {
  const { timestamp, checks, summary, recommendations } = report
  
  return `# 代码健康检查报告

**生成时间**: ${new Date(timestamp).toLocaleString('zh-CN')}

## 📊 总体评分: ${summary.score}/100

- ✅ 通过: ${summary.passed}/${summary.total}
- ⚠️ 警告: ${summary.warnings}
- ❌ 错误: ${summary.errors}

## 🔍 检查详情

### TypeScript 类型检查
- **状态**: ${checks.typescript?.status === 'passed' ? '✅ 通过' : '❌ 失败'}
- **详情**: ${checks.typescript?.details || 'N/A'}

### 死代码检测
- **状态**: ${checks.unusedExports?.status === 'acceptable' ? '✅ 良好' : '⚠️ 需要关注'}
- **未使用导出**: ${checks.unusedExports?.count || 'N/A'}
- **详情**: ${checks.unusedExports?.details || 'N/A'}

### 安全检查
- **状态**: ${checks.security?.status === 'passed' ? '✅ 安全' : '⚠️ 有漏洞'}
- **漏洞数量**: ${checks.security?.vulnerabilities?.total || 0}

### Bundle 大小
- **状态**: ${checks.bundleSize?.status === 'good' ? '✅ 良好' : '⚠️ 过大'}
- **大小**: ${checks.bundleSize?.size || 'N/A'} kB
- **详情**: ${checks.bundleSize?.details || 'N/A'}

## 💡 建议

${recommendations.map(rec => `- ${rec}`).join('\n')}

---
*报告由自动化健康检查脚本生成*
`
}

// 确保目录存在
import { mkdirSync } from 'fs'
try {
  mkdirSync('health-reports', { recursive: true })
} catch (error) {
  // 目录已存在
}

// 运行检查
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthCheck().catch(console.error)
}

export default runHealthCheck