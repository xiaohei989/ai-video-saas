# 修复R2 CORS问题

## 问题
R2存储桶缺少CORS配置，导致浏览器阻止跨域视频访问。

## 解决方案

### 方案1: Cloudflare Dashboard手动设置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 转到 "R2" -> "ai-video-storage"
3. 点击 "Settings" 标签
4. 找到 "CORS Policy" 部分
5. 添加以下CORS配置：

```json
{
  "rules": [
    {
      "allowed_origins": ["*"],
      "allowed_methods": ["GET", "HEAD"],
      "allowed_headers": ["*"],
      "max_age": 3600
    }
  ]
}
```

### 方案2: 通过Cloudflare API

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/c6fc8bcf3bba37f2611b6f3d7aad25b9/r2/buckets/ai-video-storage/cors" \
  -H "Authorization: Bearer [YOUR_API_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "allowed_origins": ["*"],
        "allowed_methods": ["GET", "HEAD"],
        "allowed_headers": ["*"],
        "max_age": 3600
      }
    ]
  }'
```

### 方案3: 使用Worker代理

如果CORS设置不成功，可以创建一个Cloudflare Worker来代理视频请求。