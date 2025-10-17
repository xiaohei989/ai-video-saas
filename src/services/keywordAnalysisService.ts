/**
 * 关键词分析服务
 * 负责分析长尾关键词，提取差异化因子，推荐内容模板
 */

export interface DifferentiationFactors {
  keywordType: string | null        // 关键词类型：how-to, comparison, general等
  searchIntent: string | null        // 搜索意图：informational, commercial, transactional
  scenario: string | null            // 场景：youtube_optimization, tiktok_optimization等
  audience: string | null            // 受众：beginners, professionals, kids等
  platform: string | null            // 平台：youtube, tiktok, instagram等
  device: string | null              // 设备：iphone, android, desktop等
  useCase: string | null             // 用例：marketing, education, entertainment等
}

export interface KeywordAnalysisResult {
  keyword: string
  keywordSlug: string
  differentiationFactors: DifferentiationFactors
  recommendedTemplateSlug: string
  confidence: number                 // 推荐置信度 0-1
}

class KeywordAnalysisService {

  /**
   * 分析关键词并提取所有信息
   */
  analyzeKeyword(keyword: string): KeywordAnalysisResult {
    const lowerKeyword = keyword.toLowerCase().trim()

    // 1. 提取差异化因子
    const factors = this.extractDifferentiationFactors(lowerKeyword)

    // 2. 推荐内容模板
    const { templateSlug, confidence } = this.recommendContentTemplate(lowerKeyword, factors)

    // 3. 生成URL友好的slug
    const keywordSlug = this.generateKeywordSlug(lowerKeyword)

    return {
      keyword: keyword.trim(),
      keywordSlug,
      differentiationFactors: factors,
      recommendedTemplateSlug: templateSlug,
      confidence
    }
  }

