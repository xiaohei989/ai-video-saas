# 安全性增强文档

本文档详细介绍了项目中实现的安全性增强功能，包括使用方法、配置选项和最佳实践。

## 📋 目录

- [概述](#概述)
- [Rate Limiting (限流)](#rate-limiting-限流)
- [CSRF 保护](#csrf-保护)
- [输入验证](#输入验证)
- [安全Cookie](#安全cookie)
- [安全监控](#安全监控)
- [配置说明](#配置说明)
- [最佳实践](#最佳实践)

## 概述

我们的安全系统包含以下几个核心组件：

1. **Rate Limiting**: 防止API滥用和DDoS攻击
2. **CSRF Protection**: 防止跨站请求伪造攻击
3. **Input Validation**: 防止SQL注入、XSS等注入攻击
4. **Secure Cookies**: 安全的Cookie管理
5. **Security Monitoring**: 实时安全事件监控和响应
6. **Enhanced Supabase Client**: 安全增强的数据库客户端

## Rate Limiting (限流)

### 使用方法

#### 1. 使用Rate Limiting Hook

```tsx
import { useRateLimiter } from '@/hooks/useRateLimiter';

function VideoGenerationComponent() {
  const { executeWithLimit, isLimited, getRemainingRequests } = useRateLimiter('VIDEO_GENERATION');

  const handleGenerateVideo = async () => {
    const result = await executeWithLimit(async () => {
      // 你的视频生成逻辑
      return await generateVideo();
    });

    if (result === null) {
      // 请求被限流
      console.log('请求被限流');
    }
  };

  return (
    <div>
      <button 
        onClick={handleGenerateVideo}
        disabled={isLimited()}
      >
        生成视频 (剩余: {getRemainingRequests()})
      </button>
    </div>
  );
}
```

#### 2. 直接使用Rate Limiter

```tsx
import { globalRateLimiter, RATE_LIMIT_CONFIGS } from '@/utils/rateLimiter';

// 检查限流
const result = globalRateLimiter.canMakeRequest(
  'user:123:api_call',
  RATE_LIMIT_CONFIGS.API_REQUEST.maxRequests,
  RATE_LIMIT_CONFIGS.API_REQUEST.windowMs
);

if (result.allowed) {
  // 执行请求
  console.log(`剩余请求次数: ${result.remaining}`);
} else {
  console.log(`请求被限制，${result.retryAfter}秒后重试`);
}
```

#### 3. Edge Function限流中间件

```typescript
import { rateLimiter, EDGE_FUNCTION_RATE_LIMITS } from '../_shared/rateLimitMiddleware.ts';

Deno.serve(async (request) => {
  // 应用限流中间件
  const rateLimitResponse = await rateLimiter.createMiddleware(
    EDGE_FUNCTION_RATE_LIMITS.VIDEO_GENERATION
  )(request);

  if (rateLimitResponse) {
    return rateLimitResponse; // 返回429错误
  }

  // 继续处理请求
  return new Response('Success');
});
```

### 配置选项

```typescript
// 自定义限流配置
const customConfig = {
  maxRequests: 50,    // 最大请求数
  windowMs: 60000,    // 时间窗口（毫秒）
  identifier: 'custom' // 自定义标识符
};

const { executeWithLimit } = useRateLimiter('API_REQUEST', customConfig);
```

## CSRF 保护

### 使用方法

#### 1. 使用CSRF Hook

```tsx
import { useCSRF } from '@/services/csrfService';

function SecureForm() {
  const { getToken, secureFetch } = useCSRF();

  const handleSubmit = async (formData: FormData) => {
    // 自动添加CSRF token
    const response = await secureFetch('/api/submit', {
      method: 'POST',
      body: formData
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* CSRF token会自动添加到请求头 */}
      <input type="text" name="data" />
      <button type="submit">提交</button>
    </form>
  );
}
```

#### 2. 手动使用CSRF Service

```tsx
import { csrfService } from '@/services/csrfService';

// 获取token
const token = csrfService.getToken();

// 验证token
const isValid = csrfService.validateToken(token);

// 刷新token
const newToken = csrfService.refreshToken();
```

#### 3. 带CSRF保护的装饰器

```tsx
import { withCSRFProtection } from '@/services/csrfService';

const protectedApiCall = withCSRFProtection(async (data: any) => {
  return await apiCall(data);
});
```

## 输入验证

### 使用方法

#### 1. 字符串验证

```tsx
import { InputValidator } from '@/utils/inputValidator';

const result = InputValidator.validateString(userInput, {
  sanitize: true,
  allowHtml: false,
  maxLength: 1000
});

if (result.isValid) {
  const cleanData = result.sanitized;
  // 使用清理后的数据
} else {
  console.error('验证失败:', result.errors);
  console.warn('威胁检测:', result.threats);
}
```

#### 2. 使用Zod Schema验证

```tsx
import { validationSchemas } from '@/utils/inputValidator';

try {
  const validEmail = validationSchemas.email.parse(userEmail);
  const validUsername = validationSchemas.username.parse(userName);
} catch (error) {
  // 处理验证错误
}
```

#### 3. 文件验证

```tsx
const fileResult = await InputValidator.validateFile(uploadedFile);

if (fileResult.isValid) {
  // 文件安全，可以上传
  await uploadFile(uploadedFile);
} else {
  console.error('文件验证失败:', fileResult.errors);
}
```

#### 4. 使用验证Hook

```tsx
import { useValidatedInput } from '@/hooks/useValidatedInput';

function FormComponent() {
  const { value, error, validate } = useValidatedInput(validationSchemas.email);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validate(e.target.value);
  };

  return (
    <div>
      <input onChange={handleInputChange} />
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

## 安全Cookie

### 使用方法

#### 1. 基本Cookie操作

```tsx
import { secureCookieService, SECURE_COOKIE_CONFIGS } from '@/services/secureCookieService';

// 设置安全Cookie
secureCookieService.set('user_token', token, SECURE_COOKIE_CONFIGS.AUTH_TOKEN);

// 获取Cookie
const token = secureCookieService.get('user_token');

// 删除Cookie
secureCookieService.remove('user_token');
```

#### 2. 加密Cookie

```tsx
// 设置加密Cookie
await secureCookieService.setEncrypted('sensitive_data', userData);

// 获取加密Cookie
const userData = await secureCookieService.getEncrypted('sensitive_data');
```

#### 3. 签名Cookie

```tsx
// 设置签名Cookie
secureCookieService.setSigned('user_preferences', preferences);

// 获取并验证签名Cookie
const preferences = secureCookieService.getSigned('user_preferences');
```

## 安全监控

### 使用方法

#### 1. 记录安全事件

```tsx
import { securityMonitor } from '@/services/securityMonitorService';

// 记录登录尝试
await securityMonitor.logLoginAttempt(userId, success, {
  ipAddress: '192.168.1.1',
  userAgent: navigator.userAgent
});

// 记录文件上传
await securityMonitor.logFileUpload(
  userId,
  fileName,
  fileSize,
  mimeType,
  success,
  blocked
);

// 记录自定义安全事件
await securityMonitor.logSecurityEvent({
  type: ThreatType.SUSPICIOUS_PATTERN,
  level: SecurityLevel.MEDIUM,
  userId: 'user123',
  ipAddress: '192.168.1.1',
  details: { action: 'unusual_behavior' },
  blocked: false
});
```

#### 2. 检测可疑活动

```tsx
const isSuspicious = securityMonitor.detectSuspiciousActivity('api_call', {
  userId: 'user123',
  frequency: 150, // 频繁请求
  locationChange: true // 地理位置变化
});

if (isSuspicious) {
  // 采取安全措施
}
```

#### 3. 获取监控统计

```tsx
const stats = await securityMonitor.getMonitoringStats();

console.log('总事件数:', stats.totalEvents);
console.log('按类型统计:', stats.eventsByType);
console.log('可疑IP:', stats.suspiciousIPs);
```

#### 4. IP管理

```tsx
// 检查IP是否被阻止
const isBlocked = await securityMonitor.isIPBlocked('192.168.1.100');

// 阻止IP
await securityMonitor.blockIP('192.168.1.100', '恶意行为', 86400000); // 24小时

// 获取可疑IP列表
const suspiciousIPs = await securityMonitor.getSuspiciousIPs();
```

## 配置说明

### 环境变量

```bash
# .env.local
VITE_COOKIE_ENCRYPTION_KEY=your-32-char-encryption-key
VITE_COOKIE_SIGNATURE_SECRET=your-signature-secret
VITE_SECURITY_WEBHOOK=https://your-webhook-url
VITE_SECURITY_EMAIL=security@yourcompany.com
REDIS_URL=redis://localhost:6379
```

### 安全配置

```typescript
// src/config/security.ts
import { getSecurityConfig } from '@/config/security';

const config = getSecurityConfig(process.env.NODE_ENV);

// 自定义配置
config.RATE_LIMIT.MAX_REQUESTS = 200;
config.CSRF.TOKEN_LIFETIME = 7200000; // 2小时
```

### 数据库迁移

执行安全相关的数据库迁移：

```bash
supabase db push
```

这将创建以下表：
- `rate_limit_records` - 限流记录
- `rate_limit_events` - 限流事件日志  
- `ip_blacklist` - IP黑名单
- `security_events` - 安全事件日志
- `user_rate_limit_config` - 用户限流配置

## 最佳实践

### 1. Rate Limiting

- 为不同的操作设置不同的限流策略
- 对匿名用户设置更严格的限制
- 为高级用户提供更宽松的限制
- 定期清理过期的限流记录

```tsx
// 为高级用户调整限流
const { tier } = useSubscription();
const limitConfig = tier === 'enterprise' 
  ? { maxRequests: 1000, windowMs: 60000 }
  : RATE_LIMIT_CONFIGS.API_REQUEST;
```

### 2. CSRF 保护

- 在所有状态变更操作中启用CSRF保护
- 定期刷新CSRF token
- 在AJAX请求中自动包含CSRF token
- 在表单中使用hidden input传递token

### 3. 输入验证

- 永远不要信任用户输入
- 在客户端和服务端都进行验证
- 使用白名单而不是黑名单方法
- 及时更新威胁检测规则

```tsx
// 多层验证
const clientValidation = InputValidator.validateString(input);
if (!clientValidation.isValid) {
  return; // 客户端拒绝
}

// 发送到服务端进行二次验证
const response = await api.validate(input);
```

### 4. 安全Cookie

- 在生产环境中总是使用HTTPS
- 设置适当的过期时间
- 对敏感数据使用加密Cookie
- 定期检查Cookie的大小和数量

### 5. 安全监控

- 设置合适的告警阈值
- 定期审查安全日志
- 建立事件响应流程
- 自动化威胁响应

```tsx
// 配置告警
securityMonitor.updateAlertConfig({
  minimumLevel: SecurityLevel.HIGH,
  email: 'security@company.com',
  webhook: 'https://hooks.slack.com/...'
});
```

### 6. 性能考虑

- 使用Redis缓存提高限流性能
- 定期清理过期数据
- 批量处理安全事件
- 异步处理非关键安全检查

```tsx
// 异步安全检查
setTimeout(() => {
  securityMonitor.detectSuspiciousActivity(action, context);
}, 0);
```

## 监控和维护

### 1. 监控指标

定期检查以下指标：
- 限流触发频率
- CSRF攻击尝试次数
- 恶意输入检测数量
- 可疑IP活动
- 安全事件趋势

### 2. 日志分析

```bash
# 查看最近的安全事件
SELECT * FROM security_events 
WHERE timestamp > NOW() - INTERVAL '1 day' 
ORDER BY timestamp DESC;

# 获取限流统计
SELECT * FROM get_rate_limit_stats(NOW() - INTERVAL '1 day', NOW());
```

### 3. 定期任务

- 清理过期的限流记录
- 清理过期的IP黑名单
- 归档旧的安全日志
- 更新威胁检测规则

## 故障排除

### 常见问题

1. **限流误触发**
   - 检查限流配置是否过于严格
   - 验证用户标识是否正确
   - 检查Redis连接状态

2. **CSRF验证失败**
   - 确认token正确传递
   - 检查token是否过期
   - 验证域名配置

3. **输入验证过度严格**
   - 调整验证规则
   - 添加例外处理
   - 提供更好的错误信息

4. **安全监控告警过多**
   - 调整告警阈值
   - 优化检测规则
   - 过滤误报

### 调试工具

```tsx
// 开启调试模式
if (process.env.NODE_ENV === 'development') {
  // 显示详细的安全日志
  securityMonitor.setEnabled(true);
  
  // 显示限流状态
  console.log('Rate limit status:', rateLimiter.getStatus());
  
  // 显示CSRF token信息
  console.log('CSRF token:', csrfService.getTokenObject());
}
```

---

## 联系支持

如有安全相关问题或发现漏洞，请联系：
- 邮箱: security@yourcompany.com
- Slack: #security-alerts
- 紧急电话: +1-xxx-xxx-xxxx