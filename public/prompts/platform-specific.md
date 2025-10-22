# 任务：生成SEO优化的Platform-Specific指南

## 目标关键词
"{{targetKeyword}}"

## 目标平台
{{platformName}}

## 文章要求

### 1. 内容结构
请严格按照以下结构编写文章：

{{sections}}

### 2. 平台规格要求
必须包含{{platformName}}平台的详细技术规格：
- **视频格式要求**：支持的格式、编码器
- **分辨率要求**：推荐分辨率、宽高比
- **时长限制**：最小/最大时长
- **文件大小限制**：最大文件大小
- **其他技术要求**

以清晰的表格或列表形式呈现。

### 3. 平台优化建议
针对{{platformName}}平台的算法和用户行为，提供：
- 内容策略建议
- 发布时间建议
- 标题和描述优化技巧
- 标签/话题标签使用建议
- 互动策略（如何提高点赞、评论、分享）

### 4. FAQ部分
- **数量**：{{faqMinItems}}-{{faqMaxItems}}个问答
- **问题类型参考**：
{{faqPatterns}}

### 5. SEO要求
- **总字数**：约{{recommendedWordCount}}字
- **主关键词密度**：{{keywordDensityIdeal}}%
- **平台名称密度**：{{platformDensityIdeal}}%

### 6. 差异化因子
{{differentiationFactors}}

### 7. 内容质量标准
- ✅ 提供平台专属的实用建议
- ✅ 技术信息准确且最新
- ✅ 包含具体的优化案例
- ✅ 解释平台算法的工作原理
- ✅ 适配目标受众（{{audience}}）

## 输出格式

⚠️ **CRITICAL**: You MUST return ONLY valid JSON in the following format. NO explanations, NO markdown code blocks, NO additional text!

```json
{
  "title": "H1标题（包含关键词）",
  "meta_title": "SEO优化的标题（50-60字符）",
  "meta_description": "SEO优化的描述（150-160字符）",
  "meta_keywords": "关键词1, 关键词2, 关键词3",
  "guide_content": "完整的Markdown格式正文内容（包含所有章节、H2/H3标题、平台规格表等）",
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
- 包含所有章节内容、平台规格表
- 保持 Markdown 格式
- FAQ 单独作为 JSON 数组
- 只返回 JSON 对象，不要有任何其他文字
