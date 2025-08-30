import { Template, TemplateParam } from '@/features/video-creator/data/templates'

/**
 * 生成随机参数值
 */
export function generateRandomParams(template: Template): Record<string, any> {
  const randomParams: Record<string, any> = {}
  
  Object.entries(template.params).forEach(([key, param]) => {
    randomParams[key] = getRandomValueForParam(param)
  })
  
  return randomParams
}

/**
 * 根据参数类型生成随机值
 */
function getRandomValueForParam(param: TemplateParam): any {
  switch (param.type) {
    case 'select':
      // 从选项中随机选择一个
      if (param.options && param.options.length > 0) {
        const randomIndex = Math.floor(Math.random() * param.options.length)
        return param.options[randomIndex].value
      }
      return param.default
      
    case 'slider':
      // 在最小值和最大值之间随机
      const min = param.min ?? 0
      const max = param.max ?? 100
      return Math.floor(Math.random() * (max - min + 1)) + min
      
    case 'toggle':
      // 随机true或false
      return Math.random() > 0.5
      
    case 'text':
      // 使用预设的示例文本
      const sampleTexts = [
        'Elegant',
        'Modern',
        'Classic',
        'Vintage',
        'Minimal',
        'Bold',
        'Artistic',
        'Creative',
        'Dynamic',
        'Smooth'
      ]
      return sampleTexts[Math.floor(Math.random() * sampleTexts.length)]
      
    case 'image':
      // 图片类型不自动填充，返回null
      return null
      
    default:
      return param.default
  }
}

/**
 * 获取参数的随机组合描述（用于日志或显示）
 */
export function getParamsDescription(params: Record<string, any>, template: Template): string {
  const descriptions: string[] = []
  
  Object.entries(params).forEach(([key, value]) => {
    const param = template.params[key]
    if (param && value !== null && value !== undefined) {
      if (param.type === 'select') {
        const option = param.options?.find(opt => opt.value === value)
        if (option) {
          descriptions.push(`${param.label}: ${option.label}`)
        }
      } else if (param.type === 'toggle') {
        descriptions.push(`${param.label}: ${value ? 'On' : 'Off'}`)
      } else if (param.type !== 'image') {
        descriptions.push(`${param.label}: ${value}`)
      }
    }
  })
  
  return descriptions.join(', ')
}