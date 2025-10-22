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

### 4. 关键词插入任务清单 (⚠️ 必须100%完成!)

⚠️ **重要**：本节提供精确的关键词插入位置和次数。请严格按照清单逐项执行，完成所有任务后关键词密度将自动达标。

**核心原则**:
- ✅ 这是**具体任务**，不是抽象目标
- ✅ 完成清单 = 密度自动达标
- ✅ 不需要自己计算密度
- ❌ 不要"凭感觉"调整次数

{{keywordTaskChecklist}}

### 4.1 语义SEO优化 (自然度保证)

完成上述任务清单后，为了增加内容的自然度和语义丰富度，请额外使用**语义变体**:

**60/40法则**:
- 60% 精确匹配: 按清单插入 "{{targetKeyword}}" (已完成)
- 40% 语义变体: 使用同义词、改写、相关术语

**语义变体示例**:
- 如果关键词是 "AI video generator":
  * "AI-powered video creation tool"
  * "artificial intelligence video maker"
  * "automated video generation system"

**为 "{{targetKeyword}}" 创建 3-5 个语义变体:**
- 这些变体应在正文中自然出现 8-12 次
- 分散分布在各个章节
- 不计入精确匹配的次数要求

**相关术语 (5-8个)**:
- 识别与 "{{targetKeyword}}" 相关的专业术语
- 自然融入全文，提升主题覆盖深度

### 4.2 字数要求

- **总字数**：约{{recommendedWordCount}}字（最少{{minWordCount}}字，最多{{maxWordCount}}字）
- **段落长度**: 100-150字/段
- **H2/H3层级**: 清晰合理

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
**仅在文章开头添加一个CTA**（引言之后）：
- `> 💡 **Ready to get started?** [Try our {{targetKeyword}} template](/{{language}}/create?template={{templateSlug}}) and create professional videos in minutes!`

**重要**:
- 只在文章开头添加一次CTA,不要在教程部分之后或文章结尾重复添加CTA
- CTA链接必须使用`/{{language}}/create?template={{templateSlug}}`格式,这样可以正确跳转到对应语言和模板的视频生成页面

### 8. 格式要求
- 使用Markdown格式
- H1标题仅出现1次（文章标题）
- H2、H3层级清晰
- 适当使用列表、粗体、斜体
- 每段100-150字
- 使用blockquote (`>`) 突出重要提示和CTA
- 使用代码块突出技术参数或设置

---

## ⚠️ 最终输出格式 (最高优先级!)

### 🚨 CRITICAL REQUIREMENT - 绝对强制要求:

**你必须返回且只能返回一个纯JSON对象，不要有任何其他内容!**

### ❌ 禁止的输出:
- ❌ 不要输出 ```json 代码块标记
- ❌ 不要添加任何说明文字 (如"已完成生成", "这是内容")
- ❌ 不要在JSON前后添加任何解释
- ❌ 不要输出Markdown格式的正文 (Markdown内容应该在JSON的guide_content字段内)

### ✅ 正确的输出格式:

直接以 `{` 开始，以 `}` 结束，中间是JSON内容:

{
  "title": "H1标题（包含关键词{{targetKeyword}}）",
  "meta_title": "SEO优化的标题（50-60字符）",
  "meta_description": "SEO优化的描述（150-160字符）",
  "meta_keywords": "关键词1, 关键词2, 关键词3",
  "guide_content": "# 文章H1标题\n\n## What is {{targetKeyword}}?\n\n正文内容...\n\n## How to Use {{targetKeyword}}\n\n步骤内容...\n\n（完整的Markdown格式正文，包含所有章节、H2/H3标题、列表、代码块等）",
  "faq_items": [
    {"question": "问题1？", "answer": "详细回答1"},
    {"question": "问题2？", "answer": "详细回答2"},
    {"question": "问题3？", "answer": "详细回答3"},
    {"question": "问题4？", "answer": "详细回答4"},
    {"question": "问题5？", "answer": "详细回答5"}
  ],
  "secondary_keywords": ["相关关键词1", "相关关键词2", "相关关键词3"]
}

### 📝 字段说明:

1. **guide_content字段**:
   - 必须是纯字符串,使用 `\n` 表示换行
   - 包含完整的Markdown格式正文
   - 从 `# H1标题` 开始
   - 包含所有章节: `## H2标题`, `### H3标题`
   - 包含列表、粗体、代码块等Markdown语法
   - 特殊字符需要转义 (如引号用 `\"`)

2. **faq_items字段**:
   - 必须是JSON数组
   - 每个FAQ是一个对象: `{"question": "...", "answer": "..."}`
   - 不要放在 guide_content 中

3. **JSON格式要求**:
   - 所有字符串用双引号 `"`
   - 数组用 `[ ]`
   - 对象用 `{ }`
   - 正确转义特殊字符

### 🔍 自我检查 (生成前):

- [ ] 我的输出以 `{` 开始吗?
- [ ] 我的输出以 `}` 结束吗?
- [ ] 我没有添加 ```json 标记吗?
- [ ] 我没有添加任何说明文字吗?
- [ ] guide_content 字段包含了完整的Markdown正文吗?
- [ ] 所有字符串都用双引号吗?
- [ ] 特殊字符(引号、换行)都正确转义了吗?

### ⚠️ 最后提醒:

**如果你的输出不是纯JSON格式，解析将失败，整个生成任务将作废!**

**现在开始生成，记住：只返回JSON，不要有任何其他文字!**
