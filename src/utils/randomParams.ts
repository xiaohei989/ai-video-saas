import { Template, TemplateParam } from '@/features/video-creator/data/templates'

/**
 * 生成随机参数值
 */
export function generateRandomParams(template: Template): Record<string, any> {
  // 重置对话组合索引，确保每次随机都能选择新的完整对话组合
  currentDialogueSetIndex = null
  
  const randomParams: Record<string, any> = {}
  
  Object.entries(template.params).forEach(([key, param]) => {
    randomParams[key] = getRandomValueForParam(key, param)
  })
  
  return randomParams
}

/**
 * 根据参数类型生成随机值
 */
function getRandomValueForParam(key: string, param: TemplateParam): any {
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
      // 根据参数key提供特定的随机对话内容
      return getRandomTextByKey(key, param)
      
    case 'image':
      // 图片类型不自动填充，返回null
      return null
      
    default:
      return param.default
  }
}

// 全局变量存储当前选择的对话组合索引
let currentDialogueSetIndex: number | null = null

/**
 * 根据参数key生成随机文本内容
 */
function getRandomTextByKey(key: string, param: TemplateParam): string {
  // 完整的对话组合集合，每组包含4句连贯的对话
  const dialogueSets = [
    // 组合1：健身主题
    {
      dialogue_main_1: "I told him we're jogging today, guess what he brought?",
      dialogue_side_1: "Snacks, of course!",
      dialogue_main_2: "That's our gym today!",
      dialogue_side_2: "And that's my post-workout meal!"
    },
    // 组合2：探险主题
    {
      dialogue_main_1: "You won't believe what happened on my way here!",
      dialogue_side_1: "Oh my goodness, tell me everything!",
      dialogue_main_2: "And that's just the beginning!",
      dialogue_side_2: "I can't wait to see what happens next!"
    },
    // 组合3：美景欣赏主题
    {
      dialogue_main_1: "Perfect weather for our adventure, don't you think?",
      dialogue_side_1: "Absolutely perfect! I love it out here!",
      dialogue_main_2: "Time to make some memories!",
      dialogue_side_2: "Best day ever, guaranteed!"
    },
    // 组合4：好消息分享主题
    {
      dialogue_main_1: "I have the best news to share with you!",
      dialogue_side_1: "I'm so excited! What is it?",
      dialogue_main_2: "This is going to be legendary!",
      dialogue_side_2: "Count me in for this adventure!"
    },
    // 组合5：激动出游主题
    {
      dialogue_main_1: "Ready for the most epic day ever?",
      dialogue_side_1: "I was born ready!",
      dialogue_main_2: "Perfect spot for our adventure!",
      dialogue_side_2: "This is exactly what I needed today!"
    },
    // 组合6：风景赞美主题
    {
      dialogue_main_1: "This place is absolutely incredible!",
      dialogue_side_1: "This is my favorite place in the world!",
      dialogue_main_2: "Nature's playground awaits us!",
      dialogue_side_2: "Nothing beats spending time in nature!"
    },
    // 组合7：期待已久主题
    {
      dialogue_main_1: "I've been waiting all week for this moment!",
      dialogue_side_1: "Me too! This is going to be amazing!",
      dialogue_main_2: "Let the fun begin!",
      dialogue_side_2: "Let's do this together!"
    },
    // 组合8：景色分享主题
    {
      dialogue_main_1: "Check out this amazing view behind us!",
      dialogue_side_1: "Wow, you're right! It's breathtaking!",
      dialogue_main_2: "This is why I love the outdoors!",
      dialogue_side_2: "I feel so alive out here!"
    }
  ]
  
  // 对话参数处理
  const dialogueKeys = ['dialogue_main_1', 'dialogue_side_1', 'dialogue_main_2', 'dialogue_side_2']
  if (dialogueKeys.includes(key)) {
    // 如果还没选择对话组合，随机选择一个
    if (currentDialogueSetIndex === null) {
      currentDialogueSetIndex = Math.floor(Math.random() * dialogueSets.length)
    }
    
    const selectedSet = dialogueSets[currentDialogueSetIndex]
    return selectedSet[key as keyof typeof selectedSet] || param.default || ''
  }
  
  // 其他文本参数的默认处理
  if (param.default) {
    return param.default
  }
  
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