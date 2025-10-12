# Cloudinary 配置说明

## ❓ 是否需要 API Key？

**简短回答: 不需要！** 只需要 **Cloud Name** 即可使用。

---

## 📊 两种使用模式对比

### **模式1: Fetch API（推荐，无需 API Key）**

#### 配置要求
```bash
# 只需要这一个配置
CLOUDINARY_CLOUD_NAME=dk1a2b3c4
```

#### 工作原理
直接通过 URL 访问 Cloudinary 的公开转换服务：
```
https://res.cloudinary.com/{cloud_name}/video/upload/
  so_0.1,w_960,h_540,q_95,f_webp/fetch/{videoUrl}
```

#### 优点
- ✅ **零配置** - 只需要 Cloud Name
- ✅ **完全免费** - 不计入 API 配额
- ✅ **即开即用** - 注册后立即可用
- ✅ **适合公开视频** - 你的视频在 CDN 上已是公开的

#### 缺点
- ⚠️ 可能受滥用检测限制（Cloudinary 会监控异常流量）
- ⚠️ 仅支持公开可访问的视频 URL

---

### **模式2: Upload API（可选，需要 API Key）**

#### 配置要求
```bash
CLOUDINARY_CLOUD_NAME=dk1a2b3c4
CLOUDINARY_API_KEY=123456789012345      # 从 Dashboard 获取
CLOUDINARY_API_SECRET=your-api-secret   # 从 Dashboard 获取
```

#### 工作原理
通过认证的 API 上传视频并生成缩略图：
```typescript
POST https://api.cloudinary.com/v1_1/{cloud_name}/video/upload
Headers: { signature, api_key, timestamp }
```

#### 优点
- ✅ **更稳定** - 不受滥用检测影响
- ✅ **有配额保障** - 25,000 次转换/月（免费套餐）
- ✅ **更多功能** - 支持预设、webhook、私有视频等

#### 缺点
- ❌ 需要配置 API Key 和 Secret
- ❌ 需要生成签名（代码已自动处理）

---

## 🎯 推荐配置

### **情况1: 刚开始使用（推荐）**
```bash
# 只配置 Cloud Name
CLOUDINARY_CLOUD_NAME=dk1a2b3c4
```

**原因**:
- 你的视频已经在 CDN 上公开
- Fetch API 完全免费
- 配置最简单

---

### **情况2: 遇到频率限制或滥用检测**
```bash
# 添加 API Key 配置
CLOUDINARY_CLOUD_NAME=dk1a2b3c4
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret
```

**原因**:
- Upload API 有官方配额保障
- 不受滥用检测影响
- 适合高流量场景

---

## 📝 如何获取 Cloud Name

### 步骤1: 注册 Cloudinary
访问 https://cloudinary.com/users/register/free

### 步骤2: 登录 Dashboard
注册后自动跳转到 Dashboard

### 步骤3: 复制 Cloud Name
在 Dashboard 顶部找到：
```
Product Environment Credentials
Cloud name: dk1a2b3c4  ← 复制这个
```

### 步骤4: 配置到项目
```bash
# .env.local
CLOUDINARY_CLOUD_NAME=dk1a2b3c4
```

**完成！** 无需配置 API Key 即可使用。

---

## 🔑 如何获取 API Key（可选）

如果需要使用 Upload API，按以下步骤获取：

### 步骤1: 进入 Settings
Dashboard → 右上角齿轮图标 → Settings

### 步骤2: 进入 Security
左侧菜单 → Security → Access Keys

### 步骤3: 复制凭据
```
Cloud name: dk1a2b3c4
API Key: 123456789012345
API Secret: xxxxxxxxxxxxxxxxxxx  ← 点击 "Show" 显示
```

### 步骤4: 配置到项目
```bash
# .env.local
CLOUDINARY_CLOUD_NAME=dk1a2b3c4
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxx
```

---

## 🔄 系统自动切换逻辑

我们的代码已经实现了智能切换：

```typescript
// 1. 检查是否配置了 API Key
if (!apiKey || !apiSecret) {
  // 使用 Fetch API（无需认证）
  console.log('使用 Cloudinary Fetch API（无需 API Key）')
  const url = `https://res.cloudinary.com/${cloudName}/video/upload/...`
} else {
  // 使用 Upload API（需要认证）
  console.log('使用 Cloudinary Upload API（已配置 API Key）')
  const uploadResponse = await fetch('https://api.cloudinary.com/...')
}
```

**你无需手动选择**，系统会根据环境变量自动决定使用哪种模式。

---

## 💰 成本对比

| 模式 | 免费额度 | 计费方式 |
|------|---------|---------|
| **Fetch API** | 无限制* | 不计费 |
| **Upload API** | 25,000 次/月 | 超出后 $0.01/次 |

\* Fetch API 虽然免费，但 Cloudinary 可能会对异常高频访问进行限制。

---

## ❓ 常见问题

### Q1: 我应该选择哪种模式？
**A**: 先用 Fetch API（只需 Cloud Name），如果遇到限制再升级到 Upload API。

### Q2: Fetch API 有访问次数限制吗？
**A**: 官方没有明确限制，但会监控滥用。正常使用（每月几千次）不会有问题。

### Q3: 两种模式可以混用吗？
**A**: 可以！系统会自动检测配置并选择合适的模式。

### Q4: 如果 Fetch API 被限制了怎么办？
**A**: 配置 API Key 后系统会自动切换到 Upload API。

### Q5: 是否需要信用卡？
**A**: 免费套餐不需要信用卡，只需邮箱注册即可。

---

## ✅ 快速开始（最简配置）

```bash
# 1. 注册 Cloudinary: https://cloudinary.com
# 2. 复制 Cloud Name
# 3. 添加到 .env.local:
CLOUDINARY_CLOUD_NAME=dk1a2b3c4

# 完成！无需其他配置
```

---

## 🔍 验证配置

部署后检查日志，你会看到：

```bash
# 使用 Fetch API（无 API Key）
[AutoThumbnail] 使用 Cloudinary Fetch API（无需 API Key）
[AutoThumbnail] Cloudinary Fetch URL: https://res.cloudinary.com/...

# 或使用 Upload API（有 API Key）
[AutoThumbnail] 使用 Cloudinary Upload API（已配置 API Key）
[AutoThumbnail] Cloudinary generated URL: https://res.cloudinary.com/...
```

这样你就知道系统使用了哪种模式。

---

## 📚 相关链接

- Cloudinary 注册: https://cloudinary.com/users/register/free
- Fetch API 文档: https://cloudinary.com/documentation/fetch_remote_images
- Upload API 文档: https://cloudinary.com/documentation/image_upload_api_reference
- 定价详情: https://cloudinary.com/pricing
