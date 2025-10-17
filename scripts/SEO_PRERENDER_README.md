# SEO预渲染使用指南

## 📖 概述

本项目实现了**静态HTML预渲染**功能，用于优化SEO指南页面的搜索引擎优化（SEO）。

预渲染后，搜索引擎爬虫和社交媒体平台能够直接读取完整的HTML内容，而不需要执行JavaScript。

---

## 🚀 快速开始

### 1️⃣ **构建生产版本并预渲染**

```bash
npm run build:seo
```

这个命令会：
1. 运行 `npm run build` 构建生产版本
2. 运行 `npm run seo:prerender` 预渲染所有SEO指南页面

### 2️⃣ **预览预渲染结果**

```bash
npm run preview:seo
```

然后访问：
- http://localhost:3000/en/guide/{slug}/
- http://localhost:3000/zh/guide/{slug}/
- http://localhost:3000/ja/guide/{slug}/

### 3️⃣ **仅预渲染（不重新构建）**

如果已经构建好了，只想重新预渲染：

```bash
npm run seo:prerender
```

---

## 📂 文件结构

预渲染后的目录结构：

```
build/
├── index.html                    # SPA入口
├── assets/                       # JS/CSS资源
├── sitemap-guides.xml            # SEO指南sitemap
├── robots.txt                    # robots配置
├── en/
│   └── guide/
│       ├── cat-trampoline/
│       │   └── index.html       # 预渲染的静态HTML ✅
│       ├── dog-beach/
│       │   └── index.html
│       └── ...
├── zh/
│   └── guide/
│       └── ...
└── ja/
    └── guide/
        └── ...
```

---

## 🎯 工作原理

### **预渲染流程**

```
┌─────────────────────────────────────────────┐
│  1. 从Supabase获取所有已发布的SEO指南       │
│     - template_seo_guides表                 │
│     - 仅包含is_published=true的记录         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  2. 生成路由列表                            │
│     /en/guide/cat-trampoline                │
│     /zh/guide/cat-trampoline                │
│     /ja/guide/cat-trampoline                │
│     ...                                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  3. 启动Puppeteer无头浏览器                 │
│     - 访问每个URL                           │
│     - 等待React渲染完成                     │
│     - 提取完整HTML                          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  4. 保存静态HTML文件                        │
│     build/en/guide/cat-trampoline/index.html│
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  5. 生成sitemap.xml和更新robots.txt         │
└─────────────────────────────────────────────┘
```

### **渲染结果对比**

#### ❌ **预渲染前（CSR）**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>AI Video SaaS</title>
  </head>
  <body>
    <div id="root"></div>  <!-- 空的！ -->
    <script src="/assets/index.js"></script>
  </body>
</html>
```

#### ✅ **预渲染后（SSG）**
```html
<!DOCTYPE html>
<html>
  <head>
    <title>How to Create Cat Trampoline Videos | AI Video Guide</title>
    <meta name="description" content="Learn how to create...">
    <meta property="og:title" content="...">
    <meta property="og:image" content="...">
    <!-- 完整的SEO meta标签 -->
  </head>
  <body>
    <div id="root">
      <article>
        <h1>How to Create Cat Trampoline Videos</h1>
        <p>Step-by-step guide to creating...</p>
        <!-- 完整的页面内容 -->
      </article>
    </div>
    <script src="/assets/index.js"></script>
    <!-- JS加载后，React接管交互 -->
  </body>
</html>
```

---

## 🔧 配置选项

### **环境变量**

在运行预渲染前，确保设置了以下环境变量：

```bash
# Supabase配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 应用URL（预渲染时访问的本地URL）
APP_URL=http://localhost:3000
```

### **修改预渲染脚本**

编辑 `scripts/prerender-seo-guides.js`：

```javascript
// 并发控制：同时渲染的页面数量
const CONCURRENT_LIMIT = 3  // 默认3个

// 支持的语言
const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja', 'ko', 'es']

// Puppeteer选项
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
```

---

## 📊 预渲染统计

运行 `npm run seo:prerender` 后，你会看到：

```
🚀 [预渲染] 开始SEO指南预渲染...
📍 [预渲染] 构建目录: /path/to/build
🌐 [预渲染] 基础URL: http://localhost:3000

