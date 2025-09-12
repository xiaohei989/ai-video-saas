# 简单的OAuth品牌化解决方案

## 🎯 目标
让Google OAuth登录时显示更友好的域名，而不改变任何后端配置

## 💡 推荐方案：仅配置Google OAuth Console应用信息

### 方案1：更新Google OAuth应用品牌信息（最简单）

在Google Cloud Console中，您可以配置OAuth同意屏幕的品牌信息：

1. **访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials/consent)**
2. **编辑OAuth同意屏幕**
3. **更新应用信息**：
   - **应用名称**: `Veo3Video` 或 `AI视频生成平台`
   - **应用徽标**: 上传您的Logo
   - **应用首页链接**: `https://veo3video.me`
   - **应用隐私政策链接**: `https://veo3video.me/privacy`
   - **应用服务条款链接**: `https://veo3video.me/terms`

4. **授权域名**：
   - 添加: `veo3video.me`
   - 添加: `hvkzwrnvxsleeonqqrzq.supabase.co`

**效果**：
- OAuth登录页面将显示您的品牌名称和Logo
- 用户会看到"登录到 Veo3Video" 而不是复杂的域名
- 不需要改变任何代码或配置

### 方案2：仅使用主域名CNAME（如果您确实想改变显示域名）

如果您确实想让域名显示为 `veo3video.me` 而不是 `hvkzwrnvxsleeonqqrzq.supabase.co`：

#### DNS配置：
```dns
# 直接将主域名指向Supabase（不推荐用于生产网站）
Type: CNAME
Name: auth
Value: hvkzwrnvxsleeonqqrzq.supabase.co

# 这将创建 auth.veo3video.me
```

#### 环境变量（仅此一个）：
```bash
# 在 .env 中
VITE_SUPABASE_URL=https://auth.veo3video.me
```

#### Supabase Dashboard配置：
1. 添加自定义域名: `auth.veo3video.me`
2. 等待SSL证书配置

#### OAuth提供商更新：
- **Google**: 更新重定向URI为 `https://auth.veo3video.me/auth/v1/callback`
- **Apple**: 更新Return URL为 `https://auth.veo3video.me/auth/v1/callback`

## 🎯 我的建议：方案1（品牌信息更新）

**为什么推荐方案1**：
1. **零风险**：不改变任何技术配置
2. **立即生效**：几分钟内完成
3. **更好体验**：用户看到品牌名称，比域名更友好
4. **专业形象**：Logo + 品牌名比域名更专业

**实施步骤**：
1. 访问Google Cloud Console OAuth同意屏幕
2. 上传Logo，设置应用名称为 "Veo3Video"
3. 配置品牌链接
4. 保存

**效果对比**：
- **之前**: "登录到 hvkzwrnvxsleeonqqrzq.supabase.co"
- **之后**: "登录到 Veo3Video" （配有您的Logo）

这样用户体验更好，而且没有任何技术风险！