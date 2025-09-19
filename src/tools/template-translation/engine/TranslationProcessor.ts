/**
 * 翻译处理器 - 处理翻译数据并应用到模板
 */

import type { MultilingualText } from '../../../features/video-creator/data/templates';

export interface TranslationData {
  [templateSlug: string]: {
    name?: MultilingualText;
    description?: MultilingualText;
    params?: {
      [paramKey: string]: {
        label?: MultilingualText;
        options?: Array<{
          value: string;
          label: MultilingualText;
        }>;
      };
    };
  };
}

export interface ProcessingResult {
  success: boolean;
  templateSlug: string;
  fieldsProcessed: number;
  errors: string[];
  warnings: string[];
}

export class TranslationProcessor {
  private static readonly SUPPORTED_LANGUAGES = [
    'en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'ar'
  ];

  /**
   * 应用翻译到单个模板
   */
  static applyTranslationToTemplate(
    template: any,
    translations: TranslationData[string]
  ): ProcessingResult {
    const result: ProcessingResult = {
      success: false,
      templateSlug: template.slug,
      fieldsProcessed: 0,
      errors: [],
      warnings: []
    };

    try {
      // 处理模板名称
      if (translations.name) {
        if (this.validateMultilingualText(translations.name)) {
          template.name = translations.name;
          result.fieldsProcessed++;
        } else {
          result.warnings.push('Invalid translation format for name field');
        }
      }

      // 处理模板描述
      if (translations.description) {
        if (this.validateMultilingualText(translations.description)) {
          template.description = translations.description;
          result.fieldsProcessed++;
        } else {
          result.warnings.push('Invalid translation format for description field');
        }
      }

      // 处理参数翻译
      if (translations.params && template.params) {
        for (const [paramKey, paramTranslations] of Object.entries(translations.params)) {
          if (!template.params[paramKey]) {
            result.warnings.push(`Parameter ${paramKey} not found in template`);
            continue;
          }

          // 处理参数标签
          if (paramTranslations.label) {
            if (this.validateMultilingualText(paramTranslations.label)) {
              template.params[paramKey].label = paramTranslations.label;
              result.fieldsProcessed++;
            } else {
              result.warnings.push(`Invalid translation format for parameter ${paramKey} label`);
            }
          }

          // 处理选项翻译
          if (paramTranslations.options && template.params[paramKey].options) {
            if (Array.isArray(paramTranslations.options)) {
              // 数组格式的选项翻译
              paramTranslations.options.forEach((optionTranslation, index) => {
                if (template.params[paramKey].options[index]) {
                  if (this.validateMultilingualText(optionTranslation.label)) {
                    template.params[paramKey].options[index].label = optionTranslation.label;
                    result.fieldsProcessed++;
                  } else {
                    result.warnings.push(
                      `Invalid translation format for parameter ${paramKey} option ${index}`
                    );
                  }
                } else {
                  result.warnings.push(
                    `Option ${index} not found for parameter ${paramKey}`
                  );
                }
              });
            } else {
              // 对象格式的选项翻译（以value为键）
              for (const [optionValue, optionLabel] of Object.entries(paramTranslations.options)) {
                const optionIndex = template.params[paramKey].options.findIndex(
                  (opt: any) => opt.value === optionValue
                );
                
                if (optionIndex !== -1) {
                  if (this.validateMultilingualText(optionLabel)) {
                    template.params[paramKey].options[optionIndex].label = optionLabel;
                    result.fieldsProcessed++;
                  } else {
                    result.warnings.push(
                      `Invalid translation format for parameter ${paramKey} option ${optionValue}`
                    );
                  }
                } else {
                  result.warnings.push(
                    `Option value ${optionValue} not found for parameter ${paramKey}`
                  );
                }
              }
            }
          }
        }
      }

      result.success = result.errors.length === 0;
      return result;

    } catch (error) {
      result.errors.push(`Failed to apply translations: ${error}`);
      return result;
    }
  }

  /**
   * 验证多语言文本格式
   */
  private static validateMultilingualText(text: any): boolean {
    if (typeof text === 'string') return true;
    
    if (typeof text !== 'object' || text === null) return false;
    
    const keys = Object.keys(text);
    if (keys.length === 0) return false;
    
    // 检查是否包含有效的语言代码
    const validLanguages = keys.filter(key => 
      this.SUPPORTED_LANGUAGES.includes(key)
    );
    
    if (validLanguages.length === 0) return false;
    
    // 检查所有值是否为字符串
    return keys.every(key => typeof text[key] === 'string');
  }

  /**
   * 批量处理翻译
   */
  static batchProcessTranslations(
    templates: any[],
    allTranslations: TranslationData
  ): ProcessingResult[] {
    const results: ProcessingResult[] = [];

    for (const template of templates) {
      const translations = allTranslations[template.slug];
      
      if (!translations) {
        results.push({
          success: false,
          templateSlug: template.slug,
          fieldsProcessed: 0,
          errors: [`No translations found for template ${template.slug}`],
          warnings: []
        });
        continue;
      }

      const result = this.applyTranslationToTemplate(template, translations);
      results.push(result);
    }

    return results;
  }

