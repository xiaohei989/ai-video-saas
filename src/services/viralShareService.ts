/**
 * 病毒传播分享话术生成服务
 * 核心价值主张：$0.60每视频 + 零技能门槛
 */

export interface ShareTemplate {
  platform: 'tiktok' | 'youtube' | 'instagram' | 'twitter' | 'facebook' | 'linkedin'
  title: string
  description: string
  hashtags: string[]
  callToAction: string
  style: 'shocking' | 'professional' | 'casual' | 'educational'
  language: 'en' | 'zh' | 'ja' | 'ko' | 'es'
}

export interface VideoShareContent {
  videoTitle: string
  videoDescription: string
  templateCategory: string
  videoUrl: string
  shareUrl: string
}

class ViralShareService {
  private readonly basePrice = 0.6 // $0.60 per video core value prop

  /**
   * 生成平台特定的病毒传播话术
   */
  generateViralContent(
    platform: ShareTemplate['platform'], 
    content: VideoShareContent, 
    style: ShareTemplate['style'] = 'shocking',
    language: ShareTemplate['language'] = 'en'
  ): ShareTemplate {
    const templates = this.getTemplates(platform, style, language)
    const selectedTemplate = this.selectBestTemplate(templates, content)
    
    return {
      platform,
      ...selectedTemplate,
      title: this.personalizeContent(selectedTemplate.title, content),
      description: this.personalizeContent(selectedTemplate.description, content),
      hashtags: this.generateRelevantHashtags(platform, content, language),
      callToAction: this.personalizeContent(selectedTemplate.callToAction, content),
      style,
      language
    }
  }

  /**
   * 获取平台话术模板
   */
  private getTemplates(platform: string, style: string, language: string = 'en') {
    const templates = {
      en: {
        tiktok: {
          shocking: [
            {
              title: "🤯 VIRAL VIDEOS FOR JUST $0.60 EACH!",
              description: "Professional quality that used to cost $500+ per video. No skills needed - AI does EVERYTHING! {{videoTitle}} proves anyone can go viral on a budget!",
              callToAction: "Link in bio to start creating! 🔥"
            },
            {
              title: "💰 From $500 to $0.60 per video!",
              description: "I used to pay hundreds for videos like this. Now I make them for 60 cents! {{videoTitle}} took me 2 minutes and zero skills. Mind = blown! 🤯",
              callToAction: "Try it yourself - link in bio!"
            },
            {
              title: "🚀 60 CENTS = PROFESSIONAL VIRAL VIDEO",
              description: "This {{templateCategory}} video cost me $0.60 to make. Would've been $300+ from a studio. AI leveled the playing field for creators like us!",
              callToAction: "Who else wants to join the 60-cent revolution?"
            }
          ]
        }
      },
      youtube: {
        shocking: [
          {
            title: "How I Make Viral Videos for 60 Cents Each (Results Will Shock You!)",
            description: "Forget expensive equipment and years of training. I'm about to show you how I create professional viral videos for just $0.60 each using AI. This {{videoTitle}} is proof that the future of content creation is here, and it's incredibly affordable!",
            callToAction: "Subscribe for more budget creator secrets!"
          },
          {
            title: "AI Video Creation: $0.60 vs $500+ Per Video (Honest Comparison)",
            description: "I tested both expensive professional video services and this new AI tool. The results? You can get 99% of the quality for 0.1% of the price. Here's my honest review of creating {{templateCategory}} content on a budget.",
            callToAction: "Check description for links and start creating!"
          }
        ],
        educational: [
          {
            title: "The Complete Guide to $0.60 Professional Video Creation",
            description: "In this comprehensive tutorial, I'll show you exactly how to create studio-quality videos for just 60 cents each. Perfect for content creators, small businesses, and anyone who wants professional results without the professional price tag.",
            callToAction: "Links and resources in the description below!"
          }
        ]
      },
      instagram: {
        shocking: [
          {
            title: "💸 60 cents per viral video",
            description: "Professional quality {{templateCategory}} content without the professional price tag. {{videoTitle}} proves that amazing videos don't need amazing budgets - just amazing AI! ✨",
            callToAction: "Link in bio to start creating! 💎"
          }
        ],
        casual: [
          {
            title: "Budget creator life 💰",
            description: "When you discover you can make professional videos for 60 cents each... {{videoTitle}} is the proof! No expensive gear, no technical skills, just AI magic ✨",
            callToAction: "DM me for the link! 📩"
          }
        ]
      },
      twitter: {
        shocking: [
          {
            title: "Viral videos for $0.60 each 🤯",
            description: "What used to cost:\n❌ $500+ per professional video\n❌ Expensive equipment\n❌ Technical expertise\n❌ Hours of editing\n\nNow costs: ✅ $0.60 + zero skills\n\nAI democratized content creation 🔥",
            callToAction: "RT if you think everyone deserves access to professional tools!"
          }
        ],
        professional: [
          {
            title: "The economics of content creation just changed",
            description: "Professional video production costs dropped from $500+ to $0.60 per piece. This isn't just about price - it's about accessibility. {{videoTitle}} represents the democratization of professional content creation.",
            callToAction: "Thread below with details 👇"
          }
        ]
      },
      facebook: {
        shocking: [
          {
            title: "I can't believe professional videos now cost just 60 cents each!",
            description: "Remember when quality video content required expensive equipment, technical expertise, and hundreds of dollars per video? Those days are over! I just created this amazing {{templateCategory}} video ({{videoTitle}}) for only $0.60 using AI. The results speak for themselves! This technology is making professional content creation accessible to everyone, regardless of budget or technical background. 🎬💰",
            callToAction: "Comment 'LINK' and I'll send you the details!"
          }
        ]
      },
      linkedin: {
        professional: [
          {
            title: "How AI reduced our video production costs by 99.8%",
            description: "As a business owner, I'm always looking for cost-effective solutions. When I discovered I could create professional {{templateCategory}} videos for $0.60 each instead of the usual $500+, I was skeptical. This {{videoTitle}} changed my perspective entirely. We're now producing more content than ever while staying within budget.",
            callToAction: "What's your experience with budget-friendly content creation tools?"
          }
        ]
      }
    }

    const platformTemplates = templates[platform as keyof typeof templates]
    if (!platformTemplates) return []
    
    const styleTemplates = platformTemplates[style as keyof typeof platformTemplates]
    return styleTemplates || platformTemplates.shocking || []
  }

