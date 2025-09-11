export interface TemplateParam {
  type: 'image' | 'text' | 'select' | 'toggle' | 'slider' | 'textarea'
  label: string
  required?: boolean
  default?: any
  placeholder?: string
  description?: string
  rows?: number
  options?: { 
    value: string; 
    label: string; 
    activity_description?: string;
    voiceover_content?: string;
    metadata?: {
      default_dialogue?: string;
      [key: string]: any;
    }
  }[]
  min?: number
  max?: number
  showWhen?: {
    field: string;
    value: any;
  }
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
  slug?: string  // URL友好的字符串标识符
  name: string
  icon: string
  credits: number
  description: string
  category?: string   // 模板分类
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