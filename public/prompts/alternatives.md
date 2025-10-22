# 任务：生成SEO优化的Alternatives对比文章

## 目标关键词
"{{targetKeyword}}"

## 文章要求

### 1. 内容结构
请严格按照以下结构编写文章：

{{sections}}

### 2. 竞品对比要求
- **竞品数量**：{{minCompetitors}}-{{maxCompetitors}}个
- **每个竞品必须包含**：
  - 名称和简介
  - 评分（1-5分）
  - 定价信息（是否有免费版，起始价格）
  - 3-5个核心功能
  - 2-3个优点
  - 1-2个缺点
  - 最适合的用户类型

- **竞品对比表格**：
  - 必须包含对比维度：价格、功能、易用性、评分
  - 表格后需要200-300字的总结分析

### 3. FAQ部分
- **数量**：{{faqMinItems}}-{{faqMaxItems}}个问答
- **问题类型参考**：
{{faqPatterns}}

### 4. SEO要求
- **总字数**：约{{recommendedWordCount}}字
- **主关键词密度**：{{keywordDensityIdeal}}%
- **竞品名称密度**：{{competitorDensityIdeal}}%

### 5. 差异化因子
{{differentiationFactors}}

### 6. 内容质量标准
- ✅ 提供客观、公正的对比分析
- ✅ 每个竞品的信息准确具体
- ✅ 避免过度推销某个产品
- ✅ 给出明确的选择建议
- ✅ 适配目标受众（{{audience}}）

## 输出格式

⚠️ **CRITICAL**: You MUST return ONLY valid JSON in the following format. NO explanations, NO markdown code blocks, NO additional text!

```json
{
  "title": "H1标题（包含关键词）",
  "meta_title": "SEO优化的标题（50-60字符）",
  "meta_description": "SEO优化的描述（150-160字符）",
  "meta_keywords": "关键词1, 关键词2, 关键词3",
  "guide_content": "完整的Markdown格式正文内容（包含所有章节、H2/H3标题、对比表格等）",
  "faq_items": [
    {"question": "问题1？", "answer": "详细回答1"},
    {"question": "问题2？", "answer": "详细回答2"},
    {"question": "问题3？", "answer": "详细回答3"}
  ],
  "secondary_keywords": ["相关关键词1", "相关关键词2", "相关关键词3"]
}
```

**重要提醒**：
- guide_content 字段包含完整的 Markdown 格式正文
- 包含所有章节内容、对比表格
- 保持 Markdown 格式
- FAQ 单独作为 JSON 数组
- 只返回 JSON 对象，不要有任何其他文字
