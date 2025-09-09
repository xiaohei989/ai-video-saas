/**
 * 简化版病毒传播分享话术生成服务
 * 核心价值主张：$0.60每视频 + 零技能门槛
 */

interface ViralTemplate {
  title: string
  description: string
  hashtags: string[]
  callToAction: string
}

class SimpleViralShareService {
  /**
   * 生成英文病毒话术
   */
  generateEnglishViral(videoTitle: string, templateCategory: string, shareUrl: string): ViralTemplate {
    const templates = [
      {
        title: "🤯 VIRAL VIDEOS FOR JUST $0.60 EACH!",
        description: `Professional quality that used to cost $500+ per video. No skills needed - AI does EVERYTHING! "${videoTitle}" proves anyone can go viral on a budget!`,
        hashtags: ["60CentVideos", "AIVideo", "BudgetCreator", "NoSkillsNeeded", "ViralHack"],
        callToAction: "Link in bio to start creating! 🔥"
      },
      {
        title: "💰 From $500 to $0.60 per video!",
        description: `I used to pay hundreds for videos like this. Now I make them for 60 cents! "${videoTitle}" took me 2 minutes and zero skills. Mind = blown! 🤯`,
        hashtags: ["BudgetViral", "AffordableAI", "CreatorHack", "AIRevolution"],
        callToAction: "Try it yourself - everyone deserves to go viral!"
      },
      {
        title: "🚀 Professional videos for pocket change",
        description: `This ${templateCategory} video cost me $0.60 to make. Would've been $300+ from a studio. AI leveled the playing field for creators like us!`,
        hashtags: ["PocketChangeVideos", "AIVideo", "BudgetCreator", "CreatorEconomy"],
        callToAction: "Who else wants to join the 60-cent revolution?"
      }
    ]
    
    const selected = templates[Math.floor(Math.random() * templates.length)]
    return {
      ...selected,
      description: selected.description + `\n\nWatch: ${shareUrl}`
    }
  }

  /**
   * 生成中文病毒话术
   */
  generateChineseViral(videoTitle: string, templateCategory: string, shareUrl: string): ViralTemplate {
    const templates = [
      {
        title: "🤯 专业视频竟然只要4块钱！",
        description: `以前做这种视频要花几千块，现在AI帮你4块钱搞定！"${videoTitle}"证明普通人也能做爆款视频！不需要任何技术！`,
        hashtags: ["4块钱视频", "AI神器", "便宜爆款", "零门槛", "爆款秘籍"],
        callToAction: "评论区要链接！🔥"
      },
      {
        title: "💰 从几千块到4块钱的神器！", 
        description: `我以前花几百块请人做视频，现在用AI 4块钱就搞定！"${videoTitle}"用了2分钟，零技术要求。太震撼了！🤯`,
        hashtags: ["便宜神器", "AI革命", "创作神器", "黑科技"],
        callToAction: "你们也试试，人人都能爆红！"
      },
      {
        title: "🚀 专业视频，零花钱价格",
        description: `这个${templateCategory}视频成本4块钱，专业工作室要收几百块。AI让普通人也能做专业内容！`,
        hashtags: ["零花钱视频", "AI视频", "便宜创作", "创作经济"],
        callToAction: "谁还想加入4块钱革命？"
      }
    ]
    
    const selected = templates[Math.floor(Math.random() * templates.length)]
    return {
      ...selected,
      description: selected.description + `\n\n观看：${shareUrl}`
    }
  }

  /**
   * 根据语言生成病毒话术
   */
  generateViral(videoTitle: string, templateCategory: string, shareUrl: string, language: string = 'en'): ViralTemplate {
    if (language === 'zh' || language === 'zh-CN') {
      return this.generateChineseViral(videoTitle, templateCategory, shareUrl)
    }
    return this.generateEnglishViral(videoTitle, templateCategory, shareUrl)
  }

  /**
   * 生成价格对比文案
   */
  generatePriceComparison(language: string = 'en'): string {
    if (language === 'zh' || language === 'zh-CN') {
      return `💰 价格对比：
❌ 传统工作室：3000-12000元/视频
❌ 自由职业者：600-3000元/视频
❌ 课程+软件：1200元/月
✅ 我们的AI方案：4元/视频

比传统方法便宜99.8%！🤯`
    }
    
    return `💰 COST COMPARISON:
❌ Traditional studio: $500-2000 per video
❌ Freelance editor: $100-500 per video  
❌ Video course + software: $200/month
✅ Our AI solution: $0.60 per video

That's 99.8% cheaper than traditional methods! 🤯`
  }

  /**
   * 生成完整的分享文本
   */
  generateCompleteShareText(videoTitle: string, templateCategory: string, shareUrl: string, language: string = 'en'): string {
    const viral = this.generateViral(videoTitle, templateCategory, shareUrl, language)
    const hashtags = viral.hashtags.map(tag => `#${tag}`).join(' ')
    
    return `${viral.title}

${viral.description}

${hashtags}

${viral.callToAction}`
  }
}

export const simpleViralShareService = new SimpleViralShareService()
export default simpleViralShareService