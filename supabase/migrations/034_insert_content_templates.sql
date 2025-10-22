-- ============================================
-- Insert SEO Content Template Definitions
-- Version: 034
-- Description: 插入3种核心内容模板定义（How-To, Alternatives, Platform-Specific）
-- ============================================

-- ============================================
-- 1. How-To Tutorial 模板
-- ============================================
INSERT INTO public.seo_content_templates (
  name,
  slug,
  description,
  template_type,
  structure_schema,
  prompt_template,
  recommended_word_count,
  min_word_count,
  max_word_count,
  keyword_density_targets,
  is_active,
  sort_order
) VALUES (
  'How-To Tutorial',
  'how-to',
  '教程类内容模板，适用于"How to"开头的长尾关键词，提供分步骤指导',
  'how-to',

  -- structure_schema
  '{
    "required_sections": [
      {
        "name": "Introduction",
        "h2_title": "What is {keyword}?",
        "min_words": 100,
        "max_words": 200,
        "keyword_mentions": {
          "target_keyword": 1,
          "related_keywords": "1-2"
        },
        "content_requirements": [
          "定义目标关键词",
          "说明为什么重要",
          "预览将要学到的内容"
        ]
      },
      {
        "name": "Prerequisites",
        "h2_title": "What You Need to {keyword}",
        "min_words": 80,
        "max_words": 150,
        "keyword_mentions": {
          "target_keyword": 1
        },
        "content_requirements": [
          "列出所需工具/软件",
          "列出所需技能水平",
          "估算所需时间"
        ]
      },
      {
        "name": "Step-by-Step Guide",
        "h2_title": "How to {keyword}: Step-by-Step",
        "min_words": 800,
        "max_words": 1200,
        "keyword_mentions": {
          "target_keyword": "5-8",
          "related_keywords": "3-5"
        },
        "content_requirements": [
          "至少5个具体步骤",
          "每个步骤有清晰的H3标题",
          "每个步骤包含具体操作",
          "可选：包含截图或视频说明"
        ],
        "subsections": [
          {
            "level": "h3",
            "pattern": "Step {number}: {action}",
            "count": "5-8"
          }
        ]
      },
      {
        "name": "Tips and Best Practices",
        "h2_title": "Best Practices for {keyword}",
        "min_words": 200,
        "max_words": 350,
        "keyword_mentions": {
          "target_keyword": "2-3",
          "related_keywords": "1-2"
        },
        "content_requirements": [
          "3-5个专业建议",
          "常见陷阱提醒",
          "优化技巧"
        ]
      },
      {
        "name": "Common Mistakes",
        "h2_title": "Common Mistakes When {keyword}",
        "min_words": 150,
        "max_words": 250,
        "keyword_mentions": {
          "target_keyword": "1-2"
        },
        "content_requirements": [
          "列出3-5个常见错误",
          "说明如何避免",
          "提供正确做法"
        ]
      },
      {
        "name": "Conclusion",
        "h2_title": "Start {keyword} Today",
        "min_words": 100,
        "max_words": 150,
        "keyword_mentions": {
          "target_keyword": 1
        },
        "content_requirements": [
          "总结关键要点",
          "鼓励行动",
          "CTA：使用我们的工具"
        ]
      }
    ],
    "faq_config": {
      "min_items": 4,
      "max_items": 6,
      "keyword_mentions_per_faq": "1-2",
      "answer_length_guide": {
        "en": "80-120 words (concise and focused)",
        "zh": "150-250 characters",
        "ja": "150-250 characters",
        "ko": "150-250 characters",
        "es": "80-120 words",
        "de": "80-120 words",
        "fr": "80-120 words",
        "ar": "150-250 characters"
      },
      "question_patterns": [
        "How long does it take to {keyword}?",
        "What is the best way to {keyword}?",
        "Can beginners {keyword}?",
        "What tools do I need to {keyword}?",
        "How much does it cost to {keyword}?"
      ]
    }
  }'::jsonb,

  -- prompt_template (will be generated dynamically by promptBuilderService)
  'TEMPLATE_PLACEHOLDER',

  1600,  -- recommended_word_count
  1200,  -- min_word_count
  2200,  -- max_word_count

  -- keyword_density_targets
  '{
    "target_keyword": {
      "min": 2.0,
      "ideal": 2.5,
      "max": 3.0
    },
    "related_keywords": {
      "min": 0.8,
      "ideal": 1.2,
      "max": 1.8
    }
  }'::jsonb,

  true,  -- is_active
  1      -- sort_order
);

