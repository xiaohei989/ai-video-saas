import { Template, ParameterValue } from '@/types/template';

export class PromptGenerator {
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
        const value = values[param.key];
        if (value === undefined || value === null || value === '') {
          missingParams.push(param.key);
        }
      }
    });
    
    return {
      isValid: missingParams.length === 0,
      missingParams
    };
  }

  /**
   * 替换模板中的占位符为实际值
   */
  static generatePrompt(
    template: Template,
    values: Record<string, ParameterValue>
  ): string {
    let prompt = template.promptTemplate;
    
    // 替换所有占位符（支持 {key} 和 {{key}} 两种格式）
    template.parameters.forEach(param => {
      const placeholders = [
        `{${param.key}}`,
        `{{${param.key}}}`
      ];
      const value = values[param.key];
      
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