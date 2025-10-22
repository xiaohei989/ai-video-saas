-- ============================================
-- AI Prompt Templates Management System
-- Version: 036
-- Description: 统一管理所有AI提示词模板（SEO评分、E-E-A-T评分等）
-- ============================================

-- ============================================
-- 1. AI提示词模板表
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 基本信息
  name VARCHAR(100) NOT NULL UNIQUE,              -- seo-score, eeat-score, content-optimize等
  display_name VARCHAR(200) NOT NULL,             -- SEO评分提示词, E-E-A-T评分提示词
  description TEXT,                                -- 提示词说明
  category VARCHAR(50) NOT NULL,                  -- scoring, generation, optimization

  -- 提示词内容
  prompt_template TEXT NOT NULL,                  -- 完整的提示词模板（支持变量替换）

  -- 变量定义
  required_variables JSONB DEFAULT '[]',          -- 必需变量列表 ["meta_title", "guide_content"]
  optional_variables JSONB DEFAULT '[]',          -- 可选变量列表

  -- 输出格式
  expected_output_format VARCHAR(50),             -- json, markdown, text
  output_schema JSONB,                            -- JSON Schema定义（如果是JSON输出）

  -- 版本控制
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  previous_version_id UUID REFERENCES public.ai_prompt_templates(id),

  -- 使用统计
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- 元数据
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.ai_prompt_templates IS 'AI提示词模板管理 - 统一存储和管理所有AI提示词';
COMMENT ON COLUMN public.ai_prompt_templates.prompt_template IS '提示词模板，支持 {{variable}} 语法进行变量替换';
COMMENT ON COLUMN public.ai_prompt_templates.required_variables IS '必需变量列表（JSON数组）';
COMMENT ON COLUMN public.ai_prompt_templates.output_schema IS 'JSON Schema定义输出格式';

-- 索引
CREATE INDEX idx_ai_prompts_name ON public.ai_prompt_templates(name);
CREATE INDEX idx_ai_prompts_category ON public.ai_prompt_templates(category);
CREATE INDEX idx_ai_prompts_active ON public.ai_prompt_templates(is_active) WHERE is_active = true;

