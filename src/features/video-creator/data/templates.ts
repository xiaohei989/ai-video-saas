// 多语言文本类型：支持字符串或多语言对象
export type MultilingualText = string | Record<string, string>;

export interface TemplateParam {
  type: 'image' | 'text' | 'select' | 'toggle' | 'slider' | 'textarea' | 'hidden'
  label: MultilingualText
  required?: boolean
  default?: any
  placeholder?: MultilingualText
  description?: MultilingualText
  rows?: number
  options?: { 
    value: string; 
    label: MultilingualText; 
    activity_description?: string;
    voiceover_content?: string;
    metadata?: {
      default_dialogue?: string;
      [key: string]: any;
    }
  }[]
  min?: number
  max?: number
  step?: number
  showWhen?: {
    field: string;
    value: any;
  }
  // 新增：隐藏字段的关联配置
  linkedTo?: string;
  linkType?: 'metadata';
  maxLength?: number;
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
  name: MultilingualText
  icon: string
  credits?: number
  description: MultilingualText
  category?: string   // 模板分类
  previewUrl?: string
  thumbnailUrl?: string
  blurThumbnailUrl?: string
  tags?: string[]
  promptTemplate: string | JsonPromptTemplate  // 支持字符串和JSON两种格式
  params: Record<string, TemplateParam>
  createdAt?: string  // ISO date string
  version?: string
  lastModified?: string
  likes?: number      // Number of likes for popularity
}

// Import templates from JSON files
import templateList from './templates/index'

// Re-export the templates array
export const templates: Template[] = templateList
export { default as templateList } from './templates/index'