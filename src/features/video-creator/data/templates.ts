export interface TemplateParam {
  type: 'image' | 'text' | 'select' | 'toggle' | 'slider'
  label: string
  required?: boolean
  default?: any
  options?: { value: string; label: string }[]
  min?: number
  max?: number
}

// JSON格式的提示词模板结构
export interface JsonPromptTemplate {
  model?: string;
  duration?: string;
  aspect_ratio?: string;
  product?: {
    name?: string;
    type?: string;
    brand_style?: string;
  };
  visual_core?: {
    description?: string;
    style?: string;
    camera?: string;
    lighting?: string;
    environment?: string;
  };
  elements?: string[];
  audio?: {
    sfx?: string;
    ambience?: string;
    music?: string;
  };
  timeline?: Array<{
    time?: string;
    action?: string;
    camera?: string;
    audio?: string;
  }>;
  cta?: {
    motion?: string;
    text?: string;
    style?: string;
  };
  keywords?: string[];
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
  promptTemplate: string | JsonPromptTemplate  // 支持字符串和JSON两种格式
  params: Record<string, TemplateParam>
  createdAt?: string  // ISO date string
  likes?: number      // Number of likes for popularity
}

// Import templates from JSON files
import templateList from './templates/index'

// Re-export the templates array
export const templates: Template[] = templateList