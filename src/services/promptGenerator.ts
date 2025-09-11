import { Template, VideoGenerationParams } from '@/types/template';
import { Template as LocalTemplate, TemplateParam } from '@/features/video-creator/data/templates';

// JSON提示词模板的接口定义
interface JsonPromptTemplate {
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
    dialogue?: {
      text?: string;
    };
  }>;
  cta?: {
    motion?: string;
    text?: string;
    style?: string;
  };
  keywords?: string[];
}

export class PromptGenerator {
  /**
   * 将JSON格式的提示词转换为字符串格式
   */
  static convertJsonPromptToString(jsonPrompt: JsonPromptTemplate): string {
    const parts: string[] = [];
    
    // 基础设置
    if (jsonPrompt.duration || jsonPrompt.aspect_ratio) {
      const settings = [];
      if (jsonPrompt.duration) settings.push(`Duration: ${jsonPrompt.duration}`);
      if (jsonPrompt.aspect_ratio) settings.push(`Aspect ratio: ${jsonPrompt.aspect_ratio}`);
      parts.push(settings.join(', '));
    }
    
    // 产品和风格信息
    if (jsonPrompt.product?.brand_style) {
      parts.push(`Style: ${jsonPrompt.product.brand_style}`);
    }
    
    // 视觉核心描述
    if (jsonPrompt.visual_core?.description) {
      parts.push(`Scene: ${jsonPrompt.visual_core.description}`);
    }
    
    // 时间轴
    if (jsonPrompt.timeline && jsonPrompt.timeline.length > 0) {
      const timelineText = jsonPrompt.timeline
        .map(segment => {
          let segmentText = `[${segment.time}] ${segment.action}`;
          // 如果有对话内容，加入到action中
          if (segment.dialogue && segment.dialogue.text) {
            segmentText += ` Dialogue: "${segment.dialogue.text}"`;
          }
          segmentText += ` Camera: ${segment.camera || 'N/A'}`;
          return segmentText;
        })
        .join(' ');
      parts.push(`Timeline: ${timelineText}`);
    }
    
    // 环境设置
    if (jsonPrompt.visual_core?.environment) {
      parts.push(`Environment: ${jsonPrompt.visual_core.environment}`);
    }
    
    // 音频设置
    if (jsonPrompt.audio) {
      const audioElements = [];
      if (jsonPrompt.audio.sfx) audioElements.push(jsonPrompt.audio.sfx);
      if (jsonPrompt.audio.ambience) audioElements.push(jsonPrompt.audio.ambience);
      if (jsonPrompt.audio.music) audioElements.push(jsonPrompt.audio.music);
      if (audioElements.length > 0) {
        parts.push(`Audio: ${audioElements.join(', ')}`);
      }
    }
    
    // CTA结尾
    if (jsonPrompt.cta) {
      if (jsonPrompt.cta.motion) parts.push(`Final frame: ${jsonPrompt.cta.motion}`);
      if (jsonPrompt.cta.text && jsonPrompt.cta.style) {
        parts.push(`Text overlay: '${jsonPrompt.cta.text}' in ${jsonPrompt.cta.style}`);
      }
    }
    
    return parts.filter(Boolean).join('. ') + '.';
  }

  /**
   * 解析模板提示词中的占位符
   * 占位符格式: {parameterKey} 或 {{parameterKey}}
   */
  static parsePromptTemplate(template: string): string[] {
    const regex = /\{(\{?)(\w+)\}?\}/g;
    const placeholders: string[] = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      placeholders.push(match[2]);
    }
    
