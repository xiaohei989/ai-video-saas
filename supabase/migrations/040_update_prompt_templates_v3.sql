-- =====================================================
-- 更新提示词模板到数据库 v3.0
-- =====================================================
--
-- 目的: 将优化后的提示词模板(包含关键词任务清单和强化的JSON格式要求)同步到数据库
--
-- 更新内容:
-- 1. how-to模板 - 添加 {{keywordTaskChecklist}} 占位符
-- 2. alternatives模板 - 添加任务清单
-- 3. platform-specific模板 - 添加任务清单
-- 4. 所有模板 - 强化JSON输出格式要求
-- =====================================================

-- ========== 1. 更新 how-to 模板 ==========
UPDATE seo_content_templates
SET
  prompt_template = E'# 任务：生成SEO优化的How-To教程

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
- **答案长度要求**：
  - 英文: 80-120词 (简洁精炼,直接回答核心问题)
  - 中文/日语/韩语: 150-250字符
  - ⚠️ 避免冗长,每个答案聚焦1个核心观点
  - ✅ 使用要点列表增强可读性
  - ✅ 避免重复正文已有内容
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
- ✅ **成功案例**：提及成功的创作者或品牌案例（可匿名化）
- ✅ **2025趋势**：在引言或相关章节包含最新趋势
- ✅ **常见错误**：专门章节或段落列出"Common Mistakes to Avoid"

#### 写作技巧：
- ✅ 解释"为什么"而不只是"怎么做"
- ✅ 使用"you"和"your"增加亲和力
- ✅ 每段100-150字，保持可读性
- ✅ 使用过渡词连接段落
- ✅ 语言清晰易懂，适合{{audience}}

### 7. 技术SEO要素

#### 7.1 目录导航（TOC）
在文章开头添加目录

#### 7.2 内部链接占位符
在适当位置添加3-5个内部链接占位符

#### 7.3 图片Alt Text占位符
为应该配图的位置添加图片占位符（至少3-5个）

#### 7.4 CTA行动召唤
在文章开头、教程部分之后、文章结尾添加CTA

### 8. 格式要求
- 使用Markdown格式
- H1标题仅出现1次（文章标题）
- H2、H3层级清晰
- 适当使用列表、粗体、斜体
- 每段100-150字

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

直接以 { 开始，以 } 结束，中间是JSON内容:

{
  "title": "H1标题（包含关键词{{targetKeyword}}）",
  "meta_title": "SEO优化的标题（50-60字符）",
  "meta_description": "SEO优化的描述（150-160字符）",
  "meta_keywords": "关键词1, 关键词2, 关键词3",
  "guide_content": "# 文章H1标题\\n\\n## What is {{targetKeyword}}?\\n\\n正文内容...\\n\\n（完整的Markdown格式正文）",
  "faq_items": [
    {"question": "问题1？", "answer": "详细回答1"},
    {"question": "问题2？", "answer": "详细回答2"}
  ],
  "secondary_keywords": ["相关关键词1", "相关关键词2"]
}

### 🔍 自我检查 (生成前):

- [ ] 我的输出以 { 开始吗?
- [ ] 我的输出以 } 结束吗?
- [ ] 我没有添加 ```json 标记吗?
- [ ] guide_content 字段包含了完整的Markdown正文吗?
- [ ] 所有字符串都用双引号吗?

### ⚠️ 最后提醒:

**如果你的输出不是纯JSON格式，解析将失败，整个生成任务将作废!**

**现在开始生成，记住：只返回JSON，不要有任何其他文字!**',
  updated_at = NOW()
WHERE slug = 'how-to';

-- 验证 how-to 更新
DO $$
DECLARE
  template_length INTEGER;
BEGIN
  SELECT LENGTH(prompt_template) INTO template_length
  FROM seo_content_templates
  WHERE slug = 'how-to';

  IF template_length IS NULL OR template_length < 1000 THEN
    RAISE EXCEPTION 'how-to模板更新失败: 长度过短';
  ELSE
    RAISE NOTICE '✅ how-to模板更新成功: % 字符', template_length;
  END IF;
END $$;

-- 输出更新摘要
SELECT
  slug,
  name,
  LENGTH(prompt_template) as template_length,
  updated_at
FROM seo_content_templates
WHERE slug IN ('how-to', 'alternatives', 'platform-specific')
ORDER BY slug;
