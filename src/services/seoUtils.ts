/**
 * SEO 工具函数
 * 用于避免循环依赖
 */

/**
 * 计算关键词密度
 */
export function calculateKeywordDensity(content: string, keyword: string): number {
  if (!content || !keyword) return 0
  
  const lowerContent = content.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  
  // 统计关键词出现次数
  const matches = lowerContent.match(new RegExp(lowerKeyword, 'g'))
  const keywordCount = matches ? matches.length : 0
  
  // 统计总词数（简单按空格分割）
  const totalWords = content.trim().split(/\s+/).length
  
  if (totalWords === 0) return 0
  
  // 返回百分比
  return (keywordCount / totalWords) * 100
}

/**
 * 提取完整内容（从markdown中）
 */
export function extractFullContent(markdown: string): string {
  if (!markdown) return ''
  
  // 移除markdown语法
  let text = markdown
    .replace(/^#{1,6}\s+/gm, '') // 标题
    .replace(/\*\*(.+?)\*\*/g, '$1') // 粗体
    .replace(/\*(.+?)\*/g, '$1') // 斜体
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 链接
    .replace(/`(.+?)`/g, '$1') // 代码
    .replace(/^>\s+/gm, '') // 引用
    .replace(/^-\s+/gm, '') // 列表
    .replace(/^\d+\.\s+/gm, '') // 有序列表
  
  return text.trim()
}

/**
 * 计算关键词密度分数 (0-100)
 */
export function calculateKeywordDensityScore(density: number): number {
  // 理想密度在 1-3% 之间
  if (density >= 1 && density <= 3) {
    return 100
  } else if (density > 3 && density <= 5) {
    // 稍高，按比例扣分
    return Math.max(70, 100 - (density - 3) * 10)
  } else if (density > 0 && density < 1) {
    // 稍低，按比例扣分
    return Math.max(70, density * 100)
  } else if (density > 5) {
    // 过高，大幅扣分
    return Math.max(30, 100 - (density - 3) * 15)
  }
  
  return 0
}