    return [...new Set(placeholders)]; // 去重
  }

  /**
   * 验证所有必需的参数是否已填写
   */
  static validateParameters(
    template: Template,
    values: Record<string, ParameterValue>
  ): { isValid: boolean; missingParams: string[] } {
    const missingParams: string[] = [];
    
    template.parameters.forEach(param => {
      if (param.required) {
        const value = values[param.name];
        if (value === undefined || value === null || value === '') {
          missingParams.push(param.name);
        }
      }
    });
    
    return {
      isValid: missingParams.length === 0,
      missingParams
    };
  }

  /**
   * 解析联动参数值
   */
  static resolveLinkedParameters(
    template: LocalTemplate,
    values: Record<string, any>
  ): Record<string, any> {
    const resolvedValues = { ...values };
    
    // 处理所有参数的联动关系
    Object.entries(template.params).forEach(([paramKey, param]) => {
      const typedParam = param as any;
      
      if (typedParam.linkedTo && typedParam.linkType === 'metadata') {
        const sourceParam = template.params[typedParam.linkedTo];
        if (sourceParam && sourceParam.type === 'select' && sourceParam.options) {
          const selectedOption = sourceParam.options.find(opt => 
            opt.value === values[typedParam.linkedTo]
          );
          
          if (selectedOption && (selectedOption as any).metadata) {
            const metadata = (selectedOption as any).metadata;
            
            if (metadata[paramKey]) {
              resolvedValues[paramKey] = metadata[paramKey];
            } else if (typedParam.default) {
              // 使用默认值作为fallback
              resolvedValues[paramKey] = typedParam.default;
            }
          }
        }
      }
    });
    
    
    return resolvedValues;
  }

  /**
   * 根据职业选择获取默认对话内容
   */
  static getDefaultDialogueForProfession(
    template: LocalTemplate,
    professionValue: string
  ): { reporter_question?: string; baby_response?: string } {
    if (!professionValue) {
      return {};
    }

    const professionParam = template.params.baby_profession;
    if (professionParam && professionParam.type === 'select' && professionParam.options) {
      const selectedOption = professionParam.options.find(opt => opt.value === professionValue);
      if (selectedOption && (selectedOption as any).metadata) {
        const metadata = (selectedOption as any).metadata;
        return {
          reporter_question: metadata.default_reporter_question,
          baby_response: metadata.default_baby_response
        };
      }
    }
    
    return {};
  }


  /**
   * 替换模板中的占位符为实际值 - 支持 LocalTemplate 结构，兼容字符串和JSON格式
   */
  static generatePromptForLocal(
    template: LocalTemplate,
    values: Record<string, any>
  ): string {
    // 首先解析联动参数
    const resolvedValues = this.resolveLinkedParameters(template, values);
    
    let prompt: string;
    
    // 检查promptTemplate的类型，兼容字符串和JSON格式
    if (typeof template.promptTemplate === 'string') {
      prompt = template.promptTemplate;
    } else if (typeof template.promptTemplate === 'object' && template.promptTemplate !== null) {
      // 将JSON格式转换为字符串格式
      prompt = this.convertJsonPromptToString(template.promptTemplate as JsonPromptTemplate);
    } else {
      throw new Error('Invalid promptTemplate format: must be string or object');
    }
    
    // 替换所有占位符
    Object.entries(template.params).forEach(([paramKey, param]) => {
      const placeholders = [
        `{${paramKey}}`,
        `{{${paramKey}}}`
      ];
      const value = resolvedValues[paramKey];
      
      placeholders.forEach(placeholder => {
        if (prompt.includes(placeholder)) {
          let replacementValue = '';
          
          switch (param.type) {
            case 'text':
            case 'select':
              replacementValue = String(value || param.default || '');
              break;
            case 'slider':
              replacementValue = String(value ?? param.default ?? '');
              break;
            case 'toggle':
              replacementValue = value ? 'enabled' : 'disabled';
              break;
            case 'image':
              replacementValue = value ? '[uploaded image]' : '[no image]';
              break;
            case 'hidden':
              replacementValue = String(value || (param as any).default || '');
              break;
            default:
              replacementValue = String(value || '');
          }
          
          // 使用全局替换
          const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
          prompt = prompt.replace(regex, replacementValue);
        }
      });
    });
    
    return prompt;
  }

  /**
   * 生成JSON格式的提示词 - 专门用于API调用
   */
  static generateJsonPrompt(
    template: LocalTemplate,
    values: Record<string, any>
  ): JsonPromptTemplate | string {
    // 首先解析联动参数
    const resolvedValues = this.resolveLinkedParameters(template, values);
    
    // 检查promptTemplate的类型
    if (typeof template.promptTemplate === 'string') {
      // 如果是字符串格式，仍返回处理后的字符串
      return this.generatePromptForLocal(template, values);
    } else if (typeof template.promptTemplate === 'object' && template.promptTemplate !== null) {
      // 如果是JSON格式，进行深度克隆并替换参数
      const jsonPrompt = JSON.parse(JSON.stringify(template.promptTemplate));
      
      // 递归替换JSON中的所有占位符
      return this.replaceJsonPlaceholders(jsonPrompt, resolvedValues, template.params);
    } else {
      throw new Error('Invalid promptTemplate format: must be string or object');
    }
  }

  /**
   * 递归替换JSON对象中的占位符
   */
  private static replaceJsonPlaceholders(
    obj: any,
    values: Record<string, any>,
    params: Record<string, TemplateParam>
  ): any {
    if (typeof obj === 'string') {
      // 替换字符串中的占位符
      let result = obj;
      Object.entries(params).forEach(([paramKey, param]) => {
        const placeholders = [
          `{${paramKey}}`,
          `{{${paramKey}}}`
        ];
        const value = values[paramKey];
        
        placeholders.forEach(placeholder => {
          if (result.includes(placeholder)) {
            let replacementValue = '';
            
            switch (param.type) {
              case 'text':
              case 'select':
                replacementValue = String(value || param.default || '');
                break;
              case 'slider':
                replacementValue = String(value ?? param.default ?? '');
                break;
              case 'toggle':
                replacementValue = value ? 'enabled' : 'disabled';
                break;
              case 'image':
                replacementValue = value ? '[uploaded image]' : '[no image]';
                break;
              case 'hidden':
                replacementValue = String(value || (param as any).default || '');
                break;
              default:
                replacementValue = String(value || '');
            }
            
            // 使用全局替换
            const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
            result = result.replace(regex, replacementValue);
          }
        });
      });
      return result;
    } else if (Array.isArray(obj)) {
      // 处理数组
      return obj.map(item => this.replaceJsonPlaceholders(item, values, params));
    } else if (typeof obj === 'object' && obj !== null) {
      // 处理对象
      const result: any = {};
      Object.keys(obj).forEach(key => {
        result[key] = this.replaceJsonPlaceholders(obj[key], values, params);
      });
      return result;
    } else {
      // 原始值（数字、布尔值等）
      return obj;
    }
  }

  /**
   * 替换模板中的占位符为实际值 - 原有方法保持兼容性
   */
  static generatePrompt(
    template: Template,
    values: Record<string, ParameterValue>
  ): string {
    let prompt = template.promptTemplate;
    
    // 替换所有占位符（支持 {key} 和 {{key}} 两种格式）
    template.parameters.forEach(param => {
      const placeholders = [
        `{${param.name}}`,
        `{{${param.name}}}`
      ];
      const value = values[param.name];
      
      placeholders.forEach(placeholder => {
        if (prompt.includes(placeholder)) {
          let replacementValue = '';
          
          switch (param.type) {
            case 'text':
            case 'select':
              replacementValue = String(value || param.defaultValue || '');
              break;
            case 'number':
            case 'slider':
              replacementValue = String(value ?? param.defaultValue ?? '');
              break;
            case 'toggle':
              replacementValue = value ? 'enabled' : 'disabled';
              break;
            case 'image':
              // 对于图片，我们返回一个描述
              replacementValue = value ? '[uploaded image]' : '[no image]';
              break;
            default:
              replacementValue = String(value || '');
          }
          
          // 使用全局替换
          const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
          prompt = prompt.replace(regex, replacementValue);
        }
      });
    });
    
    // 添加额外的元数据
    const metadata = [
      `Template: ${template.name}`,
      `Category: ${template.category}`,
      `Credits Required: ${template.creditsRequired}`,
      `Generated at: ${new Date().toISOString()}`
    ].join('\n');
    
    return `${prompt}\n\n---\n${metadata}`;
  }

  /**
   * 生成预览提示词（不包含敏感信息）
   */
  static generatePreview(
    template: Template,
    values: Record<string, ParameterValue>
  ): string {
    const prompt = this.generatePrompt(template, values);
    // 移除元数据部分，只返回主提示词
    return prompt.split('\\n\\n---\\n')[0];
  }

  /**
   * 估算生成的令牌数（简单估算）
   */
  static estimateTokens(prompt: string): number {
    // 粗略估算：平均每4个字符为1个token
    return Math.ceil(prompt.length / 4);
  }

  /**
   * 获取参数的显示值（用于UI展示）
   */
  static getParameterDisplayValue(
    param: Template['parameters'][0],
    value: ParameterValue
  ): string {
    if (value === undefined || value === null) {
      return 'Not set';
    }
    
    switch (param.type) {
      case 'toggle':
        return value ? 'On' : 'Off';
      case 'image':
        return value ? 'Image uploaded' : 'No image';
      case 'select':
        const option = param.options?.find(opt => opt.value === value);
        return option?.label || String(value);
      default:
        return String(value);
    }
  }
}

export default PromptGenerator;