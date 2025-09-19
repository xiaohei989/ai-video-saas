/**
 * 翻译管理命令行界面
 */

import { TranslationManager } from '../manager/TranslationManager';
import { join } from 'path';

export class TranslationCLI {
  private manager: TranslationManager;

  constructor(baseDir: string = process.cwd()) {
    this.manager = new TranslationManager({
      templatesDir: join(baseDir, 'src/features/video-creator/data/templates'),
      translationDataDir: join(baseDir, 'src/tools/template-translation/data'),
      backupDir: join(baseDir, 'src/tools/template-translation/backups'),
      dryRun: false
    });
  }

  /**
   * 显示状态报告
   */
  async showStatus(): Promise<void> {
    console.log('🔍 生成翻译状态报告...\n');
    
    try {
      const report = await this.manager.generateStatusReport();
      
      console.log('📊 模板分析结果:');
      console.log(report.templateAnalysis.summary);
      
      console.log('\n📈 翻译覆盖率:');
      console.log(`- 总模板数: ${report.translationCoverage.totalTemplates}`);
      console.log(`- 已翻译: ${report.translationCoverage.translatedTemplates}`);
      console.log(`- 未翻译: ${report.translationCoverage.untranslatedTemplates.length}`);
      
      if (report.translationCoverage.untranslatedTemplates.length > 0) {
        console.log(`- 未翻译模板: ${report.translationCoverage.untranslatedTemplates.join(', ')}`);
      }
      
      if (report.issues.length > 0) {
        console.log('\n⚠️ 发现的问题:');
        report.issues.forEach(issue => console.log(`- ${issue}`));
      }
      
      if (report.recommendations.length > 0) {
        console.log('\n💡 建议:');
        report.recommendations.forEach(rec => console.log(`- ${rec}`));
      }
      
    } catch (error) {
      console.error('❌ 获取状态报告失败:', error);
    }
  }

  /**
   * 验证翻译数据
   */
  async validate(): Promise<void> {
    console.log('🔍 验证翻译数据...\n');
    
    try {
      const validation = await this.manager.validateTranslations();
      
      if (validation.isValid) {
        console.log('✅ 翻译数据验证通过!');
      } else {
        console.log('❌ 翻译数据验证失败!');
      }
      
      console.log(`\n📊 验证详情:`);
      console.log(`- 总模板数: ${validation.details.totalTemplates}`);
      console.log(`- 已翻译模板数: ${validation.details.translatedTemplates}`);
      
      if (validation.errors.length > 0) {
        console.log('\n❌ 错误:');
        validation.errors.forEach(error => console.log(`- ${error}`));
      }
      
      if (validation.warnings.length > 0) {
        console.log('\n⚠️ 警告:');
        validation.warnings.forEach(warning => console.log(`- ${warning}`));
      }
      
      if (validation.details.missingTranslations?.length > 0) {
        console.log(`\n📝 缺少翻译的模板: ${validation.details.missingTranslations.join(', ')}`);
      }
      
    } catch (error) {
      console.error('❌ 验证失败:', error);
    }
  }

  /**
   * 预览翻译效果
   */
  async preview(): Promise<void> {
    console.log('👀 预览翻译效果...\n');
    
    try {
      const { preview, report } = await this.manager.previewTranslations();
      
      console.log('📊 预览报告:');
      if (report?.analysis) {
        console.log(report.analysis.summary);
      }
      
      if (report?.processing) {
        console.log(report.processing.summary);
      }
      
      // 显示几个示例
      console.log('\n🔍 翻译示例 (前3个模板):');
      preview.slice(0, 3).forEach((template, index) => {
        console.log(`\n${index + 1}. ${template.slug}:`);
        console.log(`   名称: ${JSON.stringify(template.name, null, 2)}`);
        console.log(`   描述: ${JSON.stringify(template.description, null, 2)}`);
      });
      
    } catch (error) {
      console.error('❌ 预览失败:', error);
    }
  }

