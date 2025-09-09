# Google Analytics 4 集成指南

## 📊 概述

这个项目已经集成了完整的Google Analytics 4监控系统，用于跟踪用户行为、产品使用情况和业务指标。

## 🚀 快速开始

### 1. 获取GA4 Measurement ID

1. 访问 [Google Analytics](https://analytics.google.com/)
2. 创建新的GA4属性（如果还没有）
3. 在"管理" > "数据流" > "网站"中获取Measurement ID
4. Measurement ID格式为：`G-XXXXXXXXXX`

### 2. 配置环境变量

在 `.env` 文件中设置：

```bash
# Google Analytics 4 Measurement ID
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# 调试模式（开发环境建议开启）
VITE_GA_DEBUG_MODE=true
```

### 3. 测试集成

1. 启动开发服务器：`npm run dev`
2. 访问测试页面：`http://localhost:3000/test/analytics`
3. 同意Cookie使用
4. 点击测试按钮发送事件
5. 在GA4实时报告中查看数据

## 📈 已集成的事件跟踪

### 🔐 用户认证事件
- **sign_up**: 用户注册（邮箱/Google）
- **login**: 用户登录（邮箱/Google）
- **logout**: 用户登出

### 🎬 视频生成事件
- **video_generation_start**: 视频生成开始
- **video_generation_complete**: 视频生成完成
- **video_generation_failed**: 视频生成失败
- **video_download**: 视频下载
- **video_share**: 视频分享

### 📄 模板互动事件
- **template_view**: 模板浏览
- **template_like**: 模板点赞
- **template_use**: 模板使用
- **template_use_click**: 点击模板使用按钮

### 💳 商业事件
- **begin_checkout**: 开始结账流程
- **purchase**: 订阅/积分购买完成
- **credits_consumed**: 积分消费

### ⚙️ 功能使用事件
- **theme_change**: 主题切换
- **language_change**: 语言切换
- **filter_applied**: 筛选操作
- **search**: 搜索操作

### 🐛 系统监控事件
- **error_occurred**: 错误跟踪
- **timing_complete**: 性能指标
- **feature_usage**: 功能使用统计

## 🎯 自定义维度和指标

### 用户维度
- **subscription_tier**: 用户订阅等级
- **credits_balance_range**: 积分余额范围
- **language**: 用户语言偏好
- **registration_method**: 注册方式（Google/邮箱）

### 产品维度
- **template_category**: 模板分类
- **api_provider**: AI API提供商
- **video_quality**: 视频质量设置
- **aspect_ratio**: 视频宽高比

## 🛠️ 使用方法

### 在组件中使用Analytics

```tsx
import { useAnalytics } from '@/hooks/useAnalytics'

function MyComponent() {
  const { trackEvent, trackTemplateView } = useAnalytics()
  
  const handleClick = () => {
    // 跟踪自定义事件
    trackEvent({
      action: 'button_click',
      category: 'user_interaction',
      label: 'header_cta',
      value: 1
    })
  }
  
  const handleTemplateView = (templateId: string) => {
    // 跟踪模板查看
    trackTemplateView(templateId, 'ASMR')
  }
  
  return (
    <button onClick={handleClick}>
      Click me
    </button>
  )
}
```

### 直接使用Analytics服务

```tsx
import analyticsService from '@/services/analyticsService'

// 跟踪购买事件
analyticsService.trackPurchase({
  transaction_id: 'txn_123',
  value: 9.99,
  currency: 'USD',
  items: [{
    item_id: 'basic_plan',
    item_name: 'Basic Subscription',
    item_category: 'subscription',
    price: 9.99,
    quantity: 1
  }]
})
```

## 🍪 隐私和合规

### GDPR合规
- 自动显示Cookie同意横幅
- 用户可以选择接受或拒绝Analytics跟踪
- 支持多语言隐私说明
- 符合欧盟GDPR要求

### 数据隐私
- 所有数据完全匿名化
- 不收集个人身份信息
- IP地址自动匿名化
- 禁用广告功能

## 📊 GA4配置建议

### 1. 设置自定义事件

在GA4中创建以下自定义事件：
- `video_generation_start`
- `video_generation_complete`
- `template_view`
- `template_like`
- `credits_consumed`

### 2. 配置转化目标

设置以下转化目标：
- 用户注册完成
- 首次视频生成
- 订阅购买
- 积分购买

### 3. 创建自定义报告

建议创建的报告：
- 用户注册漏斗
- 视频生成成功率
- 模板使用热力图
- 订阅转化分析

## 🔧 故障排除

### 常见问题

1. **事件不显示在GA4中**
   - 检查Measurement ID是否正确
   - 确认用户已同意Cookie使用
   - 查看浏览器控制台是否有错误

2. **开发环境下无法看到事件**
   - 开发环境使用测试模式，事件在控制台打印
   - 要查看真实数据，需要在生产环境测试

3. **类型错误**
   - 确认已安装所有依赖：`npm install gtag react-ga4`
   - 重启开发服务器

### 调试命令

```tsx
// 在组件中调试
const { debug } = useAnalytics()
debug()

// 或直接调用
import analyticsService from '@/services/analyticsService'
analyticsService.debug()
```

## 📈 业务价值

通过这个Analytics集成，你可以：

1. **了解用户行为**：哪些模板最受欢迎，用户如何使用产品
2. **优化转化率**：分析注册到付费的转化路径
3. **产品改进**：基于数据决定功能优先级
4. **收入分析**：跟踪订阅和积分购买表现
5. **性能监控**：识别慢页面和错误频发区域

## 🎨 扩展功能

### 添加新的事件跟踪

1. 在 `analyticsService.ts` 中添加新方法
2. 在 `useAnalytics.ts` Hook中暴露方法
3. 在组件中调用新方法

### 自定义维度

可以在 `UserProperties` 接口中添加新的用户属性，然后在用户登录时设置这些属性。

---

💡 **提示**: 定期查看GA4报告，根据数据洞察优化产品功能和用户体验！