  /**
   * 选择最佳模板
   */
  private selectBestTemplate(templates: any[], content: VideoShareContent) {
    // 简单随机选择，后续可以基于内容智能匹配
    return templates[Math.floor(Math.random() * templates.length)]
  }

  /**
   * 个性化内容
   */
  private personalizeContent(template: string, content: VideoShareContent): string {
    return template
      .replace(/\{\{videoTitle\}\}/g, content.videoTitle)
      .replace(/\{\{videoDescription\}\}/g, content.videoDescription)
      .replace(/\{\{templateCategory\}\}/g, content.templateCategory)
      .replace(/\{\{shareUrl\}\}/g, content.shareUrl)
      .replace(/\{\{price\}\}/g, `$${this.basePrice}`)
  }

  /**
   * 生成相关标签
   */
  private generateRelevantHashtags(platform: string, content: VideoShareContent): string[] {
    const baseHashtags = ['AIVideo', 'BudgetCreator', 'NoSkillsNeeded']
    const priceHashtags = ['60CentVideos', 'BudgetViral', 'AffordableAI']
    const categoryHashtags = this.getCategoryHashtags(content.templateCategory)
    
    const platformSpecific = {
      tiktok: ['CreatorHack', 'ViralHack', 'AIRevolution', 'TechTok'],
      instagram: ['CreatorEconomy', 'ContentCreator', 'AIArt', 'DigitalCreator'],
      youtube: ['VideoCreation', 'ContentStrategy', 'CreatorTips'],
      twitter: ['CreatorEconomy', 'AITools', 'StartupLife'],
      facebook: ['SmallBusiness', 'Entrepreneur', 'Innovation'],
      linkedin: ['Innovation', 'DigitalTransformation', 'CostEfficiency']
    }

    return [
      ...baseHashtags,
      ...priceHashtags.slice(0, 2), // 限制数量
      ...categoryHashtags.slice(0, 2),
      ...(platformSpecific[platform] || []).slice(0, 3)
    ]
  }

  /**
   * 获取分类相关标签
   */
  private getCategoryHashtags(category: string): string[] {
    const categoryMap = {
      'ASMR': ['ASMR', 'Relaxing', 'Satisfying', 'Mindful'],
      'Art': ['Art', 'Creative', 'Artistic', 'Visual'],
      'Magic': ['Magic', 'Surreal', 'Mystical', 'Enchanting'],
      'Food': ['Food', 'Cooking', 'Culinary', 'Tasty'],
      'Nature': ['Nature', 'Peaceful', 'Organic', 'Natural'],
      'Animation': ['Animation', 'Motion', 'Dynamic', 'Animated']
    }

    return categoryMap[category] || ['Creative', 'Amazing', 'Unique']
  }

  /**
   * 生成价格对比文案
   */
  generatePriceComparison(): string {
    return `💰 COST COMPARISON:
❌ Traditional studio: $500-2000 per video
❌ Freelance editor: $100-500 per video  
❌ Video course + software: $200/month
✅ Our AI solution: $0.60 per video

That's 99.8% cheaper than traditional methods! 🤯`
  }

  /**
   * 生成病毒金句
   */
  generateViralQuotes(): string[] {
    return [
      "60 cents. Zero skills. Infinite possibilities. 💫",
      "Cheaper than gum, more viral than TikTok dances 🕺", 
      "The 60-cent revolution: AI for everyone 🔥",
      "Professional videos for pocket change 💰",
      "Why pay $500 when 60 cents does the trick? 🤔",
      "From broke to viral creator - just add AI ⚡",
      "Skip film school, embrace 60-cent magic 🎓",
      "Democracy in content creation: $0.60 at a time 🗳️"
    ]
  }

  /**
   * 生成完整的分享包
   */
  generateCompleteSharePackage(platform: ShareTemplate['platform'], content: VideoShareContent) {
    const mainContent = this.generateViralContent(platform, content, 'shocking')
    const priceComparison = this.generatePriceComparison()
    const viralQuotes = this.generateViralQuotes()
    
    return {
      mainContent,
      priceComparison,
      viralQuotes: viralQuotes.slice(0, 3), // 前3个最佳金句
      alternatives: [
        this.generateViralContent(platform, content, 'professional'),
        this.generateViralContent(platform, content, 'casual')
      ].filter(Boolean)
    }
  }

  /**
   * 为特定视频生成多版本分享内容
   */
  generateMultiVersionShare(content: VideoShareContent) {
    const platforms: ShareTemplate['platform'][] = ['tiktok', 'youtube', 'instagram', 'twitter', 'facebook']
    
    return platforms.reduce((acc, platform) => {
      acc[platform] = this.generateCompleteSharePackage(platform, content)
      return acc
    }, {} as Record<string, any>)
  }
}

export const viralShareService = new ViralShareService()
export default viralShareService