import { Plugin } from 'vite'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface StripeSyncOptions {
  enabled?: boolean
  mode?: 'test' | 'production' | 'auto'
  projectRef?: string
  accessToken?: string
}

/**
 * Vite 插件：编译时自动同步 Stripe 环境变量到 Supabase
 *
 * 功能:
 * - 自动读取 .env 文件中的 Stripe 配置
 * - 智能检测测试/生产模式 (优先检查密钥前缀以防止配置错误)
 * - 仅在配置变更时同步,避免重复操作
 * - 验证配置完整性
 *
 * 使用方法:
 * 1. 在 vite.config.ts 中启用插件
 * 2. 修改 .env 文件中的 Stripe 配置
 * 3. 启动 npm run dev,插件会自动同步到 Supabase
 *
 * 注意:
 * - 插件会优先检查 STRIPE_SECRET_KEY 的前缀来判断模式
 * - sk_live_* 密钥会被识别为 production 模式
 * - sk_test_* 密钥会被识别为 test 模式
 * - 这个优先级设计可以防止误用生产密钥在测试环境
 */
export function stripeSyncPlugin(options: StripeSyncOptions = {}): Plugin {
  const {
    enabled = true,
    mode = 'auto',
    projectRef = 'hvkzwrnvxsleeonqqrzq',
    accessToken = 'sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb'
  } = options

  let hasSync = false // 防止重复同步

  return {
    name: 'vite-plugin-stripe-sync',

    configResolved(config) {
      if (!enabled) {
        console.log('[STRIPE SYNC] ⏭️  插件已禁用')
        return
      }

      if (hasSync) {
        console.log('[STRIPE SYNC] ⏭️  已同步过，跳过')
        return
      }

      try {
        console.log('[STRIPE SYNC] 🚀 开始检测 Stripe 环境变量...')

        // 读取 .env 文件
        const envPath = path.join(config.root, '.env')
        if (!fs.existsSync(envPath)) {
          console.log('[STRIPE SYNC] ⚠️  未找到 .env 文件')
          return
        }

        const envContent = fs.readFileSync(envPath, 'utf-8')
        const env: Record<string, string> = {}

        // 解析 .env 文件
        envContent.split('\n').forEach(line => {
          line = line.trim()
          if (!line || line.startsWith('#')) return

          const match = line.match(/^([^=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            let value = match[2].trim()
            value = value.replace(/^["']|["']$/g, '')
            env[key] = value
          }
        })

        // 检测 Stripe 模式
        const detectedMode = detectStripeMode(env, mode)
        console.log(`[STRIPE SYNC] 🔍 检测到模式: ${detectedMode}`)

        // 获取 Stripe 配置
        const stripeConfig = getStripeConfig(env, detectedMode)

        // 验证配置
        const errors = validateConfig(stripeConfig, detectedMode)
        if (errors.length > 0) {
          console.log('[STRIPE SYNC] ❌ 配置验证失败:')
          errors.forEach(err => console.log(`  - ${err}`))
          return
        }

        // 检查是否需要同步
        if (!needsSync(stripeConfig, projectRef, accessToken)) {
          console.log('[STRIPE SYNC] ✅ Supabase 配置已是最新，无需同步')
          hasSync = true
          return
        }

        // 同步到 Supabase
        console.log(`[STRIPE SYNC] 📤 同步配置到 Supabase (${detectedMode} 模式)...`)
        syncToSupabase(stripeConfig, projectRef, accessToken)

        console.log('[STRIPE SYNC] ✨ 同步完成！')
        hasSync = true

      } catch (error: any) {
        console.error('[STRIPE SYNC] ❌ 同步失败:', error.message)
      }
    }
  }
}

// 检测 Stripe 模式
function detectStripeMode(env: Record<string, string>, mode: string): 'test' | 'production' {
  if (mode === 'test') return 'test'
  if (mode === 'production') return 'production'

  // 自动检测
  const stripeMode = env.VITE_STRIPE_MODE || env.STRIPE_MODE
  if (stripeMode === 'production') return 'production'

  const secretKey = env.STRIPE_SECRET_KEY
  if (secretKey) {
    if (secretKey.startsWith('sk_live_')) return 'production'
    if (secretKey.startsWith('sk_test_')) return 'test'
  }

  return 'test' // 默认测试模式
}

// 获取 Stripe 配置
function getStripeConfig(env: Record<string, string>, mode: 'test' | 'production') {
  const config: Record<string, string> = {
    STRIPE_MODE: mode
  }

  if (mode === 'production') {
    config.STRIPE_SECRET_KEY = env.STRIPE_PROD_SECRET_KEY || env.STRIPE_SECRET_KEY || ''
    config.STRIPE_WEBHOOK_SIGNING_SECRET = env.STRIPE_WEBHOOK_SIGNING_SECRET || ''

    config.VITE_STRIPE_BASIC_PRICE_ID = env.VITE_STRIPE_PROD_BASIC_PRICE_ID || ''
    config.VITE_STRIPE_PRO_PRICE_ID = env.VITE_STRIPE_PROD_PRO_PRICE_ID || ''
    config.VITE_STRIPE_ENTERPRISE_PRICE_ID = env.VITE_STRIPE_PROD_ENTERPRISE_PRICE_ID || ''
    config.VITE_STRIPE_BASIC_ANNUAL_PRICE_ID = env.VITE_STRIPE_PROD_BASIC_ANNUAL_PRICE_ID || ''
    config.VITE_STRIPE_PRO_ANNUAL_PRICE_ID = env.VITE_STRIPE_PROD_PRO_ANNUAL_PRICE_ID || ''
    config.VITE_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID = env.VITE_STRIPE_PROD_ENTERPRISE_ANNUAL_PRICE_ID || ''
  } else {
    config.STRIPE_SECRET_KEY = env.STRIPE_TEST_SECRET_KEY || env.STRIPE_SECRET_KEY || ''
    config.STRIPE_WEBHOOK_SIGNING_SECRET = env.STRIPE_WEBHOOK_SIGNING_SECRET || ''

    config.VITE_STRIPE_BASIC_PRICE_ID = env.VITE_STRIPE_TEST_BASIC_PRICE_ID || env.VITE_STRIPE_BASIC_PRICE_ID || ''
    config.VITE_STRIPE_PRO_PRICE_ID = env.VITE_STRIPE_TEST_PRO_PRICE_ID || env.VITE_STRIPE_PRO_PRICE_ID || ''
    config.VITE_STRIPE_ENTERPRISE_PRICE_ID = env.VITE_STRIPE_TEST_ENTERPRISE_PRICE_ID || env.VITE_STRIPE_ENTERPRISE_PRICE_ID || ''
    config.VITE_STRIPE_BASIC_ANNUAL_PRICE_ID = env.VITE_STRIPE_TEST_BASIC_ANNUAL_PRICE_ID || env.VITE_STRIPE_BASIC_ANNUAL_PRICE_ID || ''
    config.VITE_STRIPE_PRO_ANNUAL_PRICE_ID = env.VITE_STRIPE_TEST_PRO_ANNUAL_PRICE_ID || env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID || ''
    config.VITE_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID = env.VITE_STRIPE_TEST_ENTERPRISE_ANNUAL_PRICE_ID || env.VITE_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID || ''
  }

  return config
}

// 验证配置
function validateConfig(config: Record<string, string>, mode: string): string[] {
  const errors: string[] = []

  if (!config.STRIPE_SECRET_KEY) {
    errors.push('缺少 STRIPE_SECRET_KEY')
  } else {
    if (mode === 'production' && !config.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      errors.push('生产模式应使用 sk_live_ 开头的密钥')
    }
    if (mode === 'test' && !config.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      errors.push('测试模式应使用 sk_test_ 开头的密钥')
    }
  }

  const priceIds = [
    'VITE_STRIPE_BASIC_PRICE_ID',
    'VITE_STRIPE_PRO_PRICE_ID',
    'VITE_STRIPE_ENTERPRISE_PRICE_ID',
    'VITE_STRIPE_BASIC_ANNUAL_PRICE_ID',
    'VITE_STRIPE_PRO_ANNUAL_PRICE_ID',
    'VITE_STRIPE_ENTERPRISE_ANNUAL_PRICE_ID'
  ]

  priceIds.forEach(key => {
    if (!config[key]) {
      errors.push(`缺少 ${key}`)
    }
  })

  return errors
}

// 检查是否需要同步
function needsSync(config: Record<string, string>, projectRef: string, accessToken: string): boolean {
  try {
    // 获取当前 Supabase 中的配置
    const command = `export SUPABASE_ACCESS_TOKEN="${accessToken}" && npx supabase secrets list --project-ref ${projectRef}`
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' })

    // 检查关键配置是否一致
    const keyToCheck = 'STRIPE_MODE'
    const currentMode = config[keyToCheck]

    if (output.includes(`${keyToCheck}=${currentMode}`)) {
      // 模式一致，假设其他配置也一致（避免频繁同步）
      return false
    }

    return true
  } catch (error) {
    // 如果获取失败，保守起见进行同步
    return true
  }
}

// 同步到 Supabase
function syncToSupabase(config: Record<string, string>, projectRef: string, accessToken: string) {
  const secrets = Object.entries(config)
    .filter(([_, value]) => value) // 过滤空值
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')

  const command = `export SUPABASE_ACCESS_TOKEN="${accessToken}" && npx supabase secrets set ${secrets} --project-ref ${projectRef}`

  try {
    execSync(command, { stdio: 'inherit', shell: '/bin/bash' })
  } catch (error: any) {
    throw new Error(`同步失败: ${error.message}`)
  }
}