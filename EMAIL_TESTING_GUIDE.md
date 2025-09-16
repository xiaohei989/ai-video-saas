# 邮箱验证功能测试指南

## 前置条件

### 安装Docker Desktop
1. 访问 [Docker Desktop官网](https://docs.docker.com/desktop/)
2. 下载并安装适合您系统的版本
3. 启动Docker Desktop

### 启动Supabase本地环境
```bash
# 在项目根目录执行
npx supabase start
```

启动成功后您会看到类似以下的输出：
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6ebb9a0f4fa4a58
       S3 Region: local
```

## 邮件测试步骤

### 1. 访问邮件测试界面
打开浏览器访问：http://127.0.0.1:54324

这是Inbucket邮件捕获工具的界面，所有在本地开发环境发送的邮件都会被这里捕获。

### 2. 启动前端应用
```bash
npm run dev
```

### 3. 测试邮箱注册流程

1. **访问注册页面**：
   - 打开 http://localhost:3000/signup

2. **填写注册信息**：
   - 邮箱：test@example.com（可以是任意邮箱）
   - 密码：符合复杂度要求的密码
   - 用户名：testuser
   - 全名：Test User

3. **提交注册**：
   - 点击"注册"按钮
   - 应该看到"注册成功"的提示
   - 界面切换到邮箱验证页面

4. **查看验证邮件**：
   - 回到 http://127.0.0.1:54324
   - 在邮箱列表中找到 test@example.com
   - 点击查看邮件内容
   - 邮件应该包含验证链接

5. **完成邮箱验证**：
   - 点击邮件中的验证链接
   - 应该跳转到 /auth/callback 页面
   - 显示验证成功并跳转到应用主页

## 预期结果

### 成功的邮件验证流程应该包含：

1. **注册阶段**：
   ✅ 用户填写注册信息  
   ✅ 通过安全检查（IP限制、设备指纹等）  
   ✅ 显示"注册成功"提示  
   ✅ 切换到邮箱验证界面  

2. **邮件发送**：
   ✅ Inbucket中收到验证邮件  
   ✅ 邮件格式正确，包含验证链接  
   ✅ 发件人显示为合适的名称  

3. **邮箱验证**：
   ✅ 点击验证链接成功  
   ✅ 跳转到回调页面  
   ✅ 用户状态更新为已验证  
   ✅ 自动跳转到应用主页  

4. **后续流程**：
   ✅ 用户可以正常登录  
   ✅ Profile创建成功（50积分）  
   ✅ 邀请码功能正常（如果有）  

## 常见问题排查

### 1. 没有收到邮件
- 检查Supabase是否正常启动
- 确认 `enable_confirmations = true`
- 查看Supabase Studio日志

### 2. 验证链接无效
- 检查链接格式是否正确
- 确认 `site_url` 配置正确
- 检查 `additional_redirect_urls` 设置

### 3. 验证后无法登录
- 检查数据库中用户状态
- 确认 `handle_new_user()` 触发器正常
- 查看用户是否有profile记录

## 生产环境测试

在将邮箱验证部署到生产环境之前：

1. **确认Supabase项目设置**：
   - Auth设置中启用邮箱确认
   - 配置正确的site URL
   - 设置合适的邮件模板

2. **测试真实邮件发送**：
   - 使用真实邮箱地址注册
   - 确认能收到验证邮件
   - 验证链接能正常工作

3. **监控邮件发送**：
   - 查看Supabase仪表板的使用情况
   - 监控邮件发送成功率
   - 关注用户反馈

## 提示

- 本地开发时，所有邮件都不会真正发送，只会被Inbucket捕获
- 可以使用任意邮箱地址进行测试，无需真实存在
- Inbucket界面支持查看邮件HTML内容和纯文本内容
- 如果需要测试真实邮件发送，需要使用Supabase云端环境