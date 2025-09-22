# Cloudflare CORS 配置方案

## 问题描述

Cloudflare Transform API 在浏览器中被CORS策略阻止，导致优化后的缩略图无法加载。

## 解决方案

使用 Cloudflare Workers 为 Transform API 添加 CORS 头。

## 配置步骤

### 方案一：Cloudflare Workers（推荐）

1. **创建 Worker**
   ```bash
   # 登录 Cloudflare Dashboard
   # 进入 Workers & Pages -> Create application -> Create Worker
   ```

2. **部署 Worker 代码**
   - 复制 `cloudflare-cors-worker.js` 的内容
   - 粘贴到 Worker 编辑器中
   - 点击 "Deploy"

3. **配置路由规则**
   ```
   路由模式: cdn.veo3video.me/cdn-cgi/image/*
   Worker: [你的worker名称]
   ```

4. **验证配置**
   ```bash
   # 测试CORS头是否正确添加
   curl -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://cdn.veo3video.me/cdn-cgi/image/w=450,q=95,f=auto/templates/thumbnails/test.jpg
   ```

### 方案二：Cloudflare Transform Rules

1. **进入 Cloudflare Dashboard**
   - 选择域名 `veo3video.me`
   - 进入 Rules -> Transform Rules

2. **创建 HTTP Response Header 规则**
   ```
   Rule name: Image Transform CORS
   
   When incoming requests match:
   - URI Path starts with "/cdn-cgi/image/"
   
   Then:
   - Set static header "Access-Control-Allow-Origin" to "*"
   - Set static header "Access-Control-Allow-Methods" to "GET, HEAD, OPTIONS"
   - Set static header "Access-Control-Allow-Headers" to "Content-Type, Authorization, Range"
   ```

3. **创建 OPTIONS 请求处理规则**
   ```
   Rule name: Image Transform OPTIONS
   
   When incoming requests match:
   - URI Path starts with "/cdn-cgi/image/"
   - HTTP Method equals "OPTIONS"
   
   Then:
   - Set status code to "200"
   - Set static header "Access-Control-Allow-Origin" to "*"
   - Set static header "Access-Control-Max-Age" to "86400"
   ```

### 方案三：Page Rules（简单但功能有限）

1. **创建 Page Rule**
   ```
   URL pattern: cdn.veo3video.me/cdn-cgi/image/*
   
   Settings:
   - Always Use HTTPS: On
   - Cache Level: Standard
   - Edge Cache TTL: 1 month
   ```

   注意：Page Rules 不能直接设置 CORS 头，推荐使用方案一或二。

## 验证配置

### 1. 浏览器控制台测试
```javascript
// 在浏览器控制台运行
fetch('https://cdn.veo3video.me/cdn-cgi/image/w=450,q=95,f=auto/templates/thumbnails/fireplace-seduction-selfie-thumbnail.jpg')
  .then(response => {
    console.log('CORS配置成功！', response.headers.get('Access-Control-Allow-Origin'));
  })
  .catch(error => {
    console.error('CORS问题未解决:', error);
  });
```

### 2. 命令行测试
```bash
# 测试预检请求
curl -X OPTIONS \
     -H "Origin: https://veo3video.me" \
     -H "Access-Control-Request-Method: GET" \
     -v \
     https://cdn.veo3video.me/cdn-cgi/image/w=450,q=95,f=auto/templates/thumbnails/test.jpg

# 应该看到类似输出：
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, HEAD, OPTIONS
```

### 3. 应用内验证
- 刷新模板页面
- 检查浏览器控制台，应该不再有CORS错误
- 缩略图应该能正常显示优化版本

## 推荐配置

**生产环境推荐方案一（Workers）**，因为：
- 更灵活的控制
- 可以处理复杂的CORS逻辑
- 支持错误处理和日志记录
- 不受Page Rules数量限制

**开发和测试推荐方案二（Transform Rules）**，因为：
- 配置简单
- 不需要额外的Worker代码
- 直接在Cloudflare面板配置

## 安全考虑

1. **域名限制**：生产环境中可以将 `*` 改为具体域名
   ```javascript
   'Access-Control-Allow-Origin': 'https://veo3video.me'
   ```

2. **方法限制**：只允许必要的HTTP方法
   ```javascript
   'Access-Control-Allow-Methods': 'GET, HEAD'
   ```

3. **头部限制**：只暴露必要的响应头
   ```javascript
   'Access-Control-Expose-Headers': 'Content-Length, Content-Type'
   ```

## 故障排除

### 常见问题

1. **配置后仍有CORS错误**
   - 检查路由规则是否正确匹配
   - 确认Worker已成功部署
   - 清除浏览器缓存

2. **图片加载缓慢**
   - 检查缓存配置
   - 确认CDN设置正确
   - 监控Worker性能

3. **部分图片失效**
   - 检查图片URL格式
   - 确认Transform参数正确
   - 验证原始图片可访问

### 调试命令

```bash
# 检查Worker状态
wrangler tail [worker-name]

# 测试特定图片
curl -v https://cdn.veo3video.me/cdn-cgi/image/w=450,q=95,f=auto/templates/thumbnails/[image-name]

# 检查DNS解析
nslookup cdn.veo3video.me
```