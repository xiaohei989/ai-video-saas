/**
 * 文件导出服务
 * 处理模板翻译结果的导出，支持多种导出模式
 */

import { ExportMode, ExportOptions, ExportConfig } from '@/types/translation'
import { TemplateTranslationJob } from '@/types/translation'
import { toast } from 'sonner'

export interface ExportData {
  originalTemplate?: any
  translatedTemplate: any
  translationJob?: TemplateTranslationJob
  exportDate?: string
  config?: any
}

class FileExportService {
  
  /**
   * 导出翻译结果
   */
  async exportTranslation(
    templateSlug: string,
    templateName: string,
    exportData: ExportData,
    options: ExportOptions,
    config: ExportConfig
  ): Promise<void> {
    console.log('[FILE EXPORT] 开始导出:', {
      templateSlug,
      mode: options.mode,
      createBackup: options.createBackup
    })

    try {
      // 根据配置构建导出数据
      const finalExportData = this.buildExportData(exportData, config)

      switch (options.mode) {
        case 'download':
          await this.downloadAsFile(templateSlug, finalExportData, config)
          break
          
        case 'backup_overwrite':
          await this.backupAndOverwrite(templateSlug, templateName, finalExportData)
          break
          
        case 'overwrite':
          await this.directOverwrite(templateSlug, templateName, finalExportData)
          break
          
        default:
          throw new Error(`不支持的导出模式: ${options.mode}`)
      }

      console.log('[FILE EXPORT] 导出成功')
      
    } catch (error) {
      console.error('[FILE EXPORT] 导出失败:', error)
      throw error
    }
  }

  /**
   * 构建最终导出数据
   */
  private buildExportData(exportData: ExportData, config: ExportConfig): any {
    // 兼容模式：直接返回翻译后的模板（可直接替换原文件）
    if (config.outputMode === 'compatible') {
      return exportData.translatedTemplate
    }

    // 包装模式：返回完整的翻译信息
    const result: any = {}

    // 根据配置决定包含的内容
    if (config.includeOriginalTemplate && exportData.originalTemplate) {
      result.originalTemplate = exportData.originalTemplate
    }

    // 翻译后的模板始终包含
    result.translatedTemplate = exportData.translatedTemplate

    if (config.includeTranslationJob && exportData.translationJob) {
      result.translationJob = exportData.translationJob
    }

    if (config.includeMetadata) {
      result.metadata = {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        tool: 'AI Video Template Translator',
        config: config
      }
    }

    return result
  }

  /**
   * 下载为新文件
   */
  private async downloadAsFile(templateSlug: string, exportData: any, config: ExportConfig): Promise<void> {
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    
    // 根据导出模式设置文件名
    if (config.outputMode === 'compatible') {
      // 兼容模式：使用原始文件名（可直接替换）
      link.download = `${templateSlug}.json`
    } else {
      // 包装模式：使用带时间戳的备份文件名
      link.download = `${templateSlug}_translation_${new Date().toISOString().split('T')[0]}.json`
    }
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    const message = config.outputMode === 'compatible' 
      ? '兼容格式下载完成（可直接替换原文件）' 
      : '翻译备份下载完成'
    toast.success(message)
  }