📋 [预渲染] 从数据库获取SEO指南路由...
✅ [预渲染] 找到 45 个已发布的SEO指南
📊 [预渲染] 生成了 45 个路由
📈 [预渲染] 路由分布: { en: 15, zh: 15, ja: 15 }

🌐 [预渲染] 启动Puppeteer浏览器...
✅ [预渲染] 浏览器已启动

📦 [预渲染] 开始渲染 45 个页面...

🔄 [预渲染] 渲染页面: /en/guide/cat-trampoline
✅ [预渲染] 已保存: build/en/guide/cat-trampoline/index.html

📊 [预渲染] 进度: 3/45
...

============================================================
✨ [预渲染] 预渲染完成！
============================================================
✅ 成功: 45
❌ 失败: 0
📦 总大小: 12.5 MB
⏱️  耗时: 45.2s
============================================================
```

---

## 🌐 部署到Cloudflare Pages

### **方法1：自动部署（推荐）**

在 `wrangler.toml` 中配置构建命令：

```toml
[build]
command = "npm run build:seo"
```

Cloudflare Pages会自动运行预渲染。

### **方法2：本地构建后部署**

```bash
# 1. 本地构建并预渲染
npm run build:seo

# 2. 部署到Cloudflare Pages
npm run cf:deploy
```

---

## 🔍 SEO验证

### **1. 检查HTML内容**

访问预渲染的页面，查看源代码（Ctrl+U）：

```bash
# 使用curl测试
curl http://localhost:3000/en/guide/cat-trampoline/ > test.html

# 检查meta标签
grep -i "meta name" test.html
grep -i "og:" test.html
```

### **2. Google Search Console**

1. 提交 `sitemap-guides.xml` 到 Google Search Console
2. 使用 **URL检查工具** 测试爬取
3. 查看 **覆盖率报告**

### **3. 社交媒体预览**

测试Facebook/Twitter分享预览：
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

---

## 🐛 故障排除

### **问题1：预渲染失败**

```
❌ [预渲染] 渲染失败 /en/guide/xxx: Timeout waiting for selector
```

**解决方法：**
1. 确保开发服务器正在运行（`npm run dev`）
2. 检查页面是否能正常加载
3. 增加超时时间：
   ```javascript
   await page.goto(url, {
     waitUntil: 'networkidle0',
     timeout: 120000  // 增加到2分钟
   })
   ```

### **问题2：数据库连接失败**

```
❌ [预渲染] 获取路由失败: Could not connect to database
```

**解决方法：**
1. 检查 `.env` 文件中的 Supabase 配置
2. 确保 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 正确

### **问题3：Puppeteer安装失败**

```
npm error puppeteer: Failed to download Chromium
```

**解决方法：**
```bash
# 使用系统Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer

# 或者使用代理
export PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors
npm install puppeteer
```

---

## 📚 相关文档

- [Puppeteer文档](https://pptr.dev/)
- [Google SEO指南](https://developers.google.com/search/docs)
- [Cloudflare Pages部署](https://developers.cloudflare.com/pages/)

---

## ⚡ 性能优化建议

### **1. 增加并发数**

如果服务器性能允许：

```javascript
const CONCURRENT_LIMIT = 5  // 从3增加到5
```

### **2. 使用缓存**

只预渲染更新的页面：

```javascript
// TODO: 实现增量预渲染
// 检查文件修改时间，跳过未更新的页面
```

### **3. 使用CDN缓存**

在Cloudflare Pages中启用缓存：
- HTML文件：`Cache-Control: public, max-age=3600`
- 静态资源：`Cache-Control: public, max-age=31536000, immutable`

---

## 🎉 总结

通过预渲染，你的SEO指南页面现在：

✅ 对搜索引擎友好（Google、Bing、百度都能抓取）
✅ 社交媒体分享预览完美
✅ 首屏加载速度快
✅ 保持React的交互性

**下一步：**
1. 运行 `npm run build:seo` 构建并预渲染
2. 使用 `npm run preview:seo` 本地验证
3. 部署到Cloudflare Pages
4. 在Google Search Console中提交sitemap

祝SEO优化成功！🚀
