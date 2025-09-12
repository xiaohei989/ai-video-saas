# Google OAuth配置测试指南

## ✅ 已完成配置
- 应用名称：veo3video
- 应用徽标：已上传
- 应用首页：https://veo3video.me
- 隐私政策链接：已添加
- 服务条款链接：已添加
- 授权域名：已添加

## 🧪 测试步骤

### 1. 等待配置生效（5-15分钟）
Google需要时间同步您的配置更改。

### 2. 清除浏览器缓存
- Chrome: Ctrl+Shift+Delete（Windows）或 Cmd+Shift+Delete（Mac）
- 选择"所有时间"
- 清除"缓存的图片和文件"和"Cookie及其他网站数据"

### 3. 测试OAuth登录
1. 访问您的应用
2. 点击"Google登录"
3. 检查是否显示：
   - ✅ 应用名称："veo3video"或您的Logo
   - ❌ 不再显示："hvkzwrnvxsleeonqqrzq.supabase.co"

### 4. 如果仍显示旧信息
可能需要：
- 再等待5-10分钟
- 使用无痕浏览模式测试
- 尝试不同的浏览器

## 🔍 故障排除

### 如果配置仍未生效：

#### A. 检查应用发布状态
1. 在Google Cloud Console中检查应用是否处于"生产"状态
2. 如果显示"正在测试"，需要提交验证或发布应用

#### B. 验证OAuth客户端配置
1. 转到"客户端"页面
2. 编辑OAuth 2.0客户端
3. 确认重定向URI正确

#### C. 检查域名验证
确保所有域名都已通过验证

## 🎯 预期效果

配置成功后，用户在Google登录时将看到：

```
🔒 Google登录
[您的Logo] veo3video 想要访问您的Google帐号
继续登录 veo3video？
```

而不是：
```
选择账号以继续前往 hvkzwrnvxsleeonqqrzq.supabase.co
```