# 邮件验证内容定制指南

## 当前状态
✅ 邮件验证功能正常工作
✅ 多语言支持已完成
⏳ 邮件模板需要定制

## 方案1：Supabase Dashboard定制（推荐）

### 步骤1：访问邮件模板设置
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目：`hvkzwrnvxsleeonqqrzq`
3. 左侧菜单 → Authentication → Email Templates

### 步骤2：编辑确认邮件模板
找到 "Confirm signup" 并编辑以下内容：

**邮件主题：**
```
🎬 欢迎加入 veo3video.me - 请验证您的邮箱
```

**邮件内容（HTML）：**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>邮箱验证</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">
                🎬 veo3video.me
            </h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                AI驱动的视频创作平台
            </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="color: #1a202c; margin: 0 0 20px 0; font-size: 24px;">
                欢迎加入我们！
            </h2>
            
            <p style="color: #4a5568; margin: 0 0 20px 0; font-size: 16px;">
                感谢您注册 veo3video.me。您现在可以使用AI技术轻松创建令人惊叹的视频内容了！
            </p>
            
            <p style="color: #4a5568; margin: 0 0 30px 0; font-size: 16px;">
                请点击下面的按钮验证您的邮箱地址以完成注册：
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="{{ .ConfirmationURL }}" 
                   style="display: inline-block; background-color: #4c51bf; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(76, 81, 191, 0.3);">
                    ✅ 验证邮箱地址
                </a>
            </div>
            
            <p style="color: #718096; font-size: 14px; margin: 30px 0 0 0;">
                如果按钮无法点击，请复制以下链接到浏览器地址栏：<br>
                <a href="{{ .ConfirmationURL }}" style="color: #4c51bf; word-break: break-all;">{{ .ConfirmationURL }}</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #a0aec0; font-size: 14px; margin: 0 0 10px 0;">
                ⏰ 此验证链接将在1小时后过期
            </p>
            <p style="color: #a0aec0; font-size: 14px; margin: 0 0 20px 0;">
                如果您没有注册此账户，请忽略此邮件
            </p>
            
            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                <p style="color: #718096; font-size: 14px; margin: 0;">
                    祝您使用愉快！<br>
                    <strong>veo3video.me 团队</strong>
                </p>
                
                <div style="margin-top: 20px;">
                    <a href="https://veo3video.me" style="color: #4c51bf; text-decoration: none; margin: 0 10px;">官网</a>
                    <a href="https://veo3video.me/help" style="color: #4c51bf; text-decoration: none; margin: 0 10px;">帮助中心</a>
                    <a href="https://discord.com/invite/UxFhMG7fyY" style="color: #4c51bf; text-decoration: none; margin: 0 10px;">Discord</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
```

### 步骤3：设置多语言邮件模板

可以为不同语言创建不同的模板：

**英文版本主题：**
```
🎬 Welcome to veo3video.me - Please verify your email
```

**英文版本内容要点：**
- Welcome to veo3video.me!
- Thank you for joining our AI-powered video creation platform
- Please verify your email address to complete registration
- This verification link will expire in 1 hour

## 方案2：自定义SMTP服务

### 配置Gmail SMTP
```toml
# supabase/config.toml
[auth.email.smtp]
enabled = true
host = "smtp.gmail.com"
port = 587
user = "your-email@gmail.com"
pass = "your-app-password"
admin_email = "noreply@veo3video.me"
sender_name = "veo3video.me"
```

### 使用SendGrid或其他服务
```toml
# 使用SendGrid
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "your-sendgrid-api-key"
admin_email = "noreply@veo3video.me"
sender_name = "veo3video.me"
```

## 方案3：自定义邮件发送服务

### 创建Edge Function
```typescript
// supabase/functions/send-custom-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { email, confirmationUrl } = await req.json()
  
  // 使用您喜欢的邮件服务API
  const emailContent = `
    <html>
      <!-- 您的自定义邮件模板 -->
    </html>
  `
  
  // 发送邮件逻辑
  return new Response(JSON.stringify({ success: true }))
})
```

## 最佳实践建议

### 1. 邮件设计要点
- ✅ 响应式设计，支持移动设备
- ✅ 清晰的品牌标识
- ✅ 明显的CTA按钮
- ✅ 简洁的文案
- ✅ 包含备用验证链接

### 2. 内容本地化
- 根据用户注册时选择的语言发送对应语言的邮件
- 考虑时区差异
- 使用当地的联系方式

### 3. 安全考虑
- 验证链接加密
- 设置合理的过期时间
- 包含安全提示信息

### 4. 测试建议
- 在多个邮件客户端测试显示效果
- 测试垃圾邮件过滤器
- 检查邮件送达率

## 即时行动步骤

1. **立即优化**：登录Supabase Dashboard编辑邮件模板
2. **中期改进**：考虑使用专业邮件服务
3. **长期规划**：建立完整的邮件营销系统

选择最适合您当前需求的方案开始实施！