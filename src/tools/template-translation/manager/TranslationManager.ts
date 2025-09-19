/**
 * 翻译管理器 - 提供高级翻译管理功能
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { TranslationEngine, TemplateAnalyzer, TranslationProcessor } from '../engine';
import type { TranslationData } from '../engine';

export interface BackupInfo {
  timestamp: string;
  description: string;
  templateCount: number;
  filePath: string;
}

export interface TranslationManagerOptions {
  templatesDir: string;
  translationDataDir: string;
  backupDir: string;
  dryRun?: boolean;
}

export class TranslationManager {
  private options: TranslationManagerOptions;

  constructor(options: TranslationManagerOptions) {
    this.options = options;
  }

  /**
   * 加载所有模板文件
   */
  async loadTemplates(): Promise<any[]> {
    try {
      const templateFiles = await fs.readdir(this.options.templatesDir);
      const jsonFiles = templateFiles.filter(file => file.endsWith('.json'));
      
      const templates = await Promise.all(
        jsonFiles.map(async file => {
          const filePath = join(this.options.templatesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        })
      );

      return templates;
    } catch (error) {
      throw new Error(`Failed to load templates: ${error}`);
    }
  }

  /**
   * 加载所有翻译批次
   */
  async loadTranslationBatches(): Promise<any[]> {
    try {
      const translationFiles = await fs.readdir(this.options.translationDataDir);
      const batchFiles = translationFiles.filter(file => 
        file.startsWith('translations-batch-') && file.endsWith('.json')
      );
      
      const batches = await Promise.all(
        batchFiles.map(async file => {
          const filePath = join(this.options.translationDataDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        })
      );

      return batches;
    } catch (error) {
      throw new Error(`Failed to load translation batches: ${error}`);
    }
  }

  /**
   * 加载术语表
   */
  async loadTerminology(): Promise<any> {
    try {
      const terminologyPath = join(this.options.translationDataDir, 'terminology.json');
      const content = await fs.readFile(terminologyPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load terminology: ${error}`);
    }
  }

  /**
   * 创建备份
   */
  async createBackup(description: string): Promise<BackupInfo> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `templates-backup-${timestamp}.json`;
      const backupPath = join(this.options.backupDir, backupFileName);

      // 确保备份目录存在
      await fs.mkdir(this.options.backupDir, { recursive: true });

      // 加载所有模板
      const templates = await this.loadTemplates();

      // 创建备份文件
      const backupData = {
        timestamp: new Date().toISOString(),
        description,
        templateCount: templates.length,
        templates
      };

      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

      return {
        timestamp,
        description,
        templateCount: templates.length,
        filePath: backupPath
      };
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const backupFiles = await fs.readdir(this.options.backupDir);
      const backupInfos = await Promise.all(
        backupFiles
          .filter(file => file.startsWith('templates-backup-') && file.endsWith('.json'))
          .map(async file => {
            const filePath = join(this.options.backupDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const backup = JSON.parse(content);
            
            return {
              timestamp: backup.timestamp,
              description: backup.description,
              templateCount: backup.templateCount,
              filePath
            };
          })
      );

      return backupInfos.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      throw new Error(`Failed to list backups: ${error}`);
    }
  }

  /**
   * 恢复备份
   */
  async restoreBackup(backupInfo: BackupInfo): Promise<void> {
    try {
      const content = await fs.readFile(backupInfo.filePath, 'utf-8');
      const backup = JSON.parse(content);

      // 写回模板文件
      for (const template of backup.templates) {
        const templatePath = join(this.options.templatesDir, `${template.slug}.json`);
        await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');
      }
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error}`);
    }
  }

  /**
   * 预览翻译效果
   */
  async previewTranslations(): Promise<{
    preview: any[];
    report: any;
  }> {
    const templates = await this.loadTemplates();
    const translationBatches = await this.loadTranslationBatches();

    const result = await TranslationEngine.processTranslations({
      templates,
      translationBatches,
      validate: true,
      generateReport: true
    });

    return {
      preview: result.processedTemplates,
      report: result.report
    };
  }

  /**
   * 应用翻译（执行实际的文件修改）
   */
  async applyTranslations(options: {
    createBackup?: boolean;
    backupDescription?: string;
  } = {}): Promise<{
    success: boolean;
    report: any;
    backup?: BackupInfo;
  }> {
    const { createBackup = true, backupDescription = 'Before translation application' } = options;

    try {
      // 1. 创建备份（如果需要）
      let backup;
      if (createBackup) {
        backup = await this.createBackup(backupDescription);
      }

      // 2. 加载数据
      const templates = await this.loadTemplates();
      const translationBatches = await this.loadTranslationBatches();

      // 3. 应用翻译
      const result = await TranslationEngine.processTranslations({
        templates,
        translationBatches,
        validate: true,
        generateReport: true
      });

      if (!result.success) {
        return {
          success: false,
          report: result.report,
          backup
        };
      }

      // 4. 写回文件（如果不是 dry run）
      if (!this.options.dryRun) {
        for (const template of result.processedTemplates) {
          const templatePath = join(this.options.templatesDir, `${template.slug}.json`);
          await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');
        }
      }

      return {
        success: true,
        report: result.report,
        backup
      };

    } catch (error) {
      throw new Error(`Failed to apply translations: ${error}`);
    }
  }

  /**
   * 生成翻译状态报告
   */
  async generateStatusReport(): Promise<{
    templateAnalysis: any;
    translationCoverage: any;
    issues: string[];
    recommendations: string[];
  }> {
    const templates = await this.loadTemplates();
    const analysisResults = TemplateAnalyzer.analyzeTemplates(templates);
    const analysisReport = TemplateAnalyzer.generateAnalysisReport(analysisResults);

    const issues: string[] = [];
    const recommendations: string[] = [];

    // 检查翻译覆盖率
    const untranslatedTemplates = analysisResults.filter(r => r.requiresTranslation);
    if (untranslatedTemplates.length > 0) {
      issues.push(`${untranslatedTemplates.length} templates still need translation`);
      recommendations.push('Run translation application to update remaining templates');
    }

    // 检查翻译数据文件
    try {
      const translationBatches = await this.loadTranslationBatches();
      const mergedTranslations = TranslationProcessor.mergeTranslationBatches(translationBatches);
      const validation = TranslationProcessor.validateTranslationData(mergedTranslations);
      
      if (!validation.isValid) {
        issues.push(...validation.errors);
      }
      if (validation.warnings.length > 0) {
        issues.push(...validation.warnings);
      }
    } catch (error) {
      issues.push(`Failed to load translation data: ${error}`);
    }

    return {
      templateAnalysis: analysisReport,
      translationCoverage: {
        totalTemplates: templates.length,
        translatedTemplates: templates.length - untranslatedTemplates.length,
        untranslatedTemplates: untranslatedTemplates.map(t => t.slug)
      },
      issues,
      recommendations
    };
  }

  /**
   * 验证翻译完整性
   */
  async validateTranslations(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    details: any;
  }> {
    try {
      const translationBatches = await this.loadTranslationBatches();
      const mergedTranslations = TranslationProcessor.mergeTranslationBatches(translationBatches);
      const validation = TranslationProcessor.validateTranslationData(mergedTranslations);

      // 检查模板覆盖率
      const templates = await this.loadTemplates();
      const templateSlugs = templates.map(t => t.slug);
      const translationSlugs = Object.keys(mergedTranslations);
      
      const missingTranslations = templateSlugs.filter(slug => !translationSlugs.includes(slug));
      const extraTranslations = translationSlugs.filter(slug => !templateSlugs.includes(slug));

      if (missingTranslations.length > 0) {
        validation.warnings.push(`Missing translations for templates: ${missingTranslations.join(', ')}`);
      }
      if (extraTranslations.length > 0) {
        validation.warnings.push(`Extra translations for unknown templates: ${extraTranslations.join(', ')}`);
      }

      return {
        ...validation,
        details: {
          totalTemplates: templates.length,
          translatedTemplates: translationSlugs.length,
          missingTranslations,
          extraTranslations
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error}`],
        warnings: [],
        details: {}
      };
    }
  }
}