  /**
   * 从关键词中提取差异化因子
   */
  private extractDifferentiationFactors(keyword: string): DifferentiationFactors {
    const factors: DifferentiationFactors = {
      keywordType: null,
      searchIntent: null,
      scenario: null,
      audience: null,
      platform: null,
      device: null,
      useCase: null
    }

    // 1. 检测平台
    const platforms = {
      youtube: ['youtube', 'yt', 'you tube'],
      tiktok: ['tiktok', 'tik tok', 'tt'],
      instagram: ['instagram', 'ig', 'insta', 'reels', 'stories'],
      facebook: ['facebook', 'fb'],
      twitter: ['twitter', 'x'],
      linkedin: ['linkedin'],
      snapchat: ['snapchat', 'snap'],
      pinterest: ['pinterest'],
      reddit: ['reddit']
    }

    for (const [platform, keywords] of Object.entries(platforms)) {
      if (keywords.some(kw => keyword.includes(kw))) {
        factors.platform = platform
        factors.scenario = `${platform}_optimization`
        break
      }
    }

    // 2. 检测设备
    const devices = {
      iphone: ['iphone', 'ios'],
      android: ['android'],
      desktop: ['desktop', 'computer', 'pc', 'mac'],
      mobile: ['mobile', 'phone'],
      tablet: ['tablet', 'ipad']
    }

    for (const [device, keywords] of Object.entries(devices)) {
      if (keywords.some(kw => keyword.includes(kw))) {
        factors.device = device
        break
      }
    }

    // 3. 检测受众
    const audiences = {
      beginners: ['beginner', 'newbie', 'starter', 'basic', 'simple', 'easy', 'for dummies', 'getting started'],
      professionals: ['professional', 'pro', 'expert', 'advanced', 'master'],
      kids: ['kids', 'children', 'child'],
      teens: ['teen', 'teenager'],
      business: ['business', 'commercial', 'enterprise', 'corporate'],
      students: ['student', 'school'],
      freelancers: ['freelance', 'freelancer']
    }

    for (const [audience, keywords] of Object.entries(audiences)) {
      if (keywords.some(kw => keyword.includes(kw))) {
        factors.audience = audience
        break
      }
    }

    // 4. 检测搜索意图和关键词类型
    // How-to类型（信息型）
    if (keyword.match(/^(how to|how do|ways to|guide to|tutorial|learn)/)) {
      factors.searchIntent = 'informational'
      factors.keywordType = 'how-to'
    }
    // 对比类型（商业调研型）
    else if (keyword.match(/(best|top|vs|versus|compare|comparison|alternative|instead|replace)/)) {
      factors.searchIntent = 'commercial'

      // 细分对比类型
      if (keyword.includes('alternative') || keyword.includes('instead') || keyword.includes('replace')) {
        factors.keywordType = 'alternatives'
      } else if (keyword.includes('vs') || keyword.includes('versus') || keyword.includes('compare')) {
        factors.keywordType = 'comparison'
      } else if (keyword.match(/(best|top)/)) {
        factors.keywordType = 'best-of'
      } else {
        factors.keywordType = 'comparison'
      }
    }
    // 评测类型（商业调研型）
    else if (keyword.match(/(review|rating|pros and cons)/)) {
      factors.searchIntent = 'commercial'
      factors.keywordType = 'review'
    }
    // 交易类型
    else if (keyword.match(/(buy|price|cost|cheap|discount|free|download|get|purchase)/)) {
      factors.searchIntent = 'transactional'
      factors.keywordType = 'transactional'
    }
    // 默认：信息型
    else {
      factors.searchIntent = 'informational'
      factors.keywordType = 'general'
    }

    // 5. 检测用例场景
    const useCases = {
      marketing: ['marketing', 'promo', 'promotion', 'advertis', 'campaign'],
      education: ['education', 'educational', 'teaching', 'learning', 'course', 'tutorial', 'lesson'],
      entertainment: ['fun', 'entertainment', 'viral', 'funny', 'comedy'],
      business: ['business', 'corporate', 'professional', 'work'],
      personal: ['personal', 'family', 'home'],
      social_media: ['social media', 'social', 'viral'],
      ecommerce: ['product', 'shop', 'store', 'sell']
    }

    for (const [useCase, keywords] of Object.entries(useCases)) {
      if (keywords.some(kw => keyword.includes(kw))) {
        factors.useCase = useCase
        // 如果scenario还未设置，使用useCase
        if (!factors.scenario) {
          factors.scenario = useCase
        }
        break
      }
    }

    // 6. 特殊：检测视频格式/方向
    if (keyword.match(/(vertical|portrait|9:16)/)) {
      if (!factors.scenario) factors.scenario = 'vertical_video'
    } else if (keyword.match(/(horizontal|landscape|16:9)/)) {
      if (!factors.scenario) factors.scenario = 'horizontal_video'
    }

    // 7. 特殊：检测时长
    if (keyword.match(/(short|quick|5 minute|10 minute|fast)/)) {
      if (!factors.scenario) factors.scenario = 'quick_creation'
    } else if (keyword.match(/(long|detailed|comprehensive)/)) {
      if (!factors.scenario) factors.scenario = 'detailed_guide'
    }

    return factors
  }

  /**
   * 推荐最适合的内容模板
   */
  private recommendContentTemplate(
    keyword: string,
    factors: DifferentiationFactors
  ): { templateSlug: string; confidence: number } {

    // 规则1：包含平台名 → Platform-Specific模板（高置信度）
    if (factors.platform) {
      return {
        templateSlug: 'platform-specific',
        confidence: 0.9
      }
    }

    // 规则2：How-to关键词 → How-To模板（高置信度）
    if (factors.keywordType === 'how-to') {
      return {
        templateSlug: 'how-to',
        confidence: 0.95
      }
    }

    // 规则3：替代品/对比关键词 → Alternatives模板（高置信度）
    if (factors.keywordType === 'alternatives' || factors.keywordType === 'comparison') {
      return {
        templateSlug: 'alternatives',
        confidence: 0.9
      }
    }

    // 规则4：Best/Top关键词 → Alternatives模板（中等置信度）
    if (factors.keywordType === 'best-of') {
      return {
        templateSlug: 'alternatives',
        confidence: 0.7
      }
    }

    // 规则5：包含for [platform] → Platform-Specific模板（中等置信度）
    if (keyword.match(/for (youtube|tiktok|instagram|facebook)/i)) {
      return {
        templateSlug: 'platform-specific',
        confidence: 0.8
      }
    }

    // 规则6：信息型但非how-to → How-To模板（中等置信度）
    if (factors.searchIntent === 'informational') {
      return {
        templateSlug: 'how-to',
        confidence: 0.6
      }
    }

    // 规则7：商业型 → Alternatives模板（低置信度）
    if (factors.searchIntent === 'commercial') {
      return {
        templateSlug: 'alternatives',
        confidence: 0.5
      }
    }

    // 默认：How-To模板（低置信度）
    return {
      templateSlug: 'how-to',
      confidence: 0.4
    }
  }

