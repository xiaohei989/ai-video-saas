import React, { useCallback, useMemo, useRef } from 'react';
import { useAuthState } from './useAuthState';
import { 
  globalRateLimiter, 
  RateLimitConfig, 
  RateLimitResult, 
  RATE_LIMIT_CONFIGS 
} from '../utils/rateLimiter';

/**
 * Rate Limiting Hook
 * 为组件提供请求限流功能
 */
export function useRateLimiter(
  action: keyof typeof RATE_LIMIT_CONFIGS,
  customConfig?: Partial<RateLimitConfig>
) {
  const { user } = useAuthState();
  const toastShownRef = useRef<Set<string>>(new Set());

  // 获取限流配置
  const config = useMemo(() => {
    const baseConfig = RATE_LIMIT_CONFIGS[action];
    return {
      ...baseConfig,
      ...customConfig
    };
  }, [action, customConfig]);

  // 生成限流键（与后端保持一致）
  const getRateLimitKey = useCallback((additionalKey?: string) => {
    let userId = 'anonymous';
    
    if (user?.id) {
      userId = user.id;
    } else {
      // 为匿名用户生成指纹，与后端逻辑保持一致
      const userAgent = navigator.userAgent || 'unknown';
      const fingerprint = generateUserFingerprint(userAgent);
      userId = `anon_${fingerprint}`;
    }
    
    const baseKey = `${userId}:${action}`;
    return additionalKey ? `${baseKey}:${additionalKey}` : baseKey;
  }, [user?.id, action]);

  // 生成用户指纹（与后端算法保持一致）
  const generateUserFingerprint = (userAgent: string): string => {
    // 注意：前端无法获取真实IP，所以只使用UserAgent
    // 这与后端略有不同，但对于已登录用户不影响
    const combined = `frontend:${userAgent}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  };

  // 检查是否允许请求
  const checkLimit = useCallback((additionalKey?: string): RateLimitResult => {
    const key = getRateLimitKey(additionalKey);
    return globalRateLimiter.canMakeRequest(
      key,
      config.maxRequests,
      config.windowMs
    );
  }, [getRateLimitKey, config]);

  // 安全执行函数（带限流检查）
  const executeWithLimit = useCallback(async <T,>(
    fn: () => Promise<T>,
    additionalKey?: string,
    showToast = true
  ): Promise<T | null> => {
    const limitResult = checkLimit(additionalKey);
    
    if (!limitResult.allowed) {
      if (showToast) {
        const key = getRateLimitKey(additionalKey);
        
        // 避免重复显示相同的提示
        if (!toastShownRef.current.has(key)) {
          const { toast } = await import('sonner');
          
          toast.error('请求过于频繁', {
            description: limitResult.retryAfter 
              ? `请等待 ${limitResult.retryAfter} 秒后再试`
              : '请稍后再试',
            duration: 3000
          });
          
          toastShownRef.current.add(key);
          
          // 清理提示记录
          setTimeout(() => {
            toastShownRef.current.delete(key);
          }, 3000);
        }
      }
      
      return null;
    }

    try {
      return await fn();
    } catch (error) {
      // 如果是限流相关错误，重置限流状态
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status === 429) {
          // 服务端返回429，重置本地限流
          const key = getRateLimitKey(additionalKey);
          globalRateLimiter.reset(key);
        }
      }
      throw error;
    }
  }, [checkLimit, getRateLimitKey]);

  // 获取限流状态
  const getStatus = useCallback((additionalKey?: string) => {
    const key = getRateLimitKey(additionalKey);
    return globalRateLimiter.getStatus(key, config.maxRequests, config.windowMs);
  }, [getRateLimitKey, config]);

  // 重置限流
  const resetLimit = useCallback((additionalKey?: string) => {
    const key = getRateLimitKey(additionalKey);
    globalRateLimiter.reset(key);
  }, [getRateLimitKey]);

  // 是否被限流
  const isLimited = useCallback((additionalKey?: string) => {
    const limitResult = checkLimit(additionalKey);
    return !limitResult.allowed;
  }, [checkLimit]);

  // 获取剩余请求次数
  const getRemainingRequests = useCallback((additionalKey?: string) => {
    const limitResult = checkLimit(additionalKey);
    return limitResult.remaining;
  }, [checkLimit]);

  // 获取重置时间
  const getResetTime = useCallback((additionalKey?: string) => {
    const limitResult = checkLimit(additionalKey);
    return new Date(limitResult.resetTime);
  }, [checkLimit]);

  return {
    // 主要方法
    checkLimit,
    executeWithLimit,
    
    // 状态查询
    getStatus,
    isLimited,
    getRemainingRequests,
    getResetTime,
    
    // 管理方法
    resetLimit,
    
    // 配置信息
    config
  };
}

/**
 * 特定操作的Rate Limiter Hooks
 */

// 视频生成限流
export function useVideoGenerationLimiter() {
  return useRateLimiter('VIDEO_GENERATION');
}

// 登录限流
export function useLoginLimiter() {
  return useRateLimiter('LOGIN_ATTEMPT');
}

// 文件上传限流
export function useFileUploadLimiter() {
  return useRateLimiter('FILE_UPLOAD');
}

// 模板操作限流
export function useTemplateLimiter() {
  return useRateLimiter('TEMPLATE_CREATE');
}

// 社交操作限流
export function useLikeLimiter() {
  return useRateLimiter('LIKE_ACTION');
}

// 评论限流
export function useCommentLimiter() {
  return useRateLimiter('COMMENT_POST');
}

// API请求通用限流
export function useAPILimiter(customConfig?: Partial<RateLimitConfig>) {
  return useRateLimiter('API_REQUEST', customConfig);
}

/**
 * 高阶组件：为组件添加限流保护
 */
export function withRateLimit<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  action: keyof typeof RATE_LIMIT_CONFIGS,
  customConfig?: Partial<RateLimitConfig>
) {
  const WithRateLimitComponent = (props: P) => {
    const { isLimited } = useRateLimiter(action, customConfig);
    
    if (isLimited()) {
      return (
        <div className="text-center py-4">
          <p className="text-muted-foreground">请求过于频繁，请稍后再试</p>
        </div>
      );
    }
    
    return <WrappedComponent {...props} />;
  };
  
  WithRateLimitComponent.displayName = `withRateLimit(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithRateLimitComponent;
}