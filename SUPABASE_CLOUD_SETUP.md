# Supabase云端邮箱验证配置指南

## 手动配置Supabase云端认证设置

由于我们无法通过CLI直接推送认证配置，需要在Supabase Dashboard中手动配置。

### 1. 访问Supabase Dashboard

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 登录您的账户
3. 选择项目：`hvkzwrnvxsleeonqqrzq`

### 2. 配置邮箱验证设置

#### 导航到认证设置
1. 在左侧菜单中点击 "Authentication"
2. 点击 "Settings" 标签

#### 启用邮箱确认
1. 找到 "User Signups" 部分
2. 确保 "Enable email confirmations" 被勾选 ✅
3. 点击 "Save" 保存设置

#### 配置重定向URLs
1. 在 "URL Configuration" 部分
2. 设置 "Site URL": `https://ai-video-saas.pages.dev` (或您的实际域名)
3. 在 "Additional Redirect URLs" 中添加:
   - `https://ai-video-saas.pages.dev/auth/callback`
   - `http://localhost:3000/auth/callback` (开发环境)

#### 邮件模板设置（可选）
1. 点击 "Email Templates" 标签
2. 可以自定义 "Confirm signup" 邮件模板
3. 设置合适的邮件主题和内容

### 3. 测试邮箱验证功能

#### 准备测试
1. 确保前端应用已部署到云端
2. 使用真实的邮箱地址进行测试

#### 执行测试
1. **访问注册页面**:
   ```
   https://ai-video-saas.pages.dev/signup
   ```

2. **填写注册信息**:
   - 邮箱: 使用您的真实邮箱地址
   - 密码: 满足复杂度要求
   - 用户名: 唯一用户名
   - 全名: 您的姓名

3. **提交注册**:
   - 点击"注册"按钮
   - 应该看到邮箱验证界面
   - 提示邮件已发送

4. **检查邮箱**:
   - 查看您的邮箱（包括垃圾邮件文件夹）
   - 应该收到来自Supabase的验证邮件
   - 邮件主题通常是 "Confirm your signup"

5. **完成验证**:
   - 点击邮件中的 "Confirm your mail" 链接
   - 应该跳转到您的应用并显示成功消息
   - 用户状态应该变为已验证

### 4. 验证结果检查

#### 在Supabase Dashboard中检查
1. 转到 "Authentication" → "Users"
2. 找到您刚注册的用户
3. 确认 "Email Confirmed" 状态为 ✅

#### 在应用中检查
1. 尝试登录刚注册的账户
2. 确认可以正常访问应用功能
3. 检查用户profile是否正确创建
4. 确认默认积分是否分配（50积分）

### 5. 常见问题解决

#### 没有收到验证邮件
1. 检查垃圾邮件文件夹
2. 确认邮箱地址输入正确
3. 在Dashboard中检查邮件发送日志
4. 尝试使用"重新发送验证邮件"功能

#### 验证链接无效
1. 检查URL配置是否正确
2. 确认链接没有过期（默认1小时）
3. 检查是否有防火墙阻止

#### 验证后无法登录
1. 在Dashboard中确认用户状态
2. 检查数据库中是否有profile记录
3. 查看认证日志中是否有错误

### 6. 生产环境优化

#### 自定义邮件模板
1. 设计符合品牌的邮件模板
2. 添加公司Logo和联系信息
3. 使用友好的邮件内容

#### 监控和分析
1. 定期检查邮件发送成功率
2. 监控用户验证转化率
3. 分析用户注册漏斗

#### 安全考虑
1. 设置合适的验证链接过期时间
2. 限制重新发送邮件的频率
3. 监控异常的注册模式

## 当前配置状态

✅ 邮箱验证已在代码中启用
✅ 前端处理逻辑已更新
✅ 重新发送邮件功能已实现
⏳ 需要在Dashboard中手动启用邮箱确认
⏳ 需要配置正确的重定向URLs

完成这些设置后，邮箱验证功能就完全可用了！