  /**
   * 生成URL友好的keyword slug
   */
  private generateKeywordSlug(keyword: string): string {
    return keyword
      .toLowerCase()
      .trim()
      // 替换特殊字符为空格
      .replace(/[^\w\s-]/g, '')
      // 多个空格替换为单个连字符
      .replace(/\s+/g, '-')
      // 多个连字符替换为单个连字符
      .replace(/-+/g, '-')
      // 去掉首尾连字符
      .replace(/^-+|-+$/g, '')
      // 限制长度（最多200字符）
      .slice(0, 200)
  }

  /**
   * 批量分析关键词
   */
  analyzeBatch(keywords: string[]): KeywordAnalysisResult[] {
    return keywords.map(kw => this.analyzeKeyword(kw))
  }

  /**
   * 验证关键词是否适合生成内容
   */
  validateKeyword(keyword: string): {
    isValid: boolean
    reason?: string
  } {
    const trimmed = keyword.trim()

    // 检查1：长度
    if (trimmed.length < 3) {
      return {
        isValid: false,
        reason: '关键词太短（至少3个字符）'
      }
    }

    if (trimmed.length > 200) {
      return {
        isValid: false,
        reason: '关键词太长（最多200个字符）'
      }
    }

    // 检查2：是否包含不适当的字符
    if (trimmed.match(/[<>{}[\]\\]/)) {
      return {
        isValid: false,
        reason: '包含不允许的特殊字符'
      }
    }

    // 检查3：是否只包含特殊字符和空格
    if (!trimmed.match(/[a-zA-Z0-9\u4e00-\u9fa5]/)) {
      return {
        isValid: false,
        reason: '必须包含字母、数字或汉字'
      }
    }

    return {
      isValid: true
    }
  }

  /**
   * 检测关键词冲突（是否已存在相似关键词）
   */
  detectSimilarKeywords(
    keyword: string,
    existingKeywords: string[]
  ): {
    hasSimilar: boolean
    similarKeywords: string[]
    similarity: number[]
  } {
    const lowerKeyword = keyword.toLowerCase().trim()
    const similarKeywords: string[] = []
    const similarities: number[] = []

    for (const existing of existingKeywords) {
      const lowerExisting = existing.toLowerCase().trim()

      // 完全相同
      if (lowerKeyword === lowerExisting) {
        similarKeywords.push(existing)
        similarities.push(1.0)
        continue
      }

      // 计算Levenshtein距离（简化版：字符级别相似度）
      const similarity = this.calculateStringSimilarity(lowerKeyword, lowerExisting)

      if (similarity > 0.85) {  // 85%相似度视为相似
        similarKeywords.push(existing)
        similarities.push(similarity)
      }
    }

    return {
      hasSimilar: similarKeywords.length > 0,
      similarKeywords,
      similarity: similarities
    }
  }

  /**
   * 计算两个字符串的相似度（简化的Jaccard相似度）
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/))
    const words2 = new Set(str2.split(/\s+/))

    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }
}

export const keywordAnalysisService = new KeywordAnalysisService()
export default keywordAnalysisService
