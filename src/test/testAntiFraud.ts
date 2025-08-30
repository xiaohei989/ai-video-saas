/**
 * 防刷机制测试脚本
 * 用于验证IP限制、设备指纹、邀请速率限制等功能
 */

import { supabase } from '@/lib/supabase'
import { validateEmailAsync } from '@/services/emailValidator'
import { generateDeviceFingerprintHash, detectAutomation } from '@/utils/deviceFingerprint'

interface TestResult {
  testName: string
  success: boolean
  message: string
  data?: any
}

class AntiFraudTester {
  private results: TestResult[] = []

  private addResult(testName: string, success: boolean, message: string, data?: any) {
    this.results.push({ testName, success, message, data })
    console.log(`[${success ? '✅' : '❌'}] ${testName}: ${message}`)
    if (data) {
      console.log('  Data:', data)
    }
  }

  /**
   * 测试IP注册限制
   */
  async testIPRegistrationLimit() {
    try {
      const testIP = '192.168.1.100'
      
      // 测试正常情况
      const { data: normalCheck, error } = await supabase.rpc('check_ip_registration_limit', {
        p_ip_address: testIP,
        p_time_window_hours: 24,
        p_max_registrations: 5
      })

      if (error) {
        this.addResult('IP注册限制检查', false, `数据库错误: ${error.message}`)
        return
      }

      if (normalCheck && normalCheck.length > 0) {
        const result = normalCheck[0]
        this.addResult(
          'IP注册限制检查', 
          true, 
          `可以注册: ${result.can_register}, 当前次数: ${result.current_count}`,
          result
        )
      } else {
        this.addResult('IP注册限制检查', false, '没有返回结果')
      }
    } catch (error) {
      this.addResult('IP注册限制检查', false, `异常: ${error}`)
    }
  }

  /**
   * 测试设备指纹限制
   */
  async testDeviceFingerprintLimit() {
    try {
      const testFingerprint = await generateDeviceFingerprintHash()
      
      const { data: deviceCheck, error } = await supabase.rpc('check_device_fingerprint_limit', {
        p_fingerprint_hash: testFingerprint,
        p_max_registrations: 3
      })

      if (error) {
        this.addResult('设备指纹限制检查', false, `数据库错误: ${error.message}`)
        return
      }

      if (deviceCheck && deviceCheck.length > 0) {
        const result = deviceCheck[0]
        this.addResult(
          '设备指纹限制检查', 
          true, 
          `可以注册: ${result.can_register}, 当前次数: ${result.current_count}`,
          result
        )
      } else {
        this.addResult('设备指纹限制检查', false, '没有返回结果')
      }
    } catch (error) {
      this.addResult('设备指纹限制检查', false, `异常: ${error}`)
    }
  }

  /**
   * 测试邀请速率限制
   */
  async testInvitationRateLimit() {
    try {
      // 使用一个测试用户ID
      const testUserId = '00000000-0000-0000-0000-000000000000'
      
      const { data: rateLimitCheck, error } = await supabase.rpc('check_invitation_rate_limit', {
        p_user_id: testUserId
      })

      if (error) {
        this.addResult('邀请速率限制检查', false, `数据库错误: ${error.message}`)
        return
      }

      if (rateLimitCheck && rateLimitCheck.length > 0) {
        const result = rateLimitCheck[0]
        this.addResult(
          '邀请速率限制检查', 
          true, 
          `可以邀请: ${result.can_invite}, 各时段统计: 小时${result.hourly_count}/日${result.daily_count}/月${result.monthly_count}`,
          result
        )
      } else {
        this.addResult('邀请速率限制检查', false, '没有返回结果')
      }
    } catch (error) {
      this.addResult('邀请速率限制检查', false, `异常: ${error}`)
    }
  }

  /**
   * 测试邮箱验证
   */
  async testEmailValidation() {
    const testEmails = [
      'test@gmail.com',           // 正常邮箱
      'user@10minutemail.com',    // 临时邮箱
      'invalid-email',            // 格式错误
      'test@tempmail.org'         // 另一个临时邮箱
    ]

    for (const email of testEmails) {
      try {
        const validation = await validateEmailAsync(email)
        this.addResult(
          `邮箱验证-${email}`, 
          true, 
          `有效: ${validation.isValid}, 临时: ${validation.isTemporary}, 错误: ${validation.error || '无'}`,
          validation
        )
      } catch (error) {
        this.addResult(`邮箱验证-${email}`, false, `异常: ${error}`)
      }
    }
  }

  /**
   * 测试自动化环境检测
   */
  async testAutomationDetection() {
    try {
      const detection = detectAutomation()
      this.addResult(
        '自动化环境检测', 
        true, 
        `可能是机器人: ${detection.isLikelyBot}, 可疑特征: ${detection.suspiciousFeatures.join(', ') || '无'}`,
        detection
      )
    } catch (error) {
      this.addResult('自动化环境检测', false, `异常: ${error}`)
    }
  }

  /**
   * 测试认证失败记录
   */
  async testAuthFailureRecording() {
    try {
      const testIP = '192.168.1.101'
      
      const { data, error } = await supabase.rpc('record_auth_failure', {
        p_ip_address: testIP,
        p_email: 'test@example.com',
        p_attempt_type: 'login',
        p_failure_reason: '密码错误',
        p_user_agent: navigator.userAgent
      })

      if (error) {
        this.addResult('认证失败记录', false, `数据库错误: ${error.message}`)
        return
      }

      this.addResult('认证失败记录', true, '成功记录认证失败', data)
    } catch (error) {
      this.addResult('认证失败记录', false, `异常: ${error}`)
    }
  }

  /**
   * 测试IP认证阻止检查
   */
  async testIPAuthBlock() {
    try {
      const testIP = '192.168.1.101'
      
      const { data: blockCheck, error } = await supabase.rpc('check_ip_auth_block', {
        p_ip_address: testIP,
        p_attempt_type: 'login'
      })

      if (error) {
        this.addResult('IP认证阻止检查', false, `数据库错误: ${error.message}`)
        return
      }

      if (blockCheck && blockCheck.length > 0) {
        const result = blockCheck[0]
        this.addResult(
          'IP认证阻止检查', 
          true, 
          `被阻止: ${result.is_blocked}, 失败次数: ${result.failure_count}`,
          result
        )
      } else {
        this.addResult('IP认证阻止检查', false, '没有返回结果')
      }
    } catch (error) {
      this.addResult('IP认证阻止检查', false, `异常: ${error}`)
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🔒 开始防刷机制测试...')
    this.results = []

    await this.testIPRegistrationLimit()
    await this.testDeviceFingerprintLimit()
    await this.testInvitationRateLimit()
    await this.testEmailValidation()
    await this.testAutomationDetection()
    await this.testAuthFailureRecording()
    await this.testIPAuthBlock()

    console.log('\n📊 测试结果汇总:')
    const passed = this.results.filter(r => r.success).length
    const total = this.results.length
    console.log(`✅ 通过: ${passed}/${total}`)
    
    if (passed < total) {
      console.log('❌ 失败的测试:')
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.testName}: ${r.message}`)
      })
    }

    return this.results
  }

  /**
   * 获取测试结果
   */
  getResults(): TestResult[] {
    return this.results
  }
}

// 导出测试器实例
export const antiFraudTester = new AntiFraudTester()

// 在开发环境中自动暴露到全局
if (import.meta.env.DEV) {
  (window as any).testAntiFraud = () => antiFraudTester.runAllTests()
  console.log('🔧 开发模式: 使用 testAntiFraud() 来运行防刷机制测试')
}

export default AntiFraudTester