  /**
   * 应用翻译
   */
  async apply(options: { 
    skipBackup?: boolean; 
    dryRun?: boolean; 
    force?: boolean;
  } = {}): Promise<void> {
    const { skipBackup = false, dryRun = false, force = false } = options;
    
    if (dryRun) {
      console.log('🧪 模拟模式 - 不会修改任何文件\n');
      this.manager = new TranslationManager({
        ...this.manager['options'],
        dryRun: true
      });
    }
    
    console.log('🚀 应用翻译到模板文件...\n');
    
    try {
      // 首先验证
      if (!force) {
        console.log('🔍 验证翻译数据...');
        const validation = await this.manager.validateTranslations();
        
        if (!validation.isValid) {
          console.log('❌ 翻译数据验证失败，请先解决以下问题:');
          validation.errors.forEach(error => console.log(`- ${error}`));
          return;
        }
        
        if (validation.warnings.length > 0) {
          console.log('⚠️ 发现警告:');
          validation.warnings.forEach(warning => console.log(`- ${warning}`));
          console.log('');
        }
      }
      
      // 应用翻译
      const result = await this.manager.applyTranslations({
        createBackup: !skipBackup,
        backupDescription: `Translation application at ${new Date().toISOString()}`
      });
      
      if (result.success) {
        console.log('✅ 翻译应用成功!');
        
        if (result.backup) {
          console.log(`📦 备份已创建: ${result.backup.filePath}`);
        }
        
        if (result.report?.processing) {
          console.log(result.report.processing.summary);
        }
        
        if (!dryRun) {
          console.log('\n🎉 所有模板文件已更新完成!');
        } else {
          console.log('\n🧪 模拟完成 - 实际运行时将修改模板文件');
        }
        
      } else {
        console.log('❌ 翻译应用失败!');
        if (result.report?.processing) {
          console.log(result.report.processing.summary);
        }
      }
      
    } catch (error) {
      console.error('❌ 应用翻译失败:', error);
    }
  }

  /**
   * 列出备份
   */
  async listBackups(): Promise<void> {
    console.log('📦 备份列表:\n');
    
    try {
      const backups = await this.manager.listBackups();
      
      if (backups.length === 0) {
        console.log('没有找到备份文件');
        return;
      }
      
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.timestamp}`);
        console.log(`   描述: ${backup.description}`);
        console.log(`   模板数: ${backup.templateCount}`);
        console.log(`   文件: ${backup.filePath}`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ 获取备份列表失败:', error);
    }
  }

  /**
   * 创建备份
   */
  async createBackup(description: string = 'Manual backup'): Promise<void> {
    console.log('📦 创建备份...\n');
    
    try {
      const backup = await this.manager.createBackup(description);
      
      console.log('✅ 备份创建成功!');
      console.log(`📁 文件: ${backup.filePath}`);
      console.log(`📊 模板数: ${backup.templateCount}`);
      console.log(`⏰ 时间: ${backup.timestamp}`);
      
    } catch (error) {
      console.error('❌ 创建备份失败:', error);
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp(): void {
    console.log(`
🌐 视频模板多语言翻译工具

使用方法:
  status          - 显示翻译状态报告
  validate        - 验证翻译数据完整性
  preview         - 预览翻译效果
  apply           - 应用翻译到模板文件
  apply --dry-run - 模拟应用翻译（不修改文件）
  apply --force   - 强制应用（跳过验证）
  apply --skip-backup - 应用时不创建备份
  backup [description] - 创建手动备份
  list-backups    - 列出所有备份
  help            - 显示此帮助信息

示例:
  npm run translate status
  npm run translate validate
  npm run translate preview
  npm run translate apply
  npm run translate apply --dry-run
  npm run translate backup "Before major changes"
  npm run translate list-backups
    `);
  }
}

// CLI 入口
const cli = new TranslationCLI();
const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case 'status':
      await cli.showStatus();
      break;
    case 'validate':
      await cli.validate();
      break;
    case 'preview':
      await cli.preview();
      break;
    case 'apply':
      const options = {
        skipBackup: args.includes('--skip-backup'),
        dryRun: args.includes('--dry-run'),
        force: args.includes('--force')
      };
      await cli.apply(options);
      break;
    case 'backup':
      const description = args[1] || 'Manual backup';
      await cli.createBackup(description);
      break;
    case 'list-backups':
      await cli.listBackups();
      break;
    case 'help':
    default:
      cli.showHelp();
      break;
  }
})().catch(error => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});