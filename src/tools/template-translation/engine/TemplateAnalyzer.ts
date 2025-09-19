/**
 * 模板分析器 - 分析模板结构并提取可翻译内容
 */

export interface AnalysisResult {
  templateId: string;
  slug: string;
  hasMultilingualSupport: boolean;
  translatableFields: TranslatableField[];
  promptTemplateType: 'string' | 'json';
  requiresTranslation: boolean;
}

export interface TranslatableField {
  path: string[];
  type: 'string' | 'object' | 'array';
  currentValue: any;
  isTranslatable: boolean;
}

export class TemplateAnalyzer {
  private static readonly TRANSLATABLE_FIELDS = [
    'name',
    'description',
    'label',
  ];

  /**
   * 分析单个模板
   */
  static analyzeTemplate(template: any): AnalysisResult {
    const translatableFields: TranslatableField[] = [];
    
    // 检查是否已有多语言支持
    const hasMultilingualSupport = this.checkMultilingualSupport(template);
    
    // 分析模板根级字段
    this.analyzeFields(template, [], translatableFields);
    
    // 分析参数字段
    if (template.params) {
      this.analyzeParams(template.params, translatableFields);
    }
    
    // 检查 promptTemplate 类型
    const promptTemplateType = typeof template.promptTemplate === 'string' ? 'string' : 'json';
    
    return {
      templateId: template.id,
      slug: template.slug,
      hasMultilingualSupport,
      translatableFields,
      promptTemplateType,
      requiresTranslation: !hasMultilingualSupport
    };
  }

  /**
   * 检查模板是否已有多语言支持
   */
  private static checkMultilingualSupport(template: any): boolean {
    // 检查根级字段是否为多语言对象
    const rootFields = ['name', 'description'];
    
    for (const field of rootFields) {
      if (template[field] && typeof template[field] === 'object') {
        const keys = Object.keys(template[field]);
        // 如果包含语言代码，则认为已有多语言支持
        if (keys.includes('en') || keys.includes('zh') || keys.includes('ja')) {
          return true;
        }
      }
    }
    
    // 检查参数是否有多语言支持
    if (template.params) {
      for (const paramKey of Object.keys(template.params)) {
        const param = template.params[paramKey];
        if (param.label && typeof param.label === 'object') {
          const keys = Object.keys(param.label);
          if (keys.includes('en') || keys.includes('zh') || keys.includes('ja')) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * 分析字段
   */
  private static analyzeFields(
    obj: any,
    currentPath: string[],
    translatableFields: TranslatableField[]
  ): void {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = [...currentPath, key];
      
      if (this.TRANSLATABLE_FIELDS.includes(key) && typeof value === 'string') {
        translatableFields.push({
          path: fieldPath,
          type: 'string',
          currentValue: value,
          isTranslatable: true
        });
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          // 处理数组
          value.forEach((item, index) => {
            this.analyzeFields(item, [...fieldPath, index.toString()], translatableFields);
          });
        } else {
          // 处理对象
          this.analyzeFields(value, fieldPath, translatableFields);
        }
      }
    }
  }

  /**
   * 分析参数
   */
  private static analyzeParams(params: any, translatableFields: TranslatableField[]): void {
    for (const [paramKey, param] of Object.entries(params)) {
      const paramPath = ['params', paramKey];
      
      // 分析参数标签
      if ((param as any).label && typeof (param as any).label === 'string') {
        translatableFields.push({
          path: [...paramPath, 'label'],
          type: 'string',
          currentValue: (param as any).label,
          isTranslatable: true
        });
      }
      
      // 分析选项
      if ((param as any).options && Array.isArray((param as any).options)) {
        (param as any).options.forEach((option: any, index: number) => {
          if (option.label && typeof option.label === 'string') {
            translatableFields.push({
              path: [...paramPath, 'options', index.toString(), 'label'],
              type: 'string',
              currentValue: option.label,
              isTranslatable: true
            });
          }
        });
      }
    }
  }

  /**
   * 批量分析多个模板
   */
  static analyzeTemplates(templates: any[]): AnalysisResult[] {
    return templates.map(template => this.analyzeTemplate(template));
  }

  /**
   * 生成分析报告
   */
  static generateAnalysisReport(results: AnalysisResult[]): {
    total: number;
    withMultilingual: number;
    needTranslation: number;
    totalTranslatableFields: number;
    summary: string;
  } {
    const total = results.length;
    const withMultilingual = results.filter(r => r.hasMultilingualSupport).length;
    const needTranslation = results.filter(r => r.requiresTranslation).length;
    const totalTranslatableFields = results.reduce(
      (sum, r) => sum + r.translatableFields.length, 
      0
    );

    const summary = `
模板分析报告:
- 总模板数: ${total}
- 已有多语言支持: ${withMultilingual}
- 需要翻译: ${needTranslation}
- 可翻译字段总数: ${totalTranslatableFields}
- 翻译完成率: ${((withMultilingual / total) * 100).toFixed(1)}%
    `;

    return {
      total,
      withMultilingual,
      needTranslation,
      totalTranslatableFields,
      summary
    };
  }
}