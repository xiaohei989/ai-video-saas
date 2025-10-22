-- =====================================================
-- 更新图片 Alt 文本提示词指令
-- =====================================================
--
-- 目的: 为 SEO 内容模板添加详细的图片 alt 文本设计规则
--       确保 AI 生成的 alt 文本足够详细,准确表达图片内容需求
--
-- 更新内容:
-- 1. how-to 模板 - 添加详细的图片 alt 文本设计规范
-- 2. alternatives 模板 - 添加图片 alt 文本设计规范
-- 3. platform-specific 模板 - 添加图片 alt 文本设计规范
-- =====================================================

-- ========== 1. 更新 how-to 模板 ==========
UPDATE seo_content_templates
SET
  prompt_template = REPLACE(
    prompt_template,
    '#### 7.3 图片Alt Text占位符
为应该配图的位置添加图片占位符（至少3-5个）',
    E'#### 7.3 图片Alt Text占位符

**要求**: 在适当位置添加 3-5 个图片占位符

**格式规范**:
```markdown
![详细的alt文本描述](image-placeholder-1.jpg)
```

**Alt文本设计规则** (⚠️ 非常重要!):
1. **必须包含关键词**: 将 "{{targetKeyword}}" 融入描述中
2. **描述具体场景**: 说明图片应该展示什么内容
3. **50-120字符**: 简洁但信息充足
4. **关键要素**:
   - 主体(who/what): 图片的主要对象
   - 动作(doing what): 正在进行的动作或状态
   - 场景(where/context): 环境或背景
   - 细节(specific details): 重要的细节元素

**示例** (假设关键词是 "TikTok ASMR videos"):
- ✅ 好的 alt: `TikTok ASMR video creator setting up professional microphone and lighting equipment in home studio`
- ✅ 好的 alt: `Smartphone screen showing TikTok ASMR video editing interface with waveform timeline and sound effects panel`
- ✅ 好的 alt: `Cozy bedroom setup for recording ASMR content with ring light, blue yeti microphone, and soft background decorations`
- ❌ 差的 alt: `TikTok video setup` (太简略,缺少细节)
- ❌ 差的 alt: `Screenshot of app` (没有关键词,没有场景描述)

**放置位置建议**:
- 教程步骤后 (如 "Step 2: Configure Settings" 之后)
- 重要概念解释后 (如 "Equipment Setup" 章节)
- 对比说明处 (如 "Before vs After" 效果)
- 示例展示处 (如 "Example Video Preview")

**编号规则**:
- 按出现顺序编号: `image-placeholder-1.jpg`, `image-placeholder-2.jpg`, ...
- 最多 5 个占位符 (避免图片过多影响加载速度)
- 每个占位符对应一个独特的场景描述'
  ),
  updated_at = NOW()
WHERE slug = 'how-to';

-- ========== 2. 更新 alternatives 模板 ==========
UPDATE seo_content_templates
SET
  prompt_template = REPLACE(
    prompt_template,
    '#### 7.3 图片Alt Text占位符
为应该配图的位置添加图片占位符（至少3-5个）',
    E'#### 7.3 图片Alt Text占位符

**要求**: 在适当位置添加 3-5 个图片占位符

**格式规范**:
```markdown
![详细的alt文本描述](image-placeholder-1.jpg)
```

**Alt文本设计规则** (⚠️ 非常重要!):
1. **必须包含关键词**: 将目标关键词融入描述中
2. **描述具体场景**: 说明图片应该展示什么内容
3. **50-120字符**: 简洁但信息充足
4. **对于对比类文章**: 明确说明展示的是哪个备选方案的界面或功能

**示例** (假设关键词是 "alternatives to CapCut"):
- ✅ 好的 alt: `Adobe Premiere Rush video editing interface showing timeline, transitions panel, and mobile-friendly controls as CapCut alternative`
- ✅ 好的 alt: `InShot app main dashboard displaying video trimming tools and filter options for TikTok content creators`
- ✅ 好的 alt: `Side-by-side comparison of CapCut and Filmora Go mobile editing interfaces highlighting key feature differences`
- ❌ 差的 alt: `Video editor screenshot` (太简略)
- ❌ 差的 alt: `Alternative app` (没有具体信息)

**放置位置建议**:
- 每个备选方案介绍后
- 功能对比表格后
- 价格对比章节
- 用户界面说明处

**编号规则**:
- 按出现顺序编号: `image-placeholder-1.jpg`, `image-placeholder-2.jpg`, ...
- 最多 5 个占位符'
  ),
  updated_at = NOW()
