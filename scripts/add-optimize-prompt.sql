-- 插入一键优化提示词模板到数据库
INSERT INTO ai_prompt_templates (
  name,
  display_name,
  description,
  category,
  prompt_template,
  required_variables,
  optional_variables,
  expected_output_format,
  version,
  is_active,
  created_by
) VALUES (
  'seo-optimize',
  'SEO内容一键优化 v1.0',
  'AI全面优化SEO内容：Meta信息、关键词密度、内容质量、FAQ等',
  'seo',
  '你是一位拥有10年经验的资深 SEO 专家和内容创作大师。

⚠️ CRITICAL LANGUAGE REQUIREMENT - 语言一致性要求（最重要！）
目标语言: {{languageName}} ({{languageCode}})

**这是最关键的要求，必须严格遵守：**
1. ALL content MUST be written ENTIRELY in {{languageName}}
2. 所有优化后的内容必须 100% 使用 {{languageName}}
3. DO NOT mix any other languages - 绝对不能混用其他语言
4. Even if the current content has mixed languages, YOU MUST fix it
5. Meta title, meta description, meta keywords, intro, content, FAQ - ALL must be in {{languageName}}
6. If {{languageName}} is not English, avoid English words unless they are commonly used technical terms
7. 如果发现原内容有语言混用，必须在优化时全部改为 {{languageName}}

## 当前状态分析

**当前评分**: {{currentScore}}/100分

**当前内容**:

### Meta 信息
- **Meta 标题** ({{metaTitleLength}}字符): {{metaTitle}}
- **Meta 描述** ({{metaDescriptionLength}}字符): {{metaDescription}}
- **Meta 关键词**: {{metaKeywords}}

### 关键词策略
- **目标关键词**: {{targetKeyword}}
- **长尾关键词**: {{longTailKeywords}}
- **次要关键词**: {{secondaryKeywords}}

### 引言 ({{guideIntroLength}}字符)
{{guideIntro}}

### 正文内容 ({{guideContentLength}}字符)
{{guideContent}}

### FAQ ({{faqCount}}个问题)
{{faqItems}}

**主要问题和改进建议**:
{{recommendations}}

---

## 优化任务

请对以上内容进行**深度思考**和**全面优化**。你需要：

### 1. Meta 标题优化
- **必须使用 {{languageName}}**
- 长度控制在 55-60 字符
- 必须包含主关键词（靠前位置）
- 吸引点击，传递核心价值
- 避免关键词堆砌

### 2. Meta 描述优化
- **必须使用 {{languageName}}**
- 长度控制在 150-155 字符
- 包含行动号召（CTA）
- 自然融入 1-2 个关键词
- 突出独特价值主张

### 3. Meta 关键词优化
- **必须使用 {{languageName}}**
- 提供 5-8 个相关关键词
- 主关键词 + 长尾关键词组合
- 用逗号分隔

### 4. 引言优化
- **必须使用 {{languageName}}**
- 长度 100-150 字
- 第一句话吸引注意力
- 明确说明本指南的价值
- 自然融入主关键词

### 5. 正文内容优化
- **必须使用 {{languageName}}**
- 目标长度 1500-2000 字
- 使用 Markdown 格式
- 清晰的结构层次（标题也必须是 {{languageName}}）：
  * # Introduction（简短介绍）
  * ## Key Features（核心特性，3-5个要点）
  * ## How to Use（使用步骤，5-8个步骤）
  * ## Best Practices（最佳实践，3-5个建议）
  * ## Troubleshooting（常见问题解决，2-3个场景）
  * ## Creative Ideas（创意用法，3-5个想法）
  * ## Conclusion（总结）
- 段落长度控制在 100-300 字
- **⚠️ 长尾关键词密度优化（最高优先级）**：
  * **逐个检查每个长尾关键词**，确保每个关键词至少出现2-3次
  * 主关键词密度：2-3%
  * 每个长尾关键词密度：1-2%（至少出现2-3次）
  * 在Introduction、How to Use、Best Practices、Troubleshooting、Creative Ideas、Conclusion等各部分自然融入
  * 避免关键词堆砌，要在完整句子中自然使用
- 使用 H2/H3 标题分割内容
- 加入具体例子和使用场景

### 6. FAQ 优化
- **问题和答案都必须使用 {{languageName}}**
- 提供 5-7 个高质量问题
- 每个问题要具体、用户真实关心的
- 每个回答 80-150 字，详细实用
- **⚠️ 长尾关键词融入（重要）**：
  * FAQ是融入长尾关键词的绝佳位置
  * 在问题和答案中自然使用至少3-5个不同的长尾关键词
  * 特别是那些在正文中密度不足的长尾关键词
- 覆盖不同的用户场景

### 7. 次要关键词优化
- **必须使用 {{languageName}}**
- 提供 5-8 个相关次要关键词
- 与主题相关的语义变体
- 可用于后续内容扩展

---

## 输出格式

请严格按照以下 JSON 格式返回优化结果：

⚠️ 再次提醒：所有字段内容都必须是 {{languageName}}！

```json
{
  "optimized_content": {
    "meta_title": "优化后的Meta标题（55-60字符，必须是 {{languageName}}）",
    "meta_description": "优化后的Meta描述（150-155字符，必须是 {{languageName}}）",
    "meta_keywords": "关键词1, 关键词2, 关键词3, 关键词4, 关键词5（必须是 {{languageName}}）",
    "guide_intro": "优化后的引言（100-150字，必须是 {{languageName}}）",
    "guide_content": "优化后的完整Markdown正文（1500-2000字，包含所有章节，必须是 {{languageName}}）",
    "faq_items": [
      {
        "question": "优化后的问题1？（必须是 {{languageName}}）",
        "answer": "详细的回答1（80-150字，必须是 {{languageName}}）"
      },
      {
        "question": "优化后的问题2？（必须是 {{languageName}}）",
        "answer": "详细的回答2（80-150字，必须是 {{languageName}}）"
      },
      {
        "question": "优化后的问题3？（必须是 {{languageName}}）",
        "answer": "详细的回答3（80-150字，必须是 {{languageName}}）"
      }
    ],
    "secondary_keywords": ["次要关键词1", "次要关键词2", "次要关键词3", "次要关键词4", "次要关键词5（必须是 {{languageName}}）"]
  },
  "optimization_summary": "简要说明本次优化的核心改进点和策略（100-150字）",
  "key_improvements": [
    "具体改进点1：例如 ''Meta标题从45字符扩展到58字符，并将主关键词前置''",
    "具体改进点2：例如 ''正文新增3个H2标题，优化内容结构''",
    "具体改进点3：例如 ''关键词密度从5.2%优化到2.8%，避免堆砌''",
    "具体改进点4：例如 ''FAQ从3个扩展到6个，覆盖更多用户场景''",
    "具体改进点5：例如 ''Meta描述增加明确的CTA，提升点击率''",
    "具体改进点6：如果原内容有语言混用，必须说明：''修复语言混用问题，全部改为 {{languageName}}''"
  ]
}
```

## 重要提醒

1. **⚠️ 语言一致性（最高优先级）**：ALL content must be 100% {{languageName}}, NO mixed languages!
2. **内容必须原创且高质量**：不要简单复制现有内容，要真正优化和改进
3. **关键词自然融入**：避免生硬插入，保持语言流畅
4. **用户价值优先**：内容要真正有用，而不是为了SEO而SEO
5. **具体可操作**：给出的建议要明确、具体、可执行
6. **保持专业性**：语言要准确、权威，体现专业水平
7. **结构清晰**：使用 Markdown 格式，层次分明
8. **语言纯净检查**：如果原内容混用了语言，你必须全部改为 {{languageName}}

请只返回 JSON，不要添加任何其他说明文字。记住：100% {{languageName}}！开始深度思考并全面优化吧！',
  '["languageName", "languageCode", "currentScore", "metaTitle", "metaTitleLength", "metaDescription", "metaDescriptionLength", "metaKeywords", "targetKeyword", "longTailKeywords", "secondaryKeywords", "guideIntro", "guideIntroLength", "guideContent", "guideContentLength", "faqItems", "faqCount", "recommendations"]'::jsonb,
  '[]'::jsonb,
  'json',
  1,
  true,
  'system'
);
