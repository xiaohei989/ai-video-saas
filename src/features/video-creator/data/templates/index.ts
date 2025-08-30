import { Template } from '../templates'

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

// Helper function to get template by ID
export function getTemplateById(id: string): Template | undefined {
  return templateList.find(template => template.id === id)
}

// Helper function to get templates by category (for future use)
export function getTemplatesByCategory(category: string): Template[] {
  return templateList.filter(template => 
    (template as any).category === category
  )
}

// Helper function to search templates by keyword
export function searchTemplates(keyword: string): Template[] {
  const searchTerm = keyword.toLowerCase()
  return templateList.filter(template => {
    // Check if keyword matches tags
    const tags = (template as any).tags || []
    const tagMatch = tags.some((tag: string) => tag.toLowerCase().includes(searchTerm))
    
    // Check if keyword matches name or description
    const nameMatch = template.name.toLowerCase().includes(searchTerm)
    const descMatch = template.description.toLowerCase().includes(searchTerm)
    
    return tagMatch || nameMatch || descMatch
  })
}

export default templateList