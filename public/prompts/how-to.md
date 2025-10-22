# 任务：生成SEO优化的How-To教程

## 目标关键词
"{{targetKeyword}}"

## 文章要求

### 1. Meta信息

Meta信息将包含在最终的 JSON 输出中（见最后的输出格式）

**Meta Title要求**：
- 必须包含"{{targetKeyword}}"
- 添加修饰语（如"Ultimate Guide", "Complete Tutorial", "Best Tips", "Step-by-Step"）
- 包含年份"2025"提升时效性
- 总长度50-60字符
- 首字母大写，专业格式
- 示例："The Ultimate Guide to {{targetKeyword}} for {{platform}} (2025)"

**Meta Description要求**：
- **必须150-160字符**（充分利用Google展示空间）
- 必须包含"{{targetKeyword}}"
- 突出独特卖点（如"proven tips", "step-by-step", "professional results", "for beginners"）
- 包含数字（如"10+ tips", "5 simple steps", "3x faster"）
- 包含明确CTA（如"Learn how", "Discover", "Master", "Get started"）
- 包含情感词（如"easy", "proven", "effective", "professional", "complete"）
- 首字母大写，专业格式
- 示例："Master {{targetKeyword}} with our complete 2025 guide. Learn 10+ proven techniques, step-by-step tutorials, and expert tips to create professional results in minutes. Perfect for beginners!"

### 2. 内容结构
请严格按照以下结构编写文章：

{{sections}}

### 3. FAQ部分
- **数量**：{{faqMinItems}}-{{faqMaxItems}}个问答
- **问题类型参考**：
{{faqPatterns}}

### 4. SEO要求

⚠️ **重要**：本页面采用单关键词优化策略，只关注"{{targetKeyword}}"的密度优化。

- **总字数**：约{{recommendedWordCount}}字（最少{{minWordCount}}字，最多{{maxWordCount}}字）
- **目标关键词密度**：1.5-2.5%（理想：2.0%）
  - 只针对主关键词"{{targetKeyword}}"进行优化
  - **不要刻意堆砌关键词**，保持自然流畅
  - 关键词必须自然出现在以下位置：
    * H1标题（1次）
    * 第一段前100字内（1次）
    * 至少3个H2标题中
    * 每个主要章节的内容中（均匀分布）
    * 最后一段结论中（1次）
  - 使用语义变体和同义词增加自然度
    * 例如："{{targetKeyword}} tutorial", "{{targetKeyword}} guide", "how to {{targetKeyword}}"
    * 避免机械重复同一个词组

### 5. 差异化因子
请根据以下因子定制内容：
{{differentiationFactors}}

### 6. 内容深度与质量标准

#### 必须包含的元素：
- ✅ **实用步骤**：每个步骤详细且可执行，包含具体参数和设置
- ✅ **具体示例**：至少2-3个真实场景或用例
- ✅ **数据支持**：包含统计数据、最佳实践标准、行业基准
  - 例："Studies show that videos with {{targetKeyword}} get 3x more engagement"
  - 例："The ideal {{platform}} video length is 15-60 seconds for maximum reach"
- ✅ **成功案例**：提及成功的创作者或品牌案例（可匿名化）
  - 例："Many TikTok creators report 300%+ view increase after mastering {{targetKeyword}}"
- ✅ **2025趋势**：在引言或相关章节包含最新趋势
  - 必须提到"as of 2025"或"in 2025"至少1次
  - 引用最新的平台算法变化或功能更新
  - 例："As of 2025, {{platform}} algorithm prioritizes..."
- ✅ **常见错误**：专门章节或段落列出"Common Mistakes to Avoid"
  - 列出3-5个常见错误
  - 说明为什么这是错误
  - 提供正确的解决方法

#### 写作技巧：
- ✅ 解释"为什么"而不只是"怎么做"
- ✅ 使用"you"和"your"增加亲和力
- ✅ 每段100-150字，保持可读性
- ✅ 使用过渡词连接段落（However, Moreover, Therefore, Additionally）
- ✅ 适当使用emoji增加视觉吸引力（但不过度，仅在重要提示处如💡 🎯 ⚠️）
- ✅ 语言清晰易懂，适合{{audience}}
- ✅ 避免空洞的泛泛之谈，提供可执行的建议

### 7. 技术SEO要素

#### 7.1 目录导航（TOC）
在文章开头（定义部分之后）添加目录：
```markdown
## 📋 Table of Contents
- [What is {{targetKeyword}}?](#what-is)
- [Why Use {{targetKeyword}}?](#why-use)
- [Step-by-Step Guide](#guide)
- [Best Practices](#best-practices)
- [Common Mistakes](#mistakes)
- [FAQ](#faq)
```

#### 7.2 内部链接占位符
在适当位置添加3-5个内部链接占位符：
- 格式：`[Related: {{platform}} video templates](#internal-link)`
- 位置：每个主要章节末尾或相关提示处
- 类型：相关教程、工具推荐、模板链接

#### 7.3 图片Alt Text占位符
为应该配图的位置添加图片占位符（至少3-5个）：
```markdown
![{{targetKeyword}} step 1 tutorial screenshot - setting up equipment](image-placeholder-1.jpg)
```
注意：Alt text必须描述图片内容并包含关键词

#### 7.4 CTA行动召唤
在以下位置添加CTA：
- **文章开头**（引言之后）：
  `> 💡 **Ready to get started?** [Try our {{targetKeyword}} template](#cta-link) and create professional videos in minutes!`

- **教程部分之后**：
  `> 🎯 **Start creating now!** [Use our {{targetKeyword}} tool](#cta-link) to put these tips into practice.`

- **文章结尾**（结论中）：
  `> ✨ **Take action today!** [Get started with {{targetKeyword}}](#cta-link) and see results fast!`

### 8. 格式要求
- 使用Markdown格式
- H1标题仅出现1次（文章标题）
- H2、H3层级清晰
- 适当使用列表、粗体、斜体
- 每段100-150字
- 使用blockquote (`>`) 突出重要提示和CTA
- 使用代码块突出技术参数或设置

## 输出格式

⚠️ **CRITICAL**: You MUST return ONLY valid JSON in the following format. NO explanations, NO markdown code blocks, NO additional text!

```json
{
  "title": "H1标题（包含关键词）",
  "meta_title": "SEO优化的标题（50-60字符）",
  "meta_description": "SEO优化的描述（150-160字符）",
  "meta_keywords": "关键词1, 关键词2, 关键词3",
  "guide_content": "完整的Markdown格式正文内容（包含所有章节、H2/H3标题、列表、代码块等）",
  "faq_items": [
    {"question": "问题1？", "answer": "详细回答1"},
    {"question": "问题2？", "answer": "详细回答2"},
    {"question": "问题3？", "answer": "详细回答3"},
    {"question": "问题4？", "answer": "详细回答4"},
    {"question": "问题5？", "answer": "详细回答5"}
  ],
  "secondary_keywords": ["相关关键词1", "相关关键词2", "相关关键词3"]
}
```

**重要提醒**：
- guide_content 字段包含完整的 Markdown 格式正文
- 从 H1 标题开始，包含所有章节内容
- 保持 Markdown 格式：H2标题用 ##，H3标题用 ###，列表、粗体、代码块等
- FAQ 单独作为 JSON 数组，不要放在 guide_content 中
- 只返回 JSON 对象，不要有任何其他文字
