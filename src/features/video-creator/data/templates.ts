// 🔥 修复循环依赖：从独立的 types 文件导入类型
export * from './types'
import type { Template } from './types'

// Import templates from JSON files
import templateList from './templates/index'

// Re-export the templates array
export const templates: Template[] = templateList
export { default as templateList } from './templates/index'