import { Template, MultilingualText, TemplateParam } from '../templates'
import i18n from '../../../../i18n/config'

// 多语言文本解析函数
function resolveMultilingualText(text: MultilingualText, currentLang?: string): string {
  // 处理空值和undefined情况
  if (!text) {
    return '';
  }
  
  if (typeof text === 'string') {
    return text; // 向后兼容：单语言字符串直接返回
  }
  
  // 确保text是对象类型
  if (typeof text !== 'object' || Array.isArray(text)) {
    return String(text);
  }
  
  const lang = currentLang || i18n.language || 'en';
  
  // 优先返回当前语言版本
  if (text[lang]) {
    return text[lang];
  }
  
  // 回退到英语
  if (text['en']) {
    return text['en'];
  }
  
  // 最后回退：返回任意可用语言
  const availableKeys = Object.keys(text);
  return availableKeys.length > 0 ? text[availableKeys[0]] : '';
}

// 本地化模板参数
function localizeTemplateParam(param: TemplateParam, currentLang?: string): TemplateParam {
  if (!param) {
    return param;
  }
  
  const localizedParam: TemplateParam = {
    ...param,
    label: resolveMultilingualText(param.label, currentLang),
  };
  
  if (param.placeholder) {
    localizedParam.placeholder = resolveMultilingualText(param.placeholder, currentLang);
  }
  
  if (param.description) {
    localizedParam.description = resolveMultilingualText(param.description, currentLang);
  }
  
  if (param.options) {
    localizedParam.options = param.options.map(option => ({
      ...option,
      label: resolveMultilingualText(option.label, currentLang)
    }));
  }
  
  return localizedParam;
}

// 本地化模板
function localizeTemplate(template: Template, currentLang?: string): Template {
  const localizedTemplate: Template = {
    ...template,
    name: resolveMultilingualText(template.name, currentLang),
    description: resolveMultilingualText(template.description, currentLang),
    params: {}
  };
  
  // 本地化所有参数
  for (const [key, param] of Object.entries(template.params)) {
    localizedTemplate.params[key] = localizeTemplateParam(param, currentLang);
  }
  
  return localizedTemplate;
}

// 使用 Vite 的 glob 导入自动扫描所有 JSON 文件
const templateModules = import.meta.glob('./*.json', { eager: true })

// 自动从目录加载所有模板
export const templateList: Template[] = []
export const templates: Record<string, Template> = {}

// 动态加载所有模板文件
for (const path in templateModules) {
  // 跳过非模板文件
  const fileName = path.split('/').pop()
  if (!fileName || fileName === 'index.json' || fileName === 'config.json') {
    continue
  }
  
  const module = templateModules[path] as any
  const template = module.default || module
  
  if (template && template.id) {
    templateList.push(template as Template)
    // 将模板ID转换为驼峰命名作为key
    const camelCaseId = template.id.replace(/-([a-z])/g, (g: string) => g[1].toUpperCase())
    templates[camelCaseId] = template as Template
  }
}

// 按积分排序，积分少的排在前面
templateList.sort((a, b) => (a as any).credits - (b as any).credits)

// 获取本地化的模板列表
export function getLocalizedTemplateList(lang?: string): Template[] {
  return templateList.map(template => localizeTemplate(template, lang))
}

// Helper function to get template by ID
export function getTemplateById(id: string, lang?: string): Template | undefined {
  const template = templateList.find(template => template.id === id)
  return template ? localizeTemplate(template, lang) : undefined
}

// Helper function to get templates by category (for future use)
export function getTemplatesByCategory(category: string, lang?: string): Template[] {
  const filteredTemplates = templateList.filter(template => 
    (template as any).category === category
  )
  return filteredTemplates.map(template => localizeTemplate(template, lang))
}

// Helper function to search templates by keyword
export function searchTemplates(keyword: string, lang?: string): Template[] {
  const searchTerm = keyword.toLowerCase()
  const filteredTemplates = templateList.filter(template => {
    // 对于搜索，先本地化模板以匹配当前语言内容
    const localizedTemplate = localizeTemplate(template, lang)
    
    // Check if keyword matches tags
    const tags = (template as any).tags || []
    const tagMatch = tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))
    
    // Check if keyword matches localized name or description
    const nameMatch = localizedTemplate.name.toLowerCase().includes(searchTerm)
    const descMatch = localizedTemplate.description.toLowerCase().includes(searchTerm)
    
    return tagMatch || nameMatch || descMatch
  })
  
  return filteredTemplates.map(template => localizeTemplate(template, lang))
}

// Helper function to get all tags with their frequency
export function getAllTagsWithFrequency(): Array<{ tag: string; count: number }> {
  const tagCount: Record<string, number> = {}
  
  templateList.forEach(template => {
    const tags = (template as any).tags || []
    tags.forEach((tag: string) => {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    })
  })
  
  return Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count) // 按频率降序排序
}

// Helper function to get popular tags for display
export function getPopularTags(limit: number = 16): string[] {
  return getAllTagsWithFrequency()
    .slice(0, limit)
    .map(item => item.tag)
}

// Helper function to filter templates by tags
export function getTemplatesByTags(selectedTags: string[]): Template[] {
  if (selectedTags.length === 0) {
    return templateList
  }
  
  return templateList.filter(template => {
    const templateTags = (template as any).tags || []
    // 使用 AND 逻辑：模板必须包含所有选中的标签
    return selectedTags.every(selectedTag => 
      templateTags.includes(selectedTag)
    )
  })
}

// 由于React需要在运行时获取当前语言，不能在模块加载时就本地化
// 因此默认导出原始模板列表，由组件在使用时调用本地化函数
export default templateList

// 同时导出多语言工具函数供外部使用
export { resolveMultilingualText, localizeTemplate, localizeTemplateParam }