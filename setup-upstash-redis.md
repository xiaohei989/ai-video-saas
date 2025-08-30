# Upstash Redis 设置指南

## 🎯 为什么选择Upstash Redis

### 核心优势
1. **HTTP/REST API** - 完美适配Supabase Edge Functions
2. **Global分布** - 全球节点，最低延迟
3. **Serverless友好** - 无需TCP连接，适合无服务器环境
4. **自动扩展** - 根据负载自动调整
5. **高可用性** - 内置故障转移和备份

## 📋 设置步骤

### 第1步：创建Upstash Redis实例

1. 访问 [Upstash控制台](https://console.upstash.com/)
2. 创建新的Redis数据库
3. **重要：选择 "Global" 类型** 以获得最低延迟
4. 配置以下参数：
   ```
   Database Name: ai-video-saas-cache
   Type: Global
   Region: Auto (全球分布)
   Eviction: allkeys-lru (推荐)
   ```

### 第2步：获取连接凭证

从Upstash控制台的 "Details" > "REST API" 部分复制：
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 第3步：配置Supabase环境变量

```bash
# 设置Supabase Edge Functions环境变量
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase secrets set UPSTASH_REDIS_REST_URL="your-redis-url" --project-ref hvkzwrnvxsleeonqqrzq

SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase secrets set UPSTASH_REDIS_REST_TOKEN="your-redis-token" --project-ref hvkzwrnvxsleeonqqrzq
```

### 第4步：部署Edge Functions

```bash
# 部署缓存函数
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase functions deploy get-cached-data --project-ref hvkzwrnvxsleeonqqrzq

# 部署计数器处理函数  
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase functions deploy batch-update-counters --project-ref hvkzwrnvxsleeonqqrzq

# 部署社交缓存函数
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase functions deploy social-cache --project-ref hvkzwrnvxsleeonqqrzq
```

## 🏗️ 缓存架构设计

### 三层缓存架构
```
前端应用 (React)
    ↓ HTTP调用
Edge Functions (Deno)
    ↓ HTTP REST API
Upstash Redis (Global)
    ↓ 写入同步
PostgreSQL (Supabase)
```

### 缓存策略

#### 用户数据缓存
- **订阅信息**: TTL 1小时，用户操作时失效
- **积分余额**: TTL 1小时，积分变动时失效  
- **用户统计**: TTL 30分钟，定期更新

#### 模板数据缓存
- **模板统计**: TTL 5分钟，频繁更新
- **热门排行**: TTL 5分钟，定期重新计算
- **点赞状态**: TTL 24小时，用户操作时更新

#### 系统级缓存
- **队列状态**: TTL 30秒，实时更新
- **API配额**: TTL 10分钟，使用后更新

## 📊 预期性能提升

### 查询性能
| 功能 | 优化前 | 优化后 | 提升倍数 |
|------|--------|--------|----------|
| 用户订阅查询 | 50ms | 5ms | **10x** |
| 模板列表加载 | 500ms | 50ms | **10x** |
| 点赞状态检查 | 200ms | 20ms | **10x** |
| 热门模板排行 | 800ms | 30ms | **27x** |

### 并发能力
- **数据库连接减少**: 80%
- **系统吞吐量提升**: 5-10倍
- **缓存命中率目标**: >90%

## 🎛️ 监控指标

### Redis性能指标
```typescript
interface RedisMetrics {
  memory_usage: string        // 内存使用量
  operations_per_second: number // 操作频率
  hit_ratio: number           // 命中率
  latency_avg: number         // 平均延迟
  connected_clients: number   // 连接数
}
```

### 业务指标
- 用户体验响应时间
- API错误率
- 缓存失效频率
- 数据一致性检查

## ⚡ 立即执行命令

以下是可以立即执行的部署命令（需要先在Upstash创建Redis实例）：

```bash
# 1. 设置Redis凭证（替换为实际值）
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase secrets set UPSTASH_REDIS_REST_URL="https://your-redis-instance.upstash.io" --project-ref hvkzwrnvxsleeonqqrzq

SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase secrets set UPSTASH_REDIS_REST_TOKEN="your-token-here" --project-ref hvkzwrnvxsleeonqqrzq

# 2. 部署所有缓存Functions
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase functions deploy get-cached-data --project-ref hvkzwrnvxsleeonqqrzq
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase functions deploy batch-update-counters --project-ref hvkzwrnvxsleeonqqrzq  
SUPABASE_ACCESS_TOKEN=sbp_bce3f20e1be1fe5cab227066d5b9567973cb46bb supabase functions deploy social-cache --project-ref hvkzwrnvxsleeonqqrzq

# 3. 启用前端缓存
export VITE_ENABLE_CACHE=true
```

## 🔧 故障排查

### 常见问题
1. **Edge Function部署失败** - 检查环境变量是否正确设置
2. **Redis连接超时** - 验证REST URL和Token
3. **缓存不生效** - 确认VITE_ENABLE_CACHE=true
4. **数据不一致** - 检查计数器批量处理状态

### 调试工具
- Supabase Functions日志监控
- Upstash Redis控制台监控
- 前端控制台性能日志

---

**🎯 下一步：创建Upstash Redis实例并配置凭证，然后部署Edge Functions**