  /**
   * 合并多个翻译批次
   */
  static mergeTranslationBatches(batches: any[]): TranslationData {
    const merged: TranslationData = {};

    for (const batch of batches) {
      if (batch.templates) {
        for (const [templateSlug, translations] of Object.entries(batch.templates)) {
          merged[templateSlug] = translations as TranslationData[string];
        }
      }
    }

    return merged;
  }

  /**
   * 生成处理报告
   */
  static generateProcessingReport(results: ProcessingResult[]): {
    totalTemplates: number;
    successfulTemplates: number;
    totalFieldsProcessed: number;
    totalErrors: number;
    totalWarnings: number;
    successRate: number;
    summary: string;
    detailedResults: ProcessingResult[];
  } {
    const totalTemplates = results.length;
    const successfulTemplates = results.filter(r => r.success).length;
    const totalFieldsProcessed = results.reduce((sum, r) => sum + r.fieldsProcessed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const successRate = (successfulTemplates / totalTemplates) * 100;

    const summary = `
翻译处理报告:
- 处理模板总数: ${totalTemplates}
- 成功处理: ${successfulTemplates}
- 处理字段总数: ${totalFieldsProcessed}
- 错误总数: ${totalErrors}
- 警告总数: ${totalWarnings}
- 成功率: ${successRate.toFixed(1)}%

${results.filter(r => !r.success).length > 0 ? `
失败的模板:
${results.filter(r => !r.success).map(r => `- ${r.templateSlug}: ${r.errors.join(', ')}`).join('\n')}
` : ''}

${totalWarnings > 0 ? `
警告信息:
${results.filter(r => r.warnings.length > 0).map(r => 
  `- ${r.templateSlug}: ${r.warnings.join(', ')}`
).join('\n')}
` : ''}
    `;

    return {
      totalTemplates,
      successfulTemplates,
      totalFieldsProcessed,
      totalErrors,
      totalWarnings,
      successRate,
      summary,
      detailedResults: results
    };
  }

  /**
   * 验证翻译数据完整性
   */
  static validateTranslationData(translationData: TranslationData): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [templateSlug, translations] of Object.entries(translationData)) {
      // 检查模板名称
      if (translations.name && !this.validateMultilingualText(translations.name)) {
        errors.push(`Invalid name translation for template ${templateSlug}`);
      }

      // 检查模板描述
      if (translations.description && !this.validateMultilingualText(translations.description)) {
        errors.push(`Invalid description translation for template ${templateSlug}`);
      }

      // 检查参数翻译
      if (translations.params) {
        for (const [paramKey, paramTranslations] of Object.entries(translations.params)) {
          // 检查参数标签
          if (paramTranslations.label && !this.validateMultilingualText(paramTranslations.label)) {
            errors.push(`Invalid label translation for parameter ${paramKey} in template ${templateSlug}`);
          }

          // 检查选项翻译
          if (paramTranslations.options) {
            if (Array.isArray(paramTranslations.options)) {
              // 数组格式的选项
              paramTranslations.options.forEach((option, index) => {
                if (!this.validateMultilingualText(option.label)) {
                  errors.push(
                    `Invalid option label translation for parameter ${paramKey}[${index}] in template ${templateSlug}`
                  );
                }
              });
            } else {
              // 对象格式的选项（以value为键）
              for (const [optionValue, optionLabel] of Object.entries(paramTranslations.options)) {
                if (!this.validateMultilingualText(optionLabel)) {
                  errors.push(
                    `Invalid option label translation for parameter ${paramKey}[${optionValue}] in template ${templateSlug}`
                  );
                }
              }
            }
          }
        }
      }

      // 检查语言完整性
      const languageCompleteness = this.checkLanguageCompleteness(translations);
      if (languageCompleteness.warnings.length > 0) {
        warnings.push(`Template ${templateSlug}: ${languageCompleteness.warnings.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 检查语言完整性
   */
  private static checkLanguageCompleteness(translations: TranslationData[string]): {
    warnings: string[];
  } {
    const warnings: string[] = [];
    const allLanguages = new Set<string>();

    // 收集所有使用的语言
    if (translations.name && typeof translations.name === 'object') {
      Object.keys(translations.name).forEach(lang => allLanguages.add(lang));
    }
    if (translations.description && typeof translations.description === 'object') {
      Object.keys(translations.description).forEach(lang => allLanguages.add(lang));
    }

    // 检查是否所有字段都有相同的语言支持
    const expectedLanguages = Array.from(allLanguages);
    
    if (expectedLanguages.length > 0) {
      // 检查缺失的语言
      const missingLanguages = this.SUPPORTED_LANGUAGES.filter(
        lang => !expectedLanguages.includes(lang)
      );
      
      if (missingLanguages.length > 0) {
        warnings.push(`Missing languages: ${missingLanguages.join(', ')}`);
      }
    }

    return { warnings };
  }
}