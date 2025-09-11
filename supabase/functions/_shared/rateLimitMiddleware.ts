import { createClient } from '@supabase/supabase-js';

/**
 * Rate Limiting Middleware for Supabase Edge Functions
 * 基于Redis的高性能限流中间件
 */

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyGenerator?: (request: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (key: string, request: Request) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  totalHits: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export class RateLimitMiddleware {
  private redis: any;
  private supabase: any;

  constructor() {
    // 初始化Redis连接
    if (Deno.env.get('REDIS_URL')) {
      // 动态导入Redis，避免在没有Redis的环境中报错
      this.initRedis();
    }
    
    // 初始化Supabase客户端
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }

  private async initRedis() {
    try {
      // 动态导入Redis
      const { Redis } = await import('https://deno.land/x/redis@v0.29.4/mod.ts');
      this.redis = new Redis(Deno.env.get('REDIS_URL')!);
    } catch (error) {
      console.warn('Redis not available, falling back to database storage:', error);
    }
  }

  /**
   * 检查并应用限流
   */
  async checkRateLimit(
    request: Request,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const key = this.generateKey(request, options);
    
    if (this.redis) {
      return await this.checkWithRedis(key, options);
    } else {
      return await this.checkWithDatabase(key, options, request);
    }
  }

  /**
   * 生成限流键
   */
  private generateKey(request: Request, options: RateLimitOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    // 默认键生成策略
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const authorization = request.headers.get('authorization');
    const clientIP = this.getClientIP(request);
    
    // 尝试从JWT中获取用户ID
    let userId = 'anonymous';
    let isAuthenticated = false;
    
    if (authorization?.startsWith('Bearer ')) {
      try {
        const token = authorization.split(' ')[1];
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.sub && payload.sub !== 'anonymous') {
          userId = payload.sub;
          isAuthenticated = true;
        }
      } catch (error) {
        console.warn('JWT parsing failed:', error);
        // JWT解析失败，继续使用anonymous
      }
    }
    
    // 为匿名用户生成更细粒度的标识符，避免IP冲突
    if (!isAuthenticated) {
      // 使用IP + User-Agent的hash来区分不同的匿名用户
      const userFingerprint = this.generateUserFingerprint(clientIP, userAgent);
      userId = `anon_${userFingerprint}`;
    }

    return `rate_limit:${url.pathname}:${userId}`;
  }

  /**
   * 生成用户指纹用于匿名用户识别
   */
  private generateUserFingerprint(ip: string, userAgent: string): string {
    // 创建简单的hash来区分不同的匿名用户
    const combined = `${ip}:${userAgent}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIP(request: Request): string {
    // 检查各种可能的IP头
    const headers = [
      'cf-connecting-ip',      // Cloudflare
      'x-forwarded-for',       // 标准代理头
      'x-real-ip',             // Nginx
      'x-client-ip',           // Apache
      'forwarded'              // RFC 7239
    ];

    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        // X-Forwarded-For可能包含多个IP，取第一个
        const ip = value.split(',')[0].trim();
        if (this.isValidIP(ip)) {
          return ip;
        }
      }
    }

    return 'unknown';
  }

  /**
   * 验证IP地址格式
   */
  private isValidIP(ip: string): boolean {
    // 简单的IP验证
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * 使用Redis进行限流检查
   */
  private async checkWithRedis(
    key: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - (options.windowSeconds * 1000);

    // 使用Redis的有序集合实现滑动窗口
    const multi = this.redis.multi();
    
    // 删除窗口外的记录
    multi.zremrangebyscore(key, '-inf', windowStart);
    
    // 添加当前请求
    multi.zadd(key, now, `${now}-${Math.random()}`);
    
    // 获取当前窗口内的请求数
    multi.zcard(key);
    
    // 设置过期时间
    multi.expire(key, options.windowSeconds);
    
    const results = await multi.exec();
    const totalHits = results[2] as number;

    const allowed = totalHits <= options.maxRequests;
    const remaining = Math.max(0, options.maxRequests - totalHits);
    const resetTime = new Date(now + options.windowSeconds * 1000);

    // 如果超过限制，获取最早的请求时间来计算重试时间
    let retryAfter: number | undefined;
    if (!allowed) {
      const oldestRequests = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      if (oldestRequests.length > 0) {
        const oldestTime = parseInt(oldestRequests[1]);
        retryAfter = Math.ceil((oldestTime + options.windowSeconds * 1000 - now) / 1000);
      }
    }

    return {
      allowed,
      totalHits,
      remaining,
      resetTime,
      retryAfter
    };
  }

  /**
   * 使用数据库进行限流检查（Redis不可用时的备选方案）
   */
  private async checkWithDatabase(
    key: string,
    options: RateLimitOptions,
    request: Request
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - options.windowSeconds * 1000);

    try {
      // 使用存储过程检查限流
      const { data, error } = await this.supabase.rpc('check_rate_limit_v2', {
        p_key: key,
        p_max_requests: options.maxRequests,
        p_window_seconds: options.windowSeconds,
        p_ip_address: this.getClientIP(request),
        p_user_agent: request.headers.get('user-agent') || null
      });

      if (error) {
        console.error('Database rate limit check failed:', error);
        // 出错时默认允许请求，但记录错误
        return {
          allowed: true,
          totalHits: 0,
          remaining: options.maxRequests,
          resetTime: new Date(now.getTime() + options.windowSeconds * 1000)
        };
      }

      return {
        allowed: data.allowed,
        totalHits: data.total_hits,
        remaining: data.remaining,
        resetTime: new Date(data.reset_time),
        retryAfter: data.retry_after
      };
    } catch (error) {
      console.error('Rate limit database error:', error);
      // 数据库错误时允许请求
      return {
        allowed: true,
        totalHits: 0,
        remaining: options.maxRequests,
        resetTime: new Date(now.getTime() + options.windowSeconds * 1000)
      };
    }
  }

  /**
   * 创建限流中间件函数
   */
  createMiddleware(options: RateLimitOptions) {
    return async (request: Request): Promise<Response | null> => {
      const result = await this.checkRateLimit(request, options);

      if (!result.allowed) {
        // 调用限流回调
        if (options.onLimitReached) {
          const key = this.generateKey(request, options);
          options.onLimitReached(key, request);
        }

        // 记录限流事件
        await this.logRateLimitEvent(request, result);

        // 返回429状态
        return new Response(
          JSON.stringify({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${result.retryAfter || options.windowSeconds} seconds.`,
            retryAfter: result.retryAfter || options.windowSeconds
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(result.retryAfter || options.windowSeconds),
              'X-RateLimit-Limit': String(options.maxRequests),
              'X-RateLimit-Remaining': String(result.remaining),
              'X-RateLimit-Reset': String(Math.floor(result.resetTime.getTime() / 1000))
            }
          }
        );
      }

      // 添加限流信息到响应头（需要在实际的函数中设置）
      return null; // 允许请求继续
    };
  }

  /**
   * 记录限流事件
   */
  private async logRateLimitEvent(request: Request, result: RateLimitResult) {
    try {
      await this.supabase.from('rate_limit_events').insert({
        ip_address: this.getClientIP(request),
        user_agent: request.headers.get('user-agent'),
        path: new URL(request.url).pathname,
        method: request.method,
        total_hits: result.totalHits,
        limit_exceeded: !result.allowed,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log rate limit event:', error);
    }
  }
}

// 全局限流器实例
export const rateLimiter = new RateLimitMiddleware();

// 预定义的限流配置（从环境变量读取）
export const EDGE_FUNCTION_RATE_LIMITS = {
  // 视频生成API
  VIDEO_GENERATION: {
    windowSeconds: parseInt(Deno.env.get('EDGE_RATE_LIMIT_VIDEO_GENERATION_WINDOW')) || 3600,
    maxRequests: parseInt(Deno.env.get('EDGE_RATE_LIMIT_VIDEO_GENERATION_MAX')) || 50,
  },
  
  // 普通API
  GENERAL_API: {
    windowSeconds: parseInt(Deno.env.get('EDGE_RATE_LIMIT_GENERAL_API_WINDOW')) || 60,
    maxRequests: parseInt(Deno.env.get('EDGE_RATE_LIMIT_GENERAL_API_MAX')) || 100,
  },
  
  // 认证相关
  AUTH_API: {
    windowSeconds: parseInt(Deno.env.get('EDGE_RATE_LIMIT_AUTH_API_WINDOW')) || 900,
    maxRequests: parseInt(Deno.env.get('EDGE_RATE_LIMIT_AUTH_API_MAX')) || 10,
  },
  
  // 文件上传
  UPLOAD_API: {
    windowSeconds: parseInt(Deno.env.get('EDGE_RATE_LIMIT_UPLOAD_API_WINDOW')) || 3600,
    maxRequests: parseInt(Deno.env.get('EDGE_RATE_LIMIT_UPLOAD_API_MAX')) || 100,
  },
  
  // 管理员API
  ADMIN_API: {
    windowSeconds: parseInt(Deno.env.get('EDGE_RATE_LIMIT_ADMIN_API_WINDOW')) || 60,
    maxRequests: parseInt(Deno.env.get('EDGE_RATE_LIMIT_ADMIN_API_MAX')) || 200,
  }
} as const;