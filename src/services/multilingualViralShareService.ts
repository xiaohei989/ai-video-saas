/**
 * 多语言病毒传播分享话术生成服务
 * 核心价值主张：$0.60每视频 + 零技能门槛
 * 支持：英文、中文、日文、韩文、西班牙文
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

class MultilingualViralShareService {
  private readonly basePrice = 0.6 // $0.60 per video core value prop

  /**
   * 生成多语言病毒传播话术
   */
  generateViralContent(
    platform: ShareTemplate['platform'], 
    content: VideoShareContent, 
    style: ShareTemplate['style'] = 'shocking',
    language: ShareTemplate['language'] = 'en'
  ): ShareTemplate {
    const templates = this.getMultilingualTemplates(platform, style, language)
    const selectedTemplate = this.selectBestTemplate(templates)
    
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
   * 获取多语言平台话术模板
   */
  private getMultilingualTemplates(platform: string, style: string, language: string) {
    const allTemplates = {
      // 英文模板
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
          ],
          professional: [
            {
              title: "Professional {{templateCategory}} videos for $0.60 each",
              description: "Creating high-quality content doesn't require expensive equipment or technical expertise. This {{videoTitle}} demonstrates professional-grade results at an accessible price point.",
              callToAction: "Explore affordable professional video creation"
            }
          ]
        },
        youtube: {
          shocking: [
            {
              title: "How I Make Viral Videos for 60 Cents Each (Results Will Shock You!)",
              description: "Forget expensive equipment and years of training. I'm about to show you how I create professional viral videos for just $0.60 each using AI. This {{videoTitle}} is proof that the future of content creation is here, and it's incredibly affordable!",
              callToAction: "Subscribe for more budget creator secrets!"
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
          ]
        },
        twitter: {
          shocking: [
            {
              title: "Viral videos for $0.60 each 🤯",
              description: "What used to cost:\n❌ $500+ per professional video\n❌ Expensive equipment\n❌ Technical expertise\n❌ Hours of editing\n\nNow costs: ✅ $0.60 + zero skills\n\nAI democratized content creation 🔥",
              callToAction: "RT if you think everyone deserves access to professional tools!"
            }
          ]
        },
        facebook: {
          shocking: [
            {
              title: "I can't believe professional videos now cost just 60 cents each!",
              description: "Remember when quality video content required expensive equipment and hundreds of dollars per video? Those days are over! I just created this {{templateCategory}} video ({{videoTitle}}) for only $0.60 using AI. This technology is making professional content creation accessible to everyone! 🎬💰",
              callToAction: "Comment 'LINK' and I'll send you the details!"
            }
          ]
        }
      },
      // 中文模板
      zh: {
        tiktok: {
          shocking: [
            {
              title: "🤯 专业视频竟然只要4块钱！",
              description: "以前做这种视频要花几千块，现在AI帮你4块钱搞定！{{videoTitle}}证明普通人也能做爆款视频！不需要任何技术！",
              callToAction: "评论区要链接！🔥"
            },
            {
              title: "💰 从几千块到4块钱的神器！",
              description: "我以前花几百块请人做视频，现在用AI 4块钱就搞定！{{videoTitle}}用了2分钟，零技术要求。太震撼了！🤯",
              callToAction: "你们也试试，链接在简介！"
            },
            {
              title: "🚀 4块钱做出专业级爆款视频",
              description: "这个{{templateCategory}}视频成本4块钱，专业工作室要收几百块。AI让普通人也能做专业内容！",
              callToAction: "谁还想加入4块钱革命？"
            }
          ]
        },
        youtube: {
          shocking: [
            {
              title: "我用4块钱做爆款视频的方法（效果震撼！）",
              description: "忘掉昂贵设备和多年学习吧！我来教你如何用AI花4块钱做出专业爆款视频。这个{{videoTitle}}就是证明，内容创作的未来已经到来，而且便宜得不敢相信！",
              callToAction: "订阅频道，获取更多省钱创作秘籍！"
            }
          ]
        },
        instagram: {
          shocking: [
            {
              title: "💸 一条视频4块钱",
              description: "专业品质的{{templateCategory}}内容，不需要专业价格。{{videoTitle}}证明好视频不需要大预算，只需要好AI！✨",
              callToAction: "简介链接开始创作！💎"
            }
          ]
        }
      },
      // 日文模板
      ja: {
        tiktok: {
          shocking: [
            {
              title: "🤯 プロ動画がたった100円で作れる！",
              description: "以前は数万円かかっていたプロ品質の動画が100円で！スキル不要、AIが全部やってくれる！{{videoTitle}}が証拠です！",
              callToAction: "リンクはプロフィールに！🔥"
            },
            {
              title: "💰 数万円から100円の革命！",
              description: "こんな動画に数万円払ってたなんて...今はAIで100円！{{videoTitle}}は2分で完成、技術ゼロでOK。衝撃的！🤯",
              callToAction: "みんなも試してみて！"
            }
          ]
        },
        youtube: {
          shocking: [
            {
              title: "100円でバイラル動画を作る方法（結果に驚愕！）",
              description: "高額な機材や長年の学習は不要！AIを使って100円でプロ品質のバイラル動画を作る方法をお見せします。この{{videoTitle}}がその証拠です！",
              callToAction: "チャンネル登録で節約クリエイターの秘訣をゲット！"
            }
          ]
        }
      },
      // 韩文模板
      ko: {
        tiktok: {
          shocking: [
            {
              title: "🤯 전문 영상이 800원에！",
              description: "예전엔 수십만원 들던 전문 영상이 800원으로! 기술 필요없어요 - AI가 다 해줘요! {{videoTitle}}이 증거예요!",
              callToAction: "프로필 링크 확인하세요! 🔥"
            },
            {
              title: "💰 수십만원에서 800원으로!",
              description: "이런 영상에 수십만원 냈었는데... 이제 AI로 800원에! {{videoTitle}} 2분만에 완성, 기술 제로! 대박! 🤯",
              callToAction: "여러분도 해보세요!"
            }
          ]
        }
      },
      // 西班牙文模板
      es: {
        tiktok: {
          shocking: [
            {
              title: "🤯 ¡VIDEOS VIRALES POR SOLO $0.60 CADA UNO!",
              description: "Calidad profesional que antes costaba $500+ por video. ¡No necesitas habilidades - la IA hace TODO! {{videoTitle}} prueba que cualquiera puede hacerse viral con presupuesto bajo!",
              callToAction: "¡Enlace en bio para empezar a crear! 🔥"
            },
            {
              title: "💰 ¡De $500 a $0.60 por video!",
              description: "Antes pagaba cientos por videos así. ¡Ahora los hago por 60 centavos! {{videoTitle}} me tomó 2 minutos y cero habilidades. ¡Increíble! 🤯",
              callToAction: "¡Pruébalo tú mismo - enlace en bio!"
            }
          ]
        },
        youtube: {
          shocking: [
            {
              title: "Cómo Hago Videos Virales por 60 Centavos Cada Uno (¡Los Resultados Te Sorprenderán!)",
              description: "Olvídate del equipo caro y años de entrenamiento. Te muestro cómo crear videos virales profesionales por solo $0.60 cada uno usando IA. ¡Este {{videoTitle}} es la prueba de que el futuro de la creación de contenido está aquí y es increíblemente accesible!",
              callToAction: "¡Suscríbete para más secretos de creadores con presupuesto!"
            }
          ]
        }
      }
    }

    return (allTemplates as any)[language]?.[platform]?.[style] || (allTemplates as any)['en']?.[platform]?.[style] || []
  }

  /**
   * 选择最佳模板
   */
  private selectBestTemplate(templates: any[]) {
    // 如果没有模板，返回默认模板
    if (!templates || templates.length === 0) {
      return {
        title: "🤯 VIRAL VIDEOS FOR JUST $0.60 EACH!",
        description: "Professional quality AI-generated content for an unbelievable price! {{videoTitle}} proves anyone can create amazing videos on a budget!",
        callToAction: "Start creating now! 🔥"
      }
    }
    
    // 简单随机选择，后续可以基于内容智能匹配
    return templates[Math.floor(Math.random() * templates.length)] || templates[0]
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
   * 生成多语言相关标签
   */
  private generateRelevantHashtags(platform: string, content: VideoShareContent, language: string): string[] {
    const hashtagTemplates = {
      en: {
        base: ['AIVideo', 'BudgetCreator', 'NoSkillsNeeded'],
        price: ['60CentVideos', 'BudgetViral', 'AffordableAI'],
        platform: {
          tiktok: ['CreatorHack', 'ViralHack', 'AIRevolution', 'TechTok'],
          instagram: ['CreatorEconomy', 'ContentCreator', 'AIArt', 'DigitalCreator'],
          youtube: ['VideoCreation', 'ContentStrategy', 'CreatorTips'],
          twitter: ['CreatorEconomy', 'AITools', 'StartupLife'],
          facebook: ['SmallBusiness', 'Entrepreneur', 'Innovation']
        }
      },
      zh: {
        base: ['AI视频', '便宜神器', '零门槛'],
        price: ['4块钱视频', '便宜爆款', 'AI神器'],
        platform: {
          tiktok: ['创作神器', '爆款秘籍', 'AI革命', '黑科技'],
          instagram: ['创作经济', '内容创作', 'AI艺术'],
          youtube: ['视频制作', '创作技巧', '省钱攻略']
        }
      },
      ja: {
        base: ['AI動画', '激安ツール', 'スキル不要'],
        price: ['100円動画', '激安バイラル', 'AIツール'],
        platform: {
          tiktok: ['クリエイター', 'バイラル', 'AI革命'],
          youtube: ['動画制作', 'クリエイター', '節約術']
        }
      },
      ko: {
        base: ['AI영상', '저렴한도구', '기술불필요'],
        price: ['800원영상', '저렴한바이럴', 'AI도구'],
        platform: {
          tiktok: ['크리에이터', '바이럴', 'AI혁명'],
          youtube: ['영상제작', '크리에이터팁']
        }
      },
      es: {
        base: ['VideoIA', 'CreadorBarato', 'SinHabilidades'],
        price: ['Videos60Centavos', 'ViralBarato', 'IAAccesible'],
        platform: {
          tiktok: ['CreadorHack', 'ViralHack', 'RevolucionIA'],
          youtube: ['CreacionVideo', 'ConsejosCreador']
        }
      }
    }

    const langTemplates = (hashtagTemplates as any)[language] || (hashtagTemplates as any)['en']
    const categoryHashtags = this.getCategoryHashtags(content.templateCategory, language)
    
    return [
      ...langTemplates.base,
      ...langTemplates.price.slice(0, 2),
      ...categoryHashtags.slice(0, 2),
      ...(langTemplates.platform[platform] || []).slice(0, 3)
    ]
  }

  /**
   * 获取多语言分类相关标签
   */
  private getCategoryHashtags(category: string, language: string): string[] {
    const categoryMap = {
      en: {
        'ASMR': ['ASMR', 'Relaxing', 'Satisfying', 'Mindful'],
        'Art': ['Art', 'Creative', 'Artistic', 'Visual'],
        'Magic': ['Magic', 'Surreal', 'Mystical', 'Enchanting']
      },
      zh: {
        'ASMR': ['ASMR', '放松', '治愈', '解压'],
        'Art': ['艺术', '创意', '美术', '视觉'],
        'Magic': ['魔法', '超现实', '神奇', '魅力']
      },
      ja: {
        'ASMR': ['ASMR', 'リラックス', '癒し', 'マインドフル'],
        'Art': ['アート', 'クリエイティブ', '芸術'],
        'Magic': ['マジック', '幻想的', '神秘的']
      },
      ko: {
        'ASMR': ['ASMR', '릴렉스', '힐링', '마음챙김'],
        'Art': ['아트', '창의적', '예술적'],
        'Magic': ['마법', '초현실', '신비로운']
      },
      es: {
        'ASMR': ['ASMR', 'Relajante', 'Satisfactorio'],
        'Art': ['Arte', 'Creativo', 'Artistico'],
        'Magic': ['Magia', 'Surreal', 'Mistico']
      }
    }

    return (categoryMap as any)[language]?.[category] || (categoryMap as any)['en']?.[category] || ['Creative', 'Amazing']
  }

  /**
   * 生成多语言价格对比文案
   */
  generatePriceComparison(language: string = 'en'): string {
    const comparisons = {
      en: `💰 COST COMPARISON:
❌ Traditional studio: $500-2000 per video
❌ Freelance editor: $100-500 per video  
❌ Video course + software: $200/month
✅ Our AI solution: $0.60 per video

That's 99.8% cheaper than traditional methods! 🤯`,
      zh: `💰 价格对比：
❌ 传统工作室：3000-12000元/视频
❌ 自由职业者：600-3000元/视频
❌ 课程+软件：1200元/月
✅ 我们的AI方案：4元/视频

比传统方法便宜99.8%！🤯`,
      ja: `💰 コスト比較：
❌ 従来のスタジオ: 7万-30万円/動画
❌ フリーランス: 1.5万-7万円/動画
❌ コース+ソフト: 3万円/月
✅ 私たちのAIソリューション: 100円/動画

従来の方法より99.8%安い！🤯`,
      ko: `💰 비용 비교:
❌ 전통적인 스튜디오: 70만-280만원/영상
❌ 프리랜서: 14만-70만원/영상
❌ 강의+소프트웨어: 28만원/월
✅ 우리 AI 솔루션: 800원/영상

기존 방법보다 99.8% 저렴! 🤯`,
      es: `💰 COMPARACIÓN DE COSTOS:
❌ Estudio tradicional: $500-2000 por video
❌ Editor freelance: $100-500 por video
❌ Curso + software: $200/mes
✅ Nuestra solución IA: $0.60 por video

¡99.8% más barato que métodos tradicionales! 🤯`
    }

    return (comparisons as any)[language] || (comparisons as any)['en']
  }

  /**
   * 生成多语言病毒金句
   */
  generateViralQuotes(language: string = 'en'): string[] {
    const quotes = {
      en: [
        "60 cents. Zero skills. Infinite possibilities. 💫",
        "Cheaper than gum, more viral than TikTok dances 🕺",
        "Professional videos for pocket change 💰",
        "Why pay $500 when 60 cents does the trick? 🤔"
      ],
      zh: [
        "4块钱。零技能。无限可能。💫",
        "比口香糖还便宜，比抖音舞蹈还爆款 🕺",
        "专业视频，零花钱价格 💰",
        "为什么花几百块，4块钱就搞定？🤔"
      ],
      ja: [
        "100円。スキルゼロ。無限の可能性。💫",
        "ガムより安く、TikTokダンスよりバイラル 🕺",
        "お小遣いでプロ動画 💰",
        "なぜ数万円？100円で十分！🤔"
      ],
      ko: [
        "800원. 기술 제로. 무한 가능성. 💫",
        "껌보다 싸고, 틱톡 댄스보다 바이럴 🕺",
        "용돈으로 전문 영상 💰",
        "왜 수십만원? 800원이면 충분! 🤔"
      ],
      es: [
        "60 centavos. Cero habilidades. Posibilidades infinitas. 💫",
        "Más barato que un chicle, más viral que bailes de TikTok 🕺",
        "Videos profesionales por monedas 💰",
        "¿Por qué pagar $500 cuando 60 centavos hacen el truco? 🤔"
      ]
    }

    return (quotes as any)[language] || (quotes as any)['en']
  }

  /**
   * 生成完整的多语言分享包
   */
  generateCompleteSharePackage(
    platform: ShareTemplate['platform'], 
    content: VideoShareContent,
    language: ShareTemplate['language'] = 'en'
  ) {
    const mainContent = this.generateViralContent(platform, content, 'shocking', language)
    const priceComparison = this.generatePriceComparison(language)
    const viralQuotes = this.generateViralQuotes(language)
    
    return {
      mainContent,
      priceComparison,
      viralQuotes: viralQuotes.slice(0, 3),
      alternatives: [
        this.generateViralContent(platform, content, 'professional', language),
        this.generateViralContent(platform, content, 'casual', language)
      ].filter(Boolean)
    }
  }

  /**
   * 为特定视频生成多语言多平台分享内容
   */
  generateMultiLanguageShare(content: VideoShareContent, languages: ShareTemplate['language'][] = ['en', 'zh']) {
    const platforms: ShareTemplate['platform'][] = ['tiktok', 'youtube', 'instagram', 'twitter', 'facebook']
    
    return languages.reduce((acc, language) => {
      acc[language] = platforms.reduce((platformAcc, platform) => {
        platformAcc[platform] = this.generateCompleteSharePackage(platform, content, language)
        return platformAcc
      }, {} as Record<string, any>)
      return acc
    }, {} as Record<string, any>)
  }
}

export const multilingualViralShareService = new MultilingualViralShareService()
export default multilingualViralShareService