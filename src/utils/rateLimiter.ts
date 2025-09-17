/**
 * 前端请求限流器 - 已废弃
 * 
 * @deprecated 此限流器已被移除，因为存在用户标识污染和误判问题
 * 现在使用服务端限流和业务逻辑控制（积分系统、并发限制等）
 * 基于滑动窗口算法，防止用户短时间内过度调用API
 */

import { SECURITY_CONFIG } from '../config/security';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private blocked: Map<string, number> = new Map();

  /**
   * 检查是否允许请求
   * @param key 限流标识符
   * @param maxRequests 最大请求数
   * @param windowMs 时间窗口(毫秒)
   * @returns 限流结果
   */
  canMakeRequest(
    key: string, 
    maxRequests: number, 
    windowMs: number
  ): RateLimitResult {
    const now = Date.now();
    
    // 检查是否在阻塞期
    const blockUntil = this.blocked.get(key);
    if (blockUntil && now < blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
        retryAfter: Math.ceil((blockUntil - now) / 1000)
      };
    }

    // 获取当前窗口内的请求
    const requests = this.requests.get(key) || [];
    const windowStart = now - windowMs;
    
    // 清理过期请求
    const validRequests = requests.filter(time => time > windowStart);
    
    // 检查是否超过限制
    if (validRequests.length >= maxRequests) {
      // 计算下次重置时间
      const oldestRequest = Math.min(...validRequests);
      const resetTime = oldestRequest + windowMs;
      
      // 如果频繁超限，临时阻塞
      if (validRequests.length > maxRequests * 1.5) {
        this.blocked.set(key, now + windowMs);
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000)
      };
    }

    // 添加当前请求时间
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    // 清理阻塞记录
    if (blockUntil && now >= blockUntil) {
      this.blocked.delete(key);
    }

    return {
      allowed: true,
      remaining: maxRequests - validRequests.length,
      resetTime: Math.min(...validRequests) + windowMs
    };
  }

  /**
   * 获取限流状态
   * @param key 限流标识符
   * @param maxRequests 最大请求数
   * @param windowMs 时间窗口
   * @returns 当前状态
   */
  getStatus(key: string, maxRequests: number, windowMs: number) {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => time > now - windowMs);
    
    return {
      requestCount: validRequests.length,
      remaining: Math.max(0, maxRequests - validRequests.length),
      isBlocked: this.blocked.has(key) && this.blocked.get(key)! > now
    };
  }

  /**
   * 清理过期数据
   */
  cleanup() {
    const now = Date.now();
    
    // 清理请求记录
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > now - 3600000); // 1小时
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
    
    // 清理阻塞记录
    for (const [key, blockUntil] of this.blocked.entries()) {
      if (now >= blockUntil) {
        this.blocked.delete(key);
      }
    }
  }

  /**
   * 手动重置限流
   * @param key 限流标识符
   */
  reset(key: string) {
    this.requests.delete(key);
    this.blocked.delete(key);
  }
}

// 预定义的限流配置（从security配置读取）
export const RATE_LIMIT_CONFIGS = {
  // API请求
  API_REQUEST: SECURITY_CONFIG.RATE_LIMIT.LIMITS.API_GENERAL,
  
  // 视频生成
  VIDEO_GENERATION: SECURITY_CONFIG.RATE_LIMIT.LIMITS.VIDEO_GENERATION,
  
  // 用户登录
  LOGIN_ATTEMPT: SECURITY_CONFIG.RATE_LIMIT.LIMITS.LOGIN_ATTEMPT,
  
  // 密码重置
  PASSWORD_RESET: SECURITY_CONFIG.RATE_LIMIT.LIMITS.PASSWORD_RESET,
  
  // 邮件发送
  EMAIL_SEND: { 
    maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_EMAIL_SEND_MAX) || 10, 
    windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_EMAIL_SEND_WINDOW) || 3600000 
  },
  
  // 文件上传
  FILE_UPLOAD: SECURITY_CONFIG.RATE_LIMIT.LIMITS.FILE_UPLOAD,
  
  // 模板创建
  TEMPLATE_CREATE: { 
    maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_TEMPLATE_CREATE_MAX) || 20, 
    windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_TEMPLATE_CREATE_WINDOW) || 3600000 
  },
  
  // 点赞操作
  LIKE_ACTION: SECURITY_CONFIG.RATE_LIMIT.LIMITS.LIKE_ACTION,
  
  // 评论发布
  COMMENT_POST: SECURITY_CONFIG.RATE_LIMIT.LIMITS.COMMENT_POST,
  
  // 搜索请求
  SEARCH_REQUEST: { 
    maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_SEARCH_REQUEST_MAX) || 200, 
    windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_SEARCH_REQUEST_WINDOW) || 300000 
  }
} as const;

// 全局限流器实例
export const globalRateLimiter = new RateLimiter();

// 定期清理过期数据
if (typeof window !== 'undefined') {
  setInterval(() => {
    globalRateLimiter.cleanup();
  }, 300000); // 每5分钟清理一次
}