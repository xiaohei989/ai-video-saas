-- =====================================================
-- 为 alternatives 和 platform-specific 模板添加图片 Alt 文本规则
-- =====================================================
--
-- 原因: 这两个模板原本没有图片相关的指令
-- 解决: 在 "输出格式" 章节之前添加完整的图片 Alt 文本规则
-- =====================================================

-- ========== 更新 alternatives 模板 ==========
UPDATE seo_content_templates
SET
  prompt_template = REPLACE(
    prompt_template,
    '## 输出格式',
    E'### 7. 图片Alt Text占位符 (⚠️ 严格遵守格式模板!)

**要求**: 在适当位置添加 3-5 个图片占位符

**格式规范**:
```markdown
![详细的alt文本描述](image-placeholder-1.jpg)
```

**⚠️ Alt 文本强制模板** (必须从以下4种中选择,严格填充):

**模板 1: 应用界面对比类图片**
```
{应用名称1} app interface showing {具体界面区域} with {可见功能/按钮}, {界面主题}, compared to {应用名称2} showing {对应界面}, {设备类型} view
```
示例:
- `TikTok app interface showing vertical video feed with red heart like button and comment icons on right sidebar, dark theme, compared to Instagram Reels showing similar feed with different icon placement, iPhone Pro display view`
- `YouTube Shorts player screen showing swipe-up gesture area with channel subscribe button and share icon at bottom, light theme, next to TikTok showing duet split-screen feature, mobile portrait orientation`

**模板 2: 并列对比类图片**
```
Side-by-side comparison of {产品A名称} and {产品B名称} showing {对比维度}, {产品A特征} on left and {产品B特征} on right, {背景/布局}, {图表/视觉元素}
```
示例:
- `Side-by-side comparison of Audacity and Adobe Audition showing audio waveform editing interfaces, Audacity free version with basic timeline on left and Audition professional multitrack view on right, clean white background, labeled feature highlights with arrows`
- `Side-by-side comparison of CapCut Pro and Final Cut Pro showing video export settings panels, CapCut mobile-optimized presets on left and Final Cut advanced codec options on right, screenshot layout with version numbers visible`

**模板 3: 定价表/方案对比类图片**
```
{产品名称} pricing tier comparison table displaying {方案1}, {方案2}, {方案3} columns with {关键差异点}, {配色方案}, {高亮推荐项}, clean {风格描述} design
```
示例:
- `Canva Pro pricing tier comparison table displaying Free plan, Pro plan at $12.99/month, and Teams plan at $29.99/month with checkmarks showing feature differences, purple accent color highlighting Pro plan, clean modern card layout design`
- `Notion subscription plans comparison showing Personal Free, Plus at $8/month, Business at $15/month, and Enterprise with custom pricing in four column grid, blue gradient headers, recommended badge on Business tier, minimalist professional design`

**模板 4: 应用图标/Logo展示类图片**
```
{应用名称} app icon {颜色描述} with {图标元素描述} displayed on {设备屏幕/表面}, {周围元素}, {排列方式}, {光线/背景}
```
示例:
- `TikTok app icon black background with white musical note symbol displayed on iPhone home screen, surrounded by Instagram, YouTube, and Snapchat icons, grid layout with notification badges visible, bright device screen in dark environment`
- `Spotify app icon green circular design with three curved lines displayed on iPad Pro dock, next to Apple Music and YouTube Music icons, horizontal row arrangement, home screen blurred background with natural daylight`

**强制填写规则** (⚠️ 违反将导致图片生成失败):
✅ **必须包含**: 应用名称、界面元素、设备类型、主题/配色、对比维度
✅ **长度要求**: 60-150 字符
✅ **语言**: 使用英文,逗号分隔各要素
✅ **真实性**: 描述真实存在的应用和界面
❌ **严禁使用**: "ideal", "example", "sample", "placeholder", "typical", "generic"
❌ **严禁使用**: "good design", "nice layout", "professional appearance"
❌ **严禁**: 少于 60 字符的简短描述

**放置位置建议**:
- 每个替代品介绍后
- 功能对比章节中
- 定价/方案对比处
- 优缺点列表旁

**编号规则**:
- 按出现顺序编号: `image-placeholder-1.jpg`, `image-placeholder-2.jpg`, ...
- 最多 5 个占位符
- 每个占位符必须使用不同的模板类型,保持多样性

## 输出格式'
  ),
  updated_at = NOW()
WHERE slug = 'alternatives';

-- 验证 alternatives 更新
DO $$
DECLARE
  updated_content TEXT;
BEGIN
  SELECT prompt_template INTO updated_content
  FROM seo_content_templates
  WHERE slug = 'alternatives';

  IF updated_content LIKE '%强制模板%' AND updated_content LIKE '%模板 1: 应用界面对比类%' THEN
    RAISE NOTICE '✅ alternatives 模板已成功添加图片 Alt 文本规则';
  ELSE
    RAISE WARNING '⚠️  alternatives 模板添加可能失败,请检查';
  END IF;
END $$;

-- ========== 更新 platform-specific 模板 ==========
UPDATE seo_content_templates
SET
  prompt_template = REPLACE(
    prompt_template,
    '## 输出格式',
    E'### 7. 图片Alt Text占位符 (⚠️ 严格遵守格式模板!)

**要求**: 在适当位置添加 3-5 个图片占位符

**格式规范**:
```markdown
![详细的alt文本描述](image-placeholder-1.jpg)
```

**⚠️ Alt 文本强制模板** (必须从以下4种中选择,严格填充):

**模板 1: 平台界面/功能类图片**
```
{平台名称} {具体界面区域} showing {内容类型} with {可见功能/按钮/元素}, {界面主题}, {设备类型} view, {特色标识}
```
示例:
- `TikTok For You page feed showing ASMR vertical videos with red heart like buttons and sound wave icons, dark mode interface, iPhone Pro portrait view, signature black navigation bar at bottom`
- `YouTube Shorts shelf interface showing trending short-form videos with swipe-up gesture indicator and channel avatars, light theme, Android mobile display, red YouTube logo at top left`
- `Instagram Reels explore grid showing beauty content with play button overlays and view count badges, gradient purple-pink theme, iPad landscape orientation, Instagram camera icon visible`

**模板 2: 平台算法/推荐机制类图片**
```
{平台名称} {推荐系统名称} displaying {内容分发特征} with {可视化元素}, {算法指标}, {数据展示方式}, infographic style layout
```
示例:
- `TikTok For You algorithm flow diagram displaying user interaction signals with arrows pointing to video recommendations, engagement metrics like watch time and shares shown in blue boxes, flowchart style layout with platform logo watermark`
- `YouTube Shorts recommendation engine visualization showing viewer retention curve with percentage drop-off points, red graph line with timestamp markers, dashboard screenshot with play count and CTR metrics visible`
- `Instagram Reels discovery mechanism infographic displaying hashtag clusters and trending audio connections, purple node network diagram with engagement heatmap overlay, professional data visualization style`

**模板 3: 创作者工具/发布流程类图片**
```
{平台名称} creator studio/publishing interface showing {工具名称/功能} with {可操作元素}, {编辑状态}, {设备屏幕}, {可见工具栏/面板}
```
示例:
- `TikTok video upload screen showing sound library with ASMR category tabs and trending audio waveform previews, audio selection mode active, mobile interface with pink record button at center, effects and filters toolbar visible at bottom`
- `YouTube Shorts camera interface showing vertical recording view with countdown timer, flip camera icon, and speed control slider set to 1x, recording mode standby, smartphone held vertically, red record button prominent`
- `Instagram Reels editing timeline showing multi-clip video segments with transition effects panel open, clips arranged in sequence with trimming handles, editor mode active, mobile screen with purple accent colors`

**模板 4: 平台特色功能/案例演示类图片**
```
{平台名称} {特色功能名称} demonstration showing {功能效果/案例} with {可见交互元素}, {使用场景}, {设备视图}, {平台品牌元素}
```
示例:
- `TikTok Duet feature demonstration showing split-screen video with original ASMR content on left and reaction video on right, both playing simultaneously, mobile view with TikTok watermark, green screen effect visible on reaction side`
- `YouTube Shorts shelf placement showing recommended shorts in horizontal scrollable row on mobile homepage, thumbnail previews with view counts, scroll indicator dots at bottom, YouTube app interface with familiar red branding`
- `Instagram Reels Remix feature example showing side-by-side original dance video and remixed version with added effects, synchronized playback indicators, mobile portrait format, Instagram gradient logo overlay at top`

**强制填写规则** (⚠️ 违反将导致图片生成失败):
✅ **必须包含**: 平台名称、界面区域、功能元素、设备类型、平台品牌特征
✅ **长度要求**: 60-150 字符
✅ **语言**: 使用英文,逗号分隔各要素
✅ **真实性**: 描述真实平台功能和界面
❌ **严禁使用**: "ideal", "example", "sample", "placeholder", "typical", "generic"
❌ **严禁使用**: "good interface", "nice features", "professional platform"
❌ **严禁**: 少于 60 字符的简短描述

**放置位置建议**:
- 平台特色功能介绍后
- 算法机制说明处
- 创作者工具演示中
- 成功案例展示旁

**编号规则**:
- 按出现顺序编号: `image-placeholder-1.jpg`, `image-placeholder-2.jpg`, ...
- 最多 5 个占位符
- 每个占位符必须使用不同的模板类型,保持多样性

## 输出格式'
  ),
  updated_at = NOW()
WHERE slug = 'platform-specific';

-- 验证 platform-specific 更新
DO $$
DECLARE
  updated_content TEXT;
BEGIN
  SELECT prompt_template INTO updated_content
  FROM seo_content_templates
  WHERE slug = 'platform-specific';

  IF updated_content LIKE '%强制模板%' AND updated_content LIKE '%模板 1: 平台界面/功能类%' THEN
    RAISE NOTICE '✅ platform-specific 模板已成功添加图片 Alt 文本规则';
  ELSE
    RAISE WARNING '⚠️  platform-specific 模板添加可能失败,请检查';
  END IF;
END $$;

-- 最终验证：显示所有模板的更新状态
SELECT
  slug,
  LENGTH(prompt_template) as template_length,
  prompt_template LIKE '%强制模板%' as has_enforced_templates,
  prompt_template LIKE '%模板 1:%' as has_template_1,
  prompt_template LIKE '%模板 2:%' as has_template_2,
  prompt_template LIKE '%模板 3:%' as has_template_3,
  prompt_template LIKE '%模板 4:%' as has_template_4,
  to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM seo_content_templates
WHERE slug IN ('how-to', 'alternatives', 'platform-specific')
ORDER BY slug;
