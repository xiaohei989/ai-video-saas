/**
 * 翻译处理引擎主入口
 */

export { TemplateAnalyzer } from './TemplateAnalyzer';
export { TranslationProcessor } from './TranslationProcessor';
export type { 
  AnalysisResult, 
  TranslatableField 
} from './TemplateAnalyzer';
export type { 
  TranslationData, 
  ProcessingResult 
} from './TranslationProcessor';

// 主要的翻译处理流程
export class TranslationEngine {
  /**
   * 完整的翻译处理流程
   */
  static async processTranslations(options: {
    templates: any[];
    translationBatches: any[];
    validate?: boolean;
    generateReport?: boolean;
  }): Promise<{
    success: boolean;
    processedTemplates: any[];
    report?: any;
    validation?: any;
  }> {
    const { templates, translationBatches, validate = true, generateReport = true } = options;

    try {
      // 1. 分析模板
      const analysisResults = TemplateAnalyzer.analyzeTemplates(templates);
      
      // 2. 合并翻译批次
      const mergedTranslations = TranslationProcessor.mergeTranslationBatches(translationBatches);
      
      // 3. 验证翻译数据（可选）
      let validation;
      if (validate) {
        validation = TranslationProcessor.validateTranslationData(mergedTranslations);
        if (!validation.isValid) {
          return {
            success: false,
            processedTemplates: [],
            validation
          };
        }
      }
      
      // 4. 应用翻译
      const processedTemplates = templates.map(template => ({ ...template })); // 创建副本
      const processingResults = TranslationProcessor.batchProcessTranslations(
        processedTemplates,
        mergedTranslations
      );
      
      // 5. 生成报告（可选）
      let report;
      if (generateReport) {
        report = {
          analysis: TemplateAnalyzer.generateAnalysisReport(analysisResults),
          processing: TranslationProcessor.generateProcessingReport(processingResults)
        };
      }
      
      // 只检查有翻译数据的模板是否成功处理
      const templatesWithTranslations = processingResults.filter(r => 
        !r.errors.some(e => e.includes('No translations found'))
      );
      
      return {
        success: templatesWithTranslations.length > 0 && templatesWithTranslations.every(r => r.success),
        processedTemplates,
        report,
        validation
      };
      
    } catch (error) {
      return {
        success: false,
        processedTemplates: [],
        validation: {
          isValid: false,
          errors: [`Engine error: ${error}`],
          warnings: []
        }
      };
    }
  }
}