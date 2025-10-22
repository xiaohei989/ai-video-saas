/**
 * 健壮的JSON解析工具
 *
 * 用于处理大模型可能返回的各种格式的JSON响应:
 * - 纯JSON对象
 * - Markdown代码块包裹的JSON (```json ... ```)
 * - 带有中文/英文说明文字的JSON
 * - Claude CLI --output-format json 的包装格式
 *
 * 提供多层清理和提取策略，确保最大程度提取合法JSON
 */

/**
 * 中文说明文字的正则模式列表
 * 用于移除大模型在JSON前添加的说明性文字
 */
const CHINESE_EXPLANATION_PATTERNS = [
  /^[\s\S]*?我注意到[\s\S]*?(?=\{)/,
  /^[\s\S]*?我已经完成[\s\S]*?(?=\{)/,
  /^[\s\S]*?已完成生成[\s\S]*?(?=\{)/,
  /^[\s\S]*?这是生成的[\s\S]*?(?=\{)/,
  /^[\s\S]*?以下是[\s\S]*?(?=\{)/,
  /^[\s\S]*?我已经[\s\S]*?(?=\{)/,
  /^[\s\S]*?根据您的[\s\S]*?(?=\{)/,
  /^[\s\S]*?##\s*✅[\s\S]*?(?=\{)/,
  /^[\s\S]*?Here is[\s\S]*?(?=\{)/i,
  /^[\s\S]*?I['']ve completed[\s\S]*?(?=\{)/i,
  /^[\s\S]*?The result is[\s\S]*?(?=\{)/i
]

/**
 * 健壮的JSON解析函数
 *
 * @param rawOutput - 大模型的原始输出
 * @param options - 解析选项
 * @returns 解析后的JSON对象
 * @throws Error 如果所有策略都失败
 */
export function robustJSONParse<T = any>(
  rawOutput: string,
  options: {
    logPrefix?: string // 日志前缀，用于调试
    verbose?: boolean  // 是否输出详细日志
  } = {}
): T {
  const { logPrefix = '[JSON Parser]', verbose = false } = options

  if (verbose) {
    console.log(`${logPrefix} 原始输出长度: ${rawOutput.length}`)
    console.log(`${logPrefix} 原始输出前200字符:`, rawOutput.substring(0, 200))
  }

  let output = rawOutput

  // ========================================
  // 第1步: 移除中文/英文说明文字
  // ========================================
  for (const pattern of CHINESE_EXPLANATION_PATTERNS) {
    if (pattern.test(output)) {
      if (verbose) {
        console.log(`${logPrefix} 检测到说明文字,正在移除...`)
      }
      output = output.replace(pattern, '')
      if (verbose) {
        console.log(`${logPrefix} 清理后前100字符:`, output.substring(0, 100))
      }
      break
    }
  }

  // ========================================
  // 策略0: 处理 Claude CLI --output-format json 的包装格式
  // ========================================
  try {
    const wrapper = JSON.parse(output)
    if (wrapper.type === 'result' && wrapper.result) {
      if (verbose) {
        console.log(`${logPrefix} 策略0: 检测到 Claude CLI JSON 包装格式`)
      }
      output = wrapper.result
    }
  } catch {
    // 不是JSON包装格式,继续使用原输出
  }

  // ========================================
  // 策略1: 提取 ```json ... ``` 代码块
  // ========================================
  let jsonMatch = output.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    if (verbose) {
      console.log(`${logPrefix} 策略1: 找到 \`\`\`json 代码块`)
    }
    try {
      return JSON.parse(jsonMatch[1].trim()) as T
    } catch (e) {
      if (verbose) {
        console.log(`${logPrefix} 策略1解析失败，继续尝试其他策略...`)
      }
    }
  }

  // ========================================
  // 策略2: 提取 ``` ... ``` 普通代码块
  // ========================================
  jsonMatch = output.match(/```\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    if (verbose) {
      console.log(`${logPrefix} 策略2: 找到 \`\`\` 代码块`)
    }
    try {
      return JSON.parse(jsonMatch[1].trim()) as T
    } catch (e) {
      if (verbose) {
        console.log(`${logPrefix} 策略2解析失败，继续尝试其他策略...`)
      }
    }
  }

  // ========================================
  // 策略3: 提取第一个 { 到最后一个 } (最激进的方法)
  // ========================================
  const firstBrace = output.indexOf('{')
  const lastBrace = output.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    if (verbose) {
      console.log(`${logPrefix} 策略3: 提取 JSON 对象 (位置 ${firstBrace} 到 ${lastBrace})`)
    }
    const jsonContent = output.substring(firstBrace, lastBrace + 1)

    try {
      return JSON.parse(jsonContent) as T
    } catch (error) {
      // 如果直接解析失败，尝试清理内容
      if (verbose) {
        console.log(`${logPrefix} 策略3初步失败，尝试清理后再解析...`)
      }

      // 移除Markdown标题和说明文字
      const lines = jsonContent.split('\n')
      const cleanedLines = lines.filter(line => {
        const trimmed = line.trim()
        // 过滤掉Markdown标题、空行、说明文字
        return trimmed &&
               !trimmed.startsWith('##') &&
               !trimmed.startsWith('###') &&
               !trimmed.startsWith('我已经') &&
               !trimmed.startsWith('包含:') &&
               !trimmed.startsWith('**') &&
               !trimmed.startsWith('- **')
      })
      const cleanedContent = cleanedLines.join('\n')

      try {
        return JSON.parse(cleanedContent) as T
      } catch (secondError) {
        if (verbose) {
          console.error(`${logPrefix} 策略3清理后仍然失败`)
          console.error(`${logPrefix} 最终错误:`, (secondError as Error).message)
          console.error(`${logPrefix} 提取的内容（前500字符）:`, jsonContent.substring(0, 500))
          console.error(`${logPrefix} 清理后的内容（前500字符）:`, cleanedContent.substring(0, 500))
        }
        throw new Error(
          `无法解析 JSON: ${(secondError as Error).message}\n` +
          `提取的内容开头: ${jsonContent.substring(0, 200)}`
        )
      }
    }
  }

  // ========================================
  // 策略4: 尝试直接解析整个输出（最后的fallback）
  // ========================================
  if (verbose) {
    console.log(`${logPrefix} 策略4: 尝试直接解析整个输出`)
  }
  try {
    return JSON.parse(output.trim()) as T
  } catch (error) {
    console.error(`${logPrefix} 所有JSON解析策略均失败`)
    console.error(`${logPrefix} 最终错误:`, (error as Error).message)
    console.error(`${logPrefix} 原始输出（前500字符）:`, rawOutput.substring(0, 500))
    console.error(`${logPrefix} 原始输出（最后200字符）:`, rawOutput.substring(Math.max(0, rawOutput.length - 200)))
    throw new Error(
      `无法解析 JSON (尝试所有策略后): ${(error as Error).message}\n` +
      `原始输出开头: ${rawOutput.substring(0, 200)}`
    )
  }
}

/**
 * 字段别名映射（用于兼容不同的字段名）
 * 键是标准字段名，值是可能的别名列表
 */
const FIELD_ALIASES: Record<string, string[]> = {
  'overall_score': ['total_score'], // overall_score 可以用 total_score 代替
  'actionable_recommendations': ['recommendations', 'suggestions'] // actionable_recommendations 的别名
}

/**
 * 验证JSON对象是否符合预期schema
 *
 * @param obj - 要验证的对象
 * @param requiredFields - 必须存在的字段列表
 * @returns 验证结果
 */
export function validateJSONSchema(
  obj: any,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  for (const field of requiredFields) {
    // 支持嵌套字段检查 (例如: "dimension_scores.meta_quality")
    const parts = field.split('.')
    let current = obj
    let found = false

    // 首先尝试标准字段名
    let tempCurrent = obj
    let standardFieldExists = true
    for (const part of parts) {
      if (tempCurrent === null || tempCurrent === undefined || !(part in tempCurrent)) {
        standardFieldExists = false
        break
      }
      tempCurrent = tempCurrent[part]
    }

    if (standardFieldExists) {
      found = true
    } else {
      // 如果标准字段名不存在，尝试别名（仅对顶层字段）
      if (parts.length === 1) {
        const aliases = FIELD_ALIASES[field] || []
        for (const alias of aliases) {
          if (alias in obj) {
            found = true
            break
          }
        }
      }
    }

    if (!found) {
      missingFields.push(field)
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  }
}

/**
 * 带schema验证的健壮JSON解析
 *
 * @param rawOutput - 大模型的原始输出
 * @param requiredFields - 必须存在的字段列表
 * @param options - 解析选项
 * @returns 解析并验证后的JSON对象
 * @throws Error 如果解析失败或schema验证失败
 */
export function robustJSONParseWithValidation<T = any>(
  rawOutput: string,
  requiredFields: string[],
  options: {
    logPrefix?: string
    verbose?: boolean
  } = {}
): T {
  const { logPrefix = '[JSON Parser]', verbose = false } = options

  // 第1步: 解析JSON
  const parsed = robustJSONParse<T>(rawOutput, { logPrefix, verbose })

  // 第2步: 验证schema
  const validation = validateJSONSchema(parsed, requiredFields)

  if (!validation.valid) {
    const errorMsg = `JSON schema 验证失败: 缺少必填字段 [${validation.missingFields.join(', ')}]`
    console.error(`${logPrefix} ${errorMsg}`)
    console.error(`${logPrefix} 实际字段:`, Object.keys(parsed as any))
    throw new Error(errorMsg)
  }

  if (verbose) {
    console.log(`${logPrefix} ✅ JSON解析和schema验证成功`)
  }

  return parsed
}