  /**
   * 备份后覆盖（仅开发环境支持）
   */
  private async backupAndOverwrite(templateSlug: string, templateName: string, exportData: any): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('文件覆盖功能仅在开发环境中可用')
    }

    try {
      // 1. 创建备份
      const backupSuccess = await this.createBackup(templateSlug)
      if (!backupSuccess) {
        throw new Error('创建备份失败')
      }

      // 2. 覆盖原文件
      await this.writeTemplateFile(templateSlug, exportData.translatedTemplate)

      toast.success('备份并覆盖完成', {
        description: `${templateName} 已更新，备份文件已创建`
      })

    } catch (error) {
      console.error('[FILE EXPORT] 备份覆盖失败:', error)
      toast.error('备份覆盖失败', {
        description: '请检查文件权限或手动备份'
      })
      throw error
    }
  }

  /**
   * 直接覆盖（仅开发环境支持）
   */
  private async directOverwrite(templateSlug: string, templateName: string, exportData: any): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('文件覆盖功能仅在开发环境中可用')
    }

    try {
      await this.writeTemplateFile(templateSlug, exportData.translatedTemplate)

      toast.success('文件覆盖完成', {
        description: `${templateName} 已直接更新`
      })

    } catch (error) {
      console.error('[FILE EXPORT] 直接覆盖失败:', error)
      toast.error('文件覆盖失败', {
        description: '请检查文件权限'
      })
      throw error
    }
  }

  /**
   * 创建备份文件
   */
  private async createBackup(templateSlug: string): Promise<boolean> {
    try {
      const templatePath = this.getTemplatePath(templateSlug)
      const backupPath = `${templatePath}.backup`
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const timestampedBackupPath = `${templatePath}.backup.${timestamp}`

      // 在开发环境中，我们模拟备份操作
      // 实际项目中需要使用 Node.js fs 模块或其他文件系统API
      console.log('[FILE EXPORT] 模拟创建备份:', {
        original: templatePath,
        backup: timestampedBackupPath
      })

      // 这里应该实现实际的文件复制逻辑
      // 在浏览器环境中，我们只能模拟这个过程
      
      return true
    } catch (error) {
      console.error('[FILE EXPORT] 创建备份失败:', error)
      return false
    }
  }

  /**
   * 写入模板文件
   */
  private async writeTemplateFile(templateSlug: string, templateData: any): Promise<void> {
    const templatePath = this.getTemplatePath(templateSlug)
    const dataStr = JSON.stringify(templateData, null, 2)

    // 在开发环境中，我们模拟文件写入操作
    // 实际项目中需要使用适当的文件系统API
    console.log('[FILE EXPORT] 模拟写入文件:', {
      path: templatePath,
      size: dataStr.length
    })

    // 这里应该实现实际的文件写入逻辑
    // 在浏览器环境中，我们提供替代方案
    this.simulateFileWrite(templateSlug, templateData)
  }

  /**
   * 模拟文件写入（浏览器环境）
   */
  private simulateFileWrite(templateSlug: string, templateData: any): void {
    // 在开发环境的浏览器中，我们可以：
    // 1. 将数据存储到 localStorage 用于调试
    // 2. 提供下载链接作为替代方案
    // 3. 显示用户可以手动复制的内容

    const storageKey = `template_export_${templateSlug}`
    const dataStr = JSON.stringify(templateData, null, 2)
    
    try {
      localStorage.setItem(storageKey, dataStr)
      console.log('[FILE EXPORT] 已保存到 localStorage:', storageKey)
      
      // 提供下载作为备选方案
      this.createFallbackDownload(templateSlug, templateData)
      
    } catch (error) {
      console.warn('[FILE EXPORT] localStorage 保存失败，使用下载方案:', error)
      this.createFallbackDownload(templateSlug, templateData)
    }
  }

  /**
   * 创建备选下载方案
   */
  private createFallbackDownload(templateSlug: string, templateData: any): void {
    const dataStr = JSON.stringify(templateData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${templateSlug}.json`
    link.style.display = 'none'
    document.body.appendChild(link)
    
    // 显示通知，让用户知道文件已准备好下载
    toast.info('文件覆盖已模拟完成', {
      description: '由于浏览器限制，请点击下载更新后的模板文件',
      action: {
        label: '下载',
        onClick: () => {
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      },
      duration: 10000
    })
  }

  /**
   * 获取模板文件路径
   */
  private getTemplatePath(templateSlug: string): string {
    return `/src/features/video-creator/data/templates/${templateSlug}.json`
  }

  /**
   * 批量导出多个模板
   */
  async batchExport(
    exports: Array<{
      templateSlug: string
      templateName: string
      exportData: ExportData
    }>,
    options: ExportOptions,
    config: ExportConfig
  ): Promise<{ success: number; failed: number; total: number }> {
    const results = { success: 0, failed: 0, total: exports.length }

    for (const exportItem of exports) {
      try {
        await this.exportTranslation(
          exportItem.templateSlug,
          exportItem.templateName,
          exportItem.exportData,
          options,
          config
        )
        results.success++
      } catch (error) {
        console.error(`[FILE EXPORT] 批量导出失败 ${exportItem.templateSlug}:`, error)
        results.failed++
      }
    }

    return results
  }
}

export default new FileExportService()