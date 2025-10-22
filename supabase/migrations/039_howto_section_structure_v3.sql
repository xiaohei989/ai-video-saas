-- =====================================================
-- SEO内容模板 - How-To章节结构补充 v3.0
-- =====================================================
--
-- 问题: how-to模板的 structure_schema.required_sections 当前为空
-- 解决: 添加标准的how-to教程章节结构
-- 目标: 支持关键词任务分配算法
--
-- 依赖: 033_programmatic_seo_system.sql
-- =====================================================

-- 更新 how-to 模板的章节结构
UPDATE seo_content_templates
SET
  structure_schema = '{
    "required_sections": [
      {
        "name": "Introduction",
        "h2_title": "What is {keyword}?",
        "min_words": 150,
        "max_words": 250,
        "keyword_mentions": {
          "target_keyword": 2
        },
        "content_requirements": [
          "定义和核心概念",
          "为什么重要/有用",
          "主要用途和应用场景",
          "预览文章将要涵盖的内容"
        ],
        "position_rules": {
          "first_sentence": 1,
          "middle_paragraphs": 1
        }
      },
      {
        "name": "Why Use",
        "h2_title": "Why Use {keyword}?",
        "min_words": 200,
        "max_words": 300,
        "keyword_mentions": {
          "target_keyword": 2
        },
        "content_requirements": [
          "3-5个核心优势",
          "与其他方法的对比",
          "适用人群/场景",
          "数据或案例支持"
        ]
      },
      {
        "name": "Key Features",
        "h2_title": "Key Features of {keyword}",
        "min_words": 250,
        "max_words": 400,
        "keyword_mentions": {
          "target_keyword": 2
        },
        "content_requirements": [
          "5-7个主要功能特性",
          "每个特性简短说明(50-80字)",
          "使用emoji或列表格式",
          "突出独特卖点"
        ]
      },
      {
        "name": "How to Use",
        "h2_title": "How to Use {keyword}: Step-by-Step Guide",
        "min_words": 500,
        "max_words": 800,
        "keyword_mentions": {
          "target_keyword": 7
        },
        "subsections": [
          {
            "level": "h3",
            "pattern": "Step {number}: {action}",
            "count": "6-8",
            "each_subsection": {
              "min_words": 60,
              "max_words": 120,
              "structure": [
                "简短标题(动作导向)",
                "详细步骤说明",
                "具体参数或设置",
                "截图占位符(可选)"
              ]
            }
          }
        ],
        "content_requirements": [
          "循序渐进的操作步骤",
          "每个步骤清晰可执行",
          "包含具体参数和设置",
          "添加图片Alt占位符"
        ],
        "position_rules": {
          "first_sentence": 1,
          "subsection_titles": 2,
          "step_descriptions": 4
        }
      },
      {
        "name": "Best Practices",
        "h2_title": "Best Practices for {keyword}",
        "min_words": 300,
        "max_words": 450,
        "keyword_mentions": {
          "target_keyword": 3
        },
        "content_requirements": [
          "5-7个最佳实践建议",
          "专业技巧和诀窍",
          "优化建议",
          "行业标准或基准"
        ]
      },
      {
        "name": "Common Mistakes",
        "h2_title": "Common Mistakes to Avoid with {keyword}",
        "min_words": 200,
        "max_words": 350,
        "keyword_mentions": {
          "target_keyword": 2
        },
        "content_requirements": [
          "3-5个常见错误",
          "为什么是错误",
          "正确的解决方法",
          "避免的后果说明"
        ]
      },
      {
        "name": "Tips and Tricks",
        "h2_title": "{keyword} Tips and Tricks for Advanced Users",
        "min_words": 250,
        "max_words": 400,
        "keyword_mentions": {
          "target_keyword": 3
        },
        "content_requirements": [
          "5-7个高级技巧",
          "创意用法",
          "隐藏功能",
          "专业级优化"
        ]
      },
      {
        "name": "Conclusion",
        "h2_title": "Get Started with {keyword} Today",
        "min_words": 100,
        "max_words": 150,
        "keyword_mentions": {
          "target_keyword": 1
        },
        "content_requirements": [
          "总结关键要点",
          "鼓励行动",
          "CTA: 使用我们的工具",
          "下一步建议"
        ],
        "position_rules": {
          "last_sentence": 1
        }
      }
    ],
    "faq_config": {
      "min_items": 5,
      "max_items": 7,
      "question_patterns": [
        "What is {keyword}?",
        "How do I get started with {keyword}?",
        "What are the best tools for {keyword}?",
        "How long does it take to learn {keyword}?",
        "Is {keyword} suitable for beginners?",
        "What equipment do I need for {keyword}?",
        "Can I use {keyword} on mobile devices?"
      ]
    },
    "meta_config": {
      "title_template": "{keyword}: Complete Guide for Beginners (2025)",
      "title_min_chars": 50,
      "title_max_chars": 60,
      "description_template": "Learn how to master {keyword} with our comprehensive 2025 guide. Discover 10+ proven tips, step-by-step tutorials, and expert advice to create professional results. Perfect for beginners!",
      "description_min_chars": 150,
      "description_max_chars": 160
    }
  }'::jsonb,

  -- 更新推荐字数 (根据章节结构计算)
  recommended_word_count = 1600,
  min_word_count = 1300,
  max_word_count = 2000,

  updated_at = NOW()

WHERE slug = 'how-to';

-- 验证更新
DO $$
DECLARE
  section_count INTEGER;
BEGIN
  SELECT jsonb_array_length(structure_schema->'required_sections')
  INTO section_count
  FROM seo_content_templates
  WHERE slug = 'how-to';

  IF section_count IS NULL OR section_count = 0 THEN
    RAISE EXCEPTION 'how-to模板章节结构更新失败: required_sections为空';
  ELSE
    RAISE NOTICE '✅ how-to模板章节结构更新成功: % 个章节', section_count;
  END IF;
END $$;

-- 输出摘要信息
SELECT
  slug,
  name,
  recommended_word_count,
  jsonb_array_length(structure_schema->'required_sections') as section_count,
  jsonb_array_length(structure_schema->'faq_config'->'question_patterns') as faq_pattern_count
FROM seo_content_templates
WHERE slug = 'how-to';

COMMENT ON COLUMN seo_content_templates.structure_schema IS 'SEO内容结构定义 - v3.0: 包含position_rules支持关键词任务分配算法';