-- ============================================
-- 2. 插入 E-E-A-T 评分提示词
-- ============================================
INSERT INTO public.ai_prompt_templates (
  name,
  display_name,
  description,
  category,
  prompt_template,
  required_variables,
  expected_output_format,
  output_schema,
  created_by
) VALUES (
  'eeat-score',
  'E-E-A-T评分提示词',
  '基于Google 2025年E-E-A-T标准的内容评分提示词',
  'scoring',
  '你是一位拥有10年经验的资深SEO专家，精通Google 2025年E-E-A-T（Experience, Expertise, Authoritativeness, Trustworthiness）评估标准和Helpful Content Update。

请对以下内容进行专业、详细的E-E-A-T评分和分析。

## 评分维度（AI评估88分，算法计算12分，总计100分）

### 1. 信任度与可信度 (Trust & Credibility) - **35分**

💡 **Trustworthiness is the most important** - Google 2025

#### 1.1 可信度 (Trustworthiness) - 15分
- **事实准确性** (0-5分):
  - 是否有误导性陈述？
  - 数据是否有来源或可验证？
  - 是否存在夸大宣传？

- **透明度** (0-5分):
  - 是否明确说明内容局限性？
  - 是否披露AI辅助生成（如适用）？
  - 是否有明确的更新时间？

- **Meta信息质量** (0-3分):
  - Meta标题是否准确描述内容？
  - Meta描述是否无夸大？
  - 是否避免Click-bait标题？

- **引用和来源** (0-2分):
  - 关键数据是否有可验证来源？
  - 是否引用权威来源？

#### 1.2 权威性 (Authoritativeness) - 10分
- **领域深度** (0-4分):
  - 是否展示深入的领域知识？
  - 是否涵盖主题的深层次问题？

- **专业术语使用** (0-3分):
  - 专业词汇使用是否准确？
  - 术语解释是否恰当？

- **行业最佳实践** (0-3分):
  - 是否遵循行业标准？
  - 是否提供符合最佳实践的建议？

#### 1.3 专业性 (Expertise) - 10分
- **技术准确性** (0-4分):
  - 技术细节是否准确？
  - 是否有技术错误？

- **实用性** (0-3分):
  - 建议是否可操作？
  - 步骤是否详细且有效？

- **细节丰富度** (0-3分):
  - 是否提供足够的实施细节？
  - 是否有具体的参数或配置说明？

---

### 2. 内容质量与深度 (Content Quality & Depth) - **30分**

💡 对应 Google #1 因素: **Consistent Publication of Satisfying Content**

#### 2.1 内容全面性 (Comprehensiveness) - 12分
- **主题覆盖度** (0-5分):
  - 是否覆盖用户可能的所有疑问？
  - 是否回答"谁、什么、为什么、如何、何时、何地"？

- **场景完整性** (0-4分):
  - 是否涵盖不同使用场景？
  - 是否考虑不同用户水平（初学者/中级/高级）？

- **问题解决深度** (0-3分):
  - FAQ是否回答核心问题？
  - 是否提供troubleshooting指导？

#### 2.2 信息增益/原创性 (Information Gain) - 10分
💡 对应 Google 专利: **Information gain (unique aspects only available in a document)**

- **独特见解** (0-4分):
  - 是否提供网上少有的观点或方法？
  - 是否有创新性建议？

- **第一手经验 (Experience!)** (0-3分):
  - 是否包含实际使用经验？
  - 是否有亲身测试的结果？
  - 是否有"我尝试过..."这样的表述？

- **实例和案例** (0-3分):
  - 是否有具体案例支撑？
  - 是否有截图、数据或实验结果？

#### 2.3 结构化质量 (Structured Quality) - 8分
- **逻辑流畅性** (0-3分):
  - 段落之间逻辑是否清晰？
  - 内容是否有明确的起承转合？

- **结构层次** (0-3分):
  - H1/H2/H3 使用是否合理？
  - 是否有清晰的章节划分？

- **内容格式** (0-2分):
  - 是否使用列表、表格增强可读性？
  - 是否使用代码块、引用等格式？

---

### 3. 用户满意度 (User Satisfaction) - **20分**

💡 对应 Google 2025 上升因素: **Searcher Engagement (11%↑12%)**

#### 3.1 可读性 (Readability) - 8分
- **段落长度** (0-3分):
  - 段落长度是否合理（理想100-300字/段）？
  - 是否避免超长段落？

- **语言流畅度** (0-3分):
  - 表达是否清晰？
  - 是否有语病或歧义？
  - 是否使用主动语态？

- **用户友好性** (0-2分):
  - 是否适合目标受众阅读水平？
  - 是否避免过度复杂的术语？

**注意**: 用户参与度指标(12分)由系统算法基于真实数据自动计算，无需AI评估。包括：
- 页面停留时间（基于Google "long clicks"追踪）
- 跳出率
- 转化率
- 访问量

---

### 4. 技术SEO (Technical SEO) - **15分**

#### 4.1 关键词优化 (Keyword Optimization) - 8分
- **关键词分布自然度** (0-3分):
  - 关键词是否自然融入内容？
  - 是否避免关键词堆砌？

- **语义相关性** (0-3分):
  - 是否使用语义相关的词汇？
  - 是否使用同义词和变体？

- **长尾关键词覆盖** (0-2分):
  - 是否覆盖相关长尾关键词？

**注意**: 关键词密度(7分)由系统算法精确计算，无需AI评估。
- 目标关键词理想密度：1.5% ≤ 密度 ≤ 2.5%

---

## 待评分内容

### Meta 信息
- **Meta 标题**: {{meta_title}}
- **Meta 描述**: {{meta_description}}
- **Meta 关键词**: {{meta_keywords}}

### 关键词策略
- **目标关键词**: {{target_keyword}}
- **长尾关键词**: {{long_tail_keywords}}
- **次要关键词**: {{secondary_keywords}}

### 内容
**引言部分**:
{{guide_intro}}

**正文内容** (长度: {{content_length}} 字符):
{{guide_content}}

**FAQ** ({{faq_count}} 个问题):
{{faq_items}}

### 用户数据（仅供参考，不计入评分）
- 页面浏览量: {{page_views}}
- 平均停留时间: {{avg_time_on_page}} 秒
- 跳出率: {{bounce_rate}}%
- 转化率: {{conversion_rate}}%

{{keyword_density_info}}

---

## 输出要求

请严格按照以下 JSON 格式返回评分结果（**只返回JSON，不要任何其他文字**）：

```json
{
  "trustworthiness_score": 13,
  "authoritativeness_score": 8,
  "expertise_score": 9,
  "comprehensiveness_score": 10,
  "information_gain_score": 8,
  "structured_quality_score": 7,
  "readability_score": 7,
  "keyword_optimization_score": 7,
  "recommendations": [
    "[信任度] 建议在文章开头增加作者简介，包含相关领域经验年限和资质证明",
    "[权威性] 引用2-3个行业权威来源（如官方文档、权威研究报告、知名专家观点）",
    "[信息增益] 添加实际使用案例或截图，展示第一手体验（Experience维度）",
    "[全面性] FAQ第3个问题回答过于简短（仅35字），建议扩展到100-150字，增加具体步骤",
    "[可读性] 第4段落过长（520字），建议拆分为2个段落，每段约200-300字",
    "[关键词优化] 建议在H2标题中自然融入2-3次长尾关键词，增强语义相关性"
  ]
}
```

## 评分原则

1. **严格但公正**: 基于SEO最佳实践和Google 2025标准
2. **建议具体可操作**:
   - 明确指出问题位置（第几段、第几个FAQ等）
   - 给出具体修改示例或建议
   - 按优先级排序（最重要的放前面）
3. **建议数量**: 5-10条，覆盖主要问题
4. **建议格式**: [维度名称] 具体建议内容
5. **语言**: 使用中文

请只返回 JSON，不要添加任何其他说明文字。',
  '[
    "meta_title",
    "meta_description",
    "meta_keywords",
    "target_keyword",
    "long_tail_keywords",
    "secondary_keywords",
    "guide_intro",
    "guide_content",
    "faq_items",
    "content_length",
    "faq_count",
    "page_views",
    "avg_time_on_page",
    "bounce_rate",
    "conversion_rate"
  ]'::jsonb,
  'json',
  '{
    "type": "object",
    "required": ["trustworthiness_score", "authoritativeness_score", "expertise_score", "comprehensiveness_score", "information_gain_score", "structured_quality_score", "readability_score", "keyword_optimization_score", "recommendations"],
    "properties": {
      "trustworthiness_score": {"type": "number", "minimum": 0, "maximum": 15},
      "authoritativeness_score": {"type": "number", "minimum": 0, "maximum": 10},
      "expertise_score": {"type": "number", "minimum": 0, "maximum": 10},
      "comprehensiveness_score": {"type": "number", "minimum": 0, "maximum": 12},
      "information_gain_score": {"type": "number", "minimum": 0, "maximum": 10},
      "structured_quality_score": {"type": "number", "minimum": 0, "maximum": 8},
      "readability_score": {"type": "number", "minimum": 0, "maximum": 8},
      "keyword_optimization_score": {"type": "number", "minimum": 0, "maximum": 8},
      "recommendations": {"type": "array", "items": {"type": "string"}}
    }
  }'::jsonb,
  'system'
);

-- ============================================
-- 3. 插入旧 SEO 评分提示词（从 prompts/seo-score-prompt-simple.md 迁移）
-- ============================================
INSERT INTO public.ai_prompt_templates (
  name,
  display_name,
  description,
  category,
  prompt_template,
  required_variables,
  expected_output_format,
  output_schema,
  created_by
) VALUES (
  'seo-score',
  'SEO内容评分提示词',
  'SEO内容评分与优化建议系统（基于定量标准）',
  'scoring',
  '# SEO 内容评分与优化建议系统

## 🎯 核心原则

1. **客观评估优先**: 优秀内容给高分(90+分可以0条建议),只对明显问题提建议
2. **只用定量标准**: 每条建议必须基于具体数字(长度/密度/分数),禁止主观判断
3. **改进幅度>10%**: 建议的改进必须带来至少10%的实质性提升,否则不提

---

## 📊 评分标准 (总分100分)

### 1️⃣ Meta 信息质量 (30分)

**Meta 标题 (15分)**:
- 长度50-65字符: 15分
- 长度45-49或66-70字符: 10分
- 其他长度: 5分
- 不含关键词: -5分
- 关键词位置>50字符: -3分

**Meta 描述 (15分)**:
- 长度140-165字符: 15分
- 长度130-139或166-175字符: 10分
- 其他长度: 5分
- 不含关键词: -5分
- 无CTA: -3分

### 2️⃣ 关键词优化 (25分)

**关键词密度**:
- 目标关键词1.5-2.5%: 15分
- 目标关键词1.0-1.4%或2.6-3.0%: 10分
- 目标关键词<1.0%或>3.0%: 5分
- 次要关键词总密度0.5-1.5%: 10分
- 次要关键词总密度<0.5%或>2.0%: 5分

### 3️⃣ 内容质量 (25分)

**结构与深度**:
- 内容≥1500字: 10分
- 内容1000-1499字: 7分
- 内容<1000字: 3分
- 有3+个二级标题: 8分
- FAQ≥3条: 7分

### 4️⃣ 可读性与用户体验 (20分)

**文本可读性**:
- 段落平均长度50-100字: 10分
- 有列表/代码块/引用: 10分

---

## ✅ 建议生成规则 (纯定量)

### 规则1: Meta 标题

```
IF 长度 < 50 OR 长度 > 70:
  → 建议调整到 55-60 字符

IF 不包含 {{targetKeyword}}:
  → 建议添加关键词到标题前40字符内

IF 关键词首次出现位置 > 50:
  → 建议将关键词移到前40字符

ELSE:
  → 不提任何Meta标题建议
```

### 规则2: Meta 描述

```
IF 长度 < 140 OR 长度 > 165:
  → 建议调整到 150-160 字符

IF 不包含 {{targetKeyword}}:
  → 建议添加关键词

IF 结尾无CTA词 (如: "Start now" / "Learn more" / "Get started" / "立即开始" / "了解更多"):
  → 建议添加CTA

ELSE:
  → 不提任何Meta描述建议
```

### 规则3: 关键词密度

```
IF 目标关键词密度 < 1.5% OR > 2.5%:
  当前密度 = {{keywordDensity}}
  目标密度 = 2.0%
  IF 当前 < 1.5%:
    → 建议增加关键词使用,目标密度2.0%
  IF 当前 > 2.5%:
    → 建议减少关键词使用,目标密度2.0%

IF 次要关键词总密度 < 0.5%:
  → 建议添加2-3个次要关键词,总密度达到1.0%

IF 次要关键词总密度 > 2.0%:
  → 建议减少次要关键词,总密度降到1.5%以下

ELSE:
  → 不提关键词密度建议
```

### 规则4: 内容结构

```
IF 总字数 < 1500:
  → 建议扩充到1500-2000字

IF 二级标题数量 < 3:
  → 建议添加至少3个结构化的二级标题 (##)

IF FAQ数量 < 3:
  → 建议添加至少3条高质量FAQ

ELSE:
  → 不提内容结构建议
```

### 规则5: 可读性

```
IF 缺少列表/代码块/引用:
  → 建议添加无序列表或引用块提升可读性

IF 有超长段落 (>150字):
  → 建议将长段落拆分为50-100字的短段落

ELSE:
  → 不提可读性建议
```

---

## 🔍 输出前强制检查清单

在输出JSON前,验证每一条 `suggestions` 数组中的建议:

### ✅ 检查1: 是否有定量依据?
- 每条建议必须包含具体数字 (字符数/密度值/分数)
- 示例: "调整到55-60字符" ✅ / "优化标题长度" ❌

### ✅ 检查2: 当前值是否已在合理范围?
- Meta标题50-70字符 → 删除建议
- Meta描述140-165字符 → 删除建议
- 关键词密度1.5-2.5% → 删除建议
- 关键词位置0-50字符 → 删除建议

### ✅ 检查3: 是否只是换词?
- "Master" → "Learn" (同义词替换) → 删除
- "Start now" → "Download guide" (CTA替换) → 删除
- 判断标准: 改动后长度变化<5字符 = 换词游戏

### ✅ 检查4: 改进幅度是否>10%?
- 57字符 → 60字符 (提升5%) → 删除
- 154字符 → 153字符 (提升0.6%) → 删除
- 判断标准: |新值-旧值|/旧值 < 0.1 → 删除建议

**如果建议数组经过4项检查后为空,直接返回空数组 `[]`**

---

## 📤 输出格式

```json
{
  "overall_score": 85,
  "dimension_scores": {
    "meta_info_quality": 25,
    "keyword_optimization": 20,
    "content_quality": 22,
    "readability": 18
  },
  "suggestions": [
    {
      "category": "关键词优化",
      "issue": "目标关键词''{{targetKeyword}}''密度为1.2%,低于理想范围(1.5-2.5%)",
      "suggestion": "建议在内容中自然增加关键词使用3-5次,使密度达到2.0%左右",
      "priority": "high",
      "expected_impact": "+5分"
    }
  ]
}
```

**优先级定义**:
- `high`: Meta信息问题、关键词密度<1.0%或>3.0%
- `medium`: 内容字数<1500、缺少FAQ
- `low`: 可读性优化、次要关键词

---

## 🌍 语言适配

当前内容语言: **{{languageName}}** ({{languageCode}})

**CTA词库** (按语言):
- **en**: Start now, Get started, Learn more, Try it today, Download now
- **zh**: 立即开始, 免费试用, 了解更多, 立即下载, 马上体验
- **ja**: 今すぐ始める, 詳細を見る, 無料で試す
- **ko**: 지금 시작, 자세히 알아보기, 무료 체험
- **es**: Empieza ahora, Aprende más, Prueba gratis
- **de**: Jetzt starten, Mehr erfahren, Kostenlos testen
- **fr**: Commencer maintenant, En savoir plus, Essai gratuit

**判断逻辑**: Meta描述结尾包含任意一个CTA词 → 有CTA,不提建议

---

## 📋 待分析内容

- **目标关键词**: {{targetKeyword}}
- **Meta标题**: {{metaTitle}}
- **Meta描述**: {{metaDescription}}
- **关键词密度**:
{{keywordDensity}}
- **引言**: {{guideIntro}}
- **正文内容**: {{guideContent}}
- **FAQ**:
{{faq}}

{{noKeywordWarning}}

---

## 🚨 重要:输出格式要求

**必须只返回JSON,不要添加任何Markdown格式、说明文字或代码块标记!**

输出示例(直接输出,不要用```json包裹):
```
{
  "overall_score": 85,
  "dimension_scores": {
    "meta_info_quality": 25,
    "keyword_optimization": 20,
    "content_quality": 22,
    "readability": 18
  },
  "suggestions": [...]
}
```

**严格要求**:
1. ❌ 不要输出 `## 标题` 或表格
2. ❌ 不要输出 "### 分析" 或任何Markdown
3. ❌ 不要用 ```json 代码块包裹
4. ✅ 只输出纯JSON对象,从 `{` 开始到 `}` 结束

**请立即输出JSON:**',
  '[
    "languageName",
    "languageCode",
    "targetKeyword",
    "metaTitle",
    "metaDescription",
    "keywordDensity",
    "guideIntro",
    "guideContent",
    "faq",
    "noKeywordWarning"
  ]'::jsonb,
  'json',
  '{
    "type": "object",
    "required": ["overall_score", "dimension_scores", "suggestions"],
    "properties": {
      "overall_score": {"type": "number", "minimum": 0, "maximum": 100},
      "dimension_scores": {
        "type": "object",
        "required": ["meta_info_quality", "keyword_optimization", "content_quality", "readability"],
        "properties": {
          "meta_info_quality": {"type": "number", "minimum": 0, "maximum": 30},
          "keyword_optimization": {"type": "number", "minimum": 0, "maximum": 25},
          "content_quality": {"type": "number", "minimum": 0, "maximum": 25},
          "readability": {"type": "number", "minimum": 0, "maximum": 20}
        }
      },
      "suggestions": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["category", "issue", "suggestion", "priority"],
          "properties": {
            "category": {"type": "string"},
            "issue": {"type": "string"},
            "suggestion": {"type": "string"},
            "priority": {"type": "string", "enum": ["high", "medium", "low"]},
            "expected_impact": {"type": "string"}
          }
        }
      }
    }
  }'::jsonb,
  'system'
);

-- ============================================
-- 4. 验证插入
-- ============================================
DO $$
DECLARE
  seo_prompt_count INTEGER;
  eeat_prompt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO seo_prompt_count FROM public.ai_prompt_templates WHERE name = 'seo-score';
  SELECT COUNT(*) INTO eeat_prompt_count FROM public.ai_prompt_templates WHERE name = 'eeat-score';

  IF seo_prompt_count > 0 AND eeat_prompt_count > 0 THEN
    RAISE NOTICE '✅ 成功插入 2 个AI提示词模板：seo-score, eeat-score';
  ELSE
    RAISE EXCEPTION '❌ 提示词插入失败';
  END IF;
END $$;