WHERE slug = 'alternatives';

-- ========== 3. 更新 platform-specific 模板 ==========
UPDATE seo_content_templates
SET
  prompt_template = REPLACE(
    prompt_template,
    '#### 7.3 图片Alt Text占位符
为应该配图的位置添加图片占位符（至少3-5个）',
    E'#### 7.3 图片Alt Text占位符

**要求**: 在适当位置添加 3-5 个图片占位符

**格式规范**:
```markdown
![详细的alt文本描述](image-placeholder-1.jpg)
```

**Alt文本设计规则** (⚠️ 非常重要!):
1. **必须包含平台名称**: 明确指出目标平台 (TikTok, YouTube, Instagram等)
2. **描述具体场景**: 说明图片应该展示什么内容
3. **50-120字符**: 简洁但信息充足
4. **平台特色**: 突出平台独特的UI元素或功能

**示例** (假设平台是 "TikTok"):
- ✅ 好的 alt: `TikTok video upload interface showing vertical 9:16 format, sound library, and trending hashtag suggestions panel`
- ✅ 好的 alt: `TikTok Creator Studio analytics dashboard displaying video views, audience demographics, and engagement metrics`
- ✅ 好的 alt: `Mobile screen showing TikTok For You page algorithm with personalized video recommendations and scroll interface`
- ❌ 差的 alt: `Social media interface` (没有平台特指)
- ❌ 差的 alt: `App screenshot` (太简略)

**放置位置建议**:
- 平台功能介绍后
- 上传流程说明处
- 算法解释章节
- 最佳实践示例处

**编号规则**:
- 按出现顺序编号: `image-placeholder-1.jpg`, `image-placeholder-2.jpg`, ...
- 最多 5 个占位符'
  ),
  updated_at = NOW()
WHERE slug = 'platform-specific';

-- ========== 验证更新 ==========
DO $$
DECLARE
  howto_has_detailed_instructions BOOLEAN;
  alternatives_has_detailed_instructions BOOLEAN;
  platform_has_detailed_instructions BOOLEAN;
BEGIN
  -- 检查 how-to 模板是否包含详细指令
  SELECT prompt_template LIKE '%Alt文本设计规则%' INTO howto_has_detailed_instructions
  FROM seo_content_templates
  WHERE slug = 'how-to';

  -- 检查 alternatives 模板
  SELECT prompt_template LIKE '%Alt文本设计规则%' INTO alternatives_has_detailed_instructions
  FROM seo_content_templates
  WHERE slug = 'alternatives';

  -- 检查 platform-specific 模板
  SELECT prompt_template LIKE '%Alt文本设计规则%' INTO platform_has_detailed_instructions
  FROM seo_content_templates
  WHERE slug = 'platform-specific';

  IF howto_has_detailed_instructions AND alternatives_has_detailed_instructions AND platform_has_detailed_instructions THEN
    RAISE NOTICE '✅ 所有模板已成功更新,包含详细的图片 alt 文本设计规则';
  ELSE
    RAISE WARNING '⚠️  部分模板更新可能失败,请检查';
    RAISE NOTICE 'how-to: %, alternatives: %, platform-specific: %',
      howto_has_detailed_instructions,
      alternatives_has_detailed_instructions,
      platform_has_detailed_instructions;
  END IF;
END $$;

-- 显示更新后的模板长度
SELECT
  slug,
  LENGTH(prompt_template) as template_length,
  updated_at
FROM seo_content_templates
WHERE slug IN ('how-to', 'alternatives', 'platform-specific')
ORDER BY slug;