-- ============================================
-- 2. Alternatives & Competitors 模板
-- ============================================
INSERT INTO public.seo_content_templates (
  name,
  slug,
  description,
  template_type,
  structure_schema,
  prompt_template,
  recommended_word_count,
  min_word_count,
  max_word_count,
  keyword_density_targets,
  is_active,
  sort_order
) VALUES (
  'Alternatives & Competitors',
  'alternatives',
  '替代品对比类模板，适用于"alternatives"、"vs"、"best"等对比型关键词',
  'alternatives',

  -- structure_schema
  '{
    "required_sections": [
      {
        "name": "Introduction",
        "h2_title": "Best Alternatives to {keyword}",
        "min_words": 100,
        "max_words": 200,
        "keyword_mentions": {
          "target_keyword": 2,
          "related_keywords": "1-2"
        },
        "content_requirements": [
          "说明为什么需要寻找替代品",
          "概述替代品的类型",
          "预览将要比较的工具"
        ]
      },
      {
        "name": "Comparison Table",
        "h2_title": "{keyword} Alternatives Comparison",
        "content_type": "table",
        "content_requirements": [
          "至少5-8个替代品",
          "对比维度：价格、功能、易用性、评分",
          "表格后添加200-300字的解释"
        ]
      },
      {
        "name": "Detailed Alternatives",
        "h2_title": "Top {keyword} Alternatives in Detail",
        "min_words": 1000,
        "max_words": 1500,
        "keyword_mentions": {
          "target_keyword": "5-8",
          "competitor_names": "10-15"
        },
        "subsections": [
          {
            "level": "h3",
            "pattern": "{number}. {Alternative Name} - {Unique Selling Point}",
            "count": "5-8",
            "each_subsection": {
              "min_words": 150,
              "max_words": 250,
              "structure": [
                "简介（50字）",
                "主要特点（3-5点）",
                "优点（2-3点）",
                "缺点（1-2点）",
                "定价",
                "最适合：XXX用户"
              ]
            }
          }
        ]
      },
      {
        "name": "How to Choose",
        "h2_title": "How to Choose the Right {keyword} Alternative",
        "min_words": 200,
        "max_words": 350,
        "keyword_mentions": {
          "target_keyword": "2-3"
        },
        "content_requirements": [
          "选择标准（5-7个）",
          "决策框架",
          "不同场景的推荐"
        ]
      },
      {
        "name": "Pricing Comparison",
        "h2_title": "{keyword} Alternatives: Pricing Breakdown",
        "min_words": 150,
        "max_words": 250,
        "content_requirements": [
          "价格区间总结",
          "性价比分析",
          "免费vs付费建议"
        ]
      },
      {
        "name": "Conclusion",
        "h2_title": "Which {keyword} Alternative is Best for You?",
        "min_words": 100,
        "max_words": 150,
        "keyword_mentions": {
          "target_keyword": 1
        },
        "content_requirements": [
          "快速推荐指南",
          "按用户类型推荐",
          "CTA：试用我们的工具"
        ]
      }
    ],
    "faq_config": {
      "min_items": 4,
      "max_items": 6,
      "answer_length_guide": {
        "en": "80-120 words (concise and focused)",
        "zh": "150-250 characters",
        "ja": "150-250 characters",
        "ko": "150-250 characters",
        "es": "80-120 words",
        "de": "80-120 words",
        "fr": "80-120 words",
        "ar": "150-250 characters"
      },
      "question_patterns": [
        "What are the best alternatives to {keyword}?",
        "Is there a free alternative to {keyword}?",
        "Which {keyword} alternative is easiest to use?",
        "What is the cheapest alternative to {keyword}?",
        "Can I use {keyword} alternative for {use case}?"
      ]
    },
    "competitors_schema": {
      "min_competitors": 5,
      "max_competitors": 10,
      "each_competitor": {
        "name": "string",
        "logo_url": "string",
        "rating": "number (1-5)",
        "pricing": {
          "free_tier": "boolean",
          "starting_price": "number",
          "currency": "string"
        },
        "key_features": "string[]",
        "pros": "string[]",
        "cons": "string[]",
        "best_for": "string"
      }
    }
  }'::jsonb,

  'TEMPLATE_PLACEHOLDER',

  1800,  -- recommended_word_count
  1400,  -- min_word_count
  2500,  -- max_word_count

  -- keyword_density_targets
  '{
    "target_keyword": {
      "min": 1.8,
      "ideal": 2.2,
      "max": 2.8
    },
    "competitor_names": {
      "min": 0.5,
      "ideal": 0.8,
      "max": 1.2
    }
  }'::jsonb,

  true,
  2
);

-- ============================================
-- 3. Platform-Specific Guide 模板
-- ============================================
INSERT INTO public.seo_content_templates (
  name,
  slug,
  description,
  template_type,
  structure_schema,
  prompt_template,
  recommended_word_count,
  min_word_count,
  max_word_count,
  keyword_density_targets,
  is_active,
  sort_order
) VALUES (
  'Platform-Specific Guide',
  'platform-specific',
  '平台专属指南模板，适用于包含平台名称的关键词（YouTube, TikTok, Instagram等）',
  'platform-specific',

  -- structure_schema
  '{
    "required_sections": [
      {
        "name": "Introduction",
        "h2_title": "{keyword} Guide for {Platform}",
        "min_words": 100,
        "max_words": 200,
        "keyword_mentions": {
          "target_keyword": 2,
          "platform_name": 2
        },
        "content_requirements": [
          "说明平台的特点",
          "为什么针对该平台优化很重要",
          "预览将要学到的内容"
        ]
      },
      {
        "name": "Platform Requirements",
        "h2_title": "{Platform} Video Requirements and Specs",
        "min_words": 200,
        "max_words": 350,
        "keyword_mentions": {
          "platform_name": "3-4"
        },
        "content_requirements": [
          "视频格式要求",
          "分辨率和尺寸",
          "时长限制",
          "文件大小限制",
          "推荐设置"
        ],
        "special_format": "specifications_table"
      },
      {
        "name": "Platform Best Practices",
        "h2_title": "How to Optimize {keyword} for {Platform}",
        "min_words": 400,
        "max_words": 600,
        "keyword_mentions": {
          "target_keyword": "4-6",
          "platform_name": "5-7"
        },
        "content_requirements": [
          "针对平台算法的优化技巧",
          "内容策略建议",
          "发布时间建议",
          "标签和描述优化",
          "互动策略"
        ]
      },
      {
        "name": "Step-by-Step Guide",
        "h2_title": "How to {keyword} for {Platform}: Complete Workflow",
        "min_words": 600,
        "max_words": 900,
        "keyword_mentions": {
          "target_keyword": "5-8",
          "platform_name": "4-6"
        },
        "subsections": [
          {
            "level": "h3",
            "pattern": "Step {number}: {action} for {Platform}",
            "count": "6-8",
            "each_subsection": {
              "min_words": 80,
              "max_words": 130
            }
          }
        ]
      },
      {
        "name": "Platform-Specific Tips",
        "h2_title": "{Platform} Video Tips and Tricks",
        "min_words": 250,
        "max_words": 400,
        "keyword_mentions": {
          "platform_name": "3-5"
        },
        "content_requirements": [
          "5-7个平台独有的技巧",
          "案例分析",
          "成功示例"
        ]
      },
      {
        "name": "Common Mistakes",
        "h2_title": "Mistakes to Avoid on {Platform}",
        "min_words": 150,
        "max_words": 250,
        "keyword_mentions": {
          "platform_name": "2-3"
        },
        "content_requirements": [
          "3-5个常见错误",
          "违规注意事项",
          "性能陷阱"
        ]
      },
      {
        "name": "Conclusion",
        "h2_title": "Start Creating {keyword} for {Platform}",
        "min_words": 100,
        "max_words": 150,
        "keyword_mentions": {
          "target_keyword": 1,
          "platform_name": 1
        },
        "content_requirements": [
          "总结关键要点",
          "平台优势回顾",
          "CTA：使用我们的工具"
        ]
      }
    ],
    "faq_config": {
      "min_items": 5,
      "max_items": 7,
      "answer_length_guide": {
        "en": "80-120 words (concise and focused)",
        "zh": "150-250 characters",
        "ja": "150-250 characters",
        "ko": "150-250 characters",
        "es": "80-120 words",
        "de": "80-120 words",
        "fr": "80-120 words",
        "ar": "150-250 characters"
      },
      "question_patterns": [
        "What is the best format for {keyword} on {Platform}?",
        "How long should {keyword} be for {Platform}?",
        "Can I use {keyword} on {Platform}?",
        "What resolution is best for {Platform}?",
        "How often should I post {keyword} on {Platform}?",
        "What hashtags should I use for {keyword} on {Platform}?"
      ]
    },
    "platform_specs_schema": {
      "platform_name": "string",
      "video_specs": {
        "aspect_ratios": "string[]",
        "resolutions": "string[]",
        "max_duration": "number",
        "min_duration": "number",
        "max_file_size": "number",
        "supported_formats": "string[]"
      },
      "algorithm_insights": "string",
      "best_practices": "string[]"
    }
  }'::jsonb,

  'TEMPLATE_PLACEHOLDER',

  1700,  -- recommended_word_count
  1300,  -- min_word_count
  2400,  -- max_word_count

  -- keyword_density_targets
  '{
    "target_keyword": {
      "min": 2.0,
      "ideal": 2.5,
      "max": 3.0
    },
    "platform_name": {
      "min": 1.5,
      "ideal": 2.0,
      "max": 2.5
    }
  }'::jsonb,

  true,
  3
);

-- ============================================
-- 验证插入结果
-- ============================================
SELECT
  name,
  slug,
  template_type,
  recommended_word_count,
  is_active
FROM public.seo_content_templates
ORDER BY sort_order;
