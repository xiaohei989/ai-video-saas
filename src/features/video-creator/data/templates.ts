export interface TemplateParam {
  type: 'image' | 'text' | 'select' | 'toggle' | 'slider'
  label: string
  required?: boolean
  default?: any
  options?: { value: string; label: string }[]
  min?: number
  max?: number
}

export interface Template {
  id: string
  name: string
  icon: string
  credits: number
  description: string
  previewUrl?: string
  thumbnailUrl?: string
  tags?: string[]
  promptTemplate: string
  params: Record<string, TemplateParam>
  createdAt?: string  // ISO date string
  likes?: number      // Number of likes for popularity
}

// Import templates from JSON files
import templateList from './templates/index'

// Re-export the templates array
export const templates: Template[] = templateList