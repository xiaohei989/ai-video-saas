export type ParameterType = 'text' | 'image' | 'select' | 'toggle' | 'slider' | 'number' | 'textarea' | 'hidden'

export interface TemplateParameter {
  type: ParameterType
  name: string
  label: string
  placeholder?: string
  required?: boolean
  default?: any
  options?: Array<{ value: string; label: string }> // for select type
  min?: number // for slider and number
  max?: number // for slider and number
  step?: number // for slider and number
  accept?: string // for image type (e.g., "image/*")
}

export interface Template {
  id: string // UUID格式
  slug?: string // URL友好的字符串标识符
  name: string
  description: string
  icon: string
  category?: string
  credits: number
  promptTemplate: string
  parameters: TemplateParameter[]
  previewUrl?: string
  thumbnailUrl?: string
  tags: string[]
}

export interface VideoGenerationParams {
  [key: string]: any
}

export interface GeneratedVideo {
  id: string
  templateId: string
  params: VideoGenerationParams
  videoUrl?: string
  thumbnailUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  error?: string
}