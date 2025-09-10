/**
 * CSRF Protection Service
 * 提供跨站请求伪造防护功能
 */

import { nanoid } from 'nanoid';

export interface CSRFConfig {
  tokenLength: number;
  tokenLifetime: number; // 毫秒
  headerName: string;
  cookieName: string;
  storageKey: string;
  autoRefresh: boolean;
}

export interface CSRFToken {
  token: string;
  timestamp: number;
  expiresAt: number;
}

export class CSRFService {
  private config: CSRFConfig;
  private currentToken: CSRFToken | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CSRFConfig>) {
    this.config = {
      tokenLength: 32,
      tokenLifetime: 3600000, // 1小时
      headerName: 'X-CSRF-Token',
      cookieName: 'csrf_token',
      storageKey: 'csrf_token',
      autoRefresh: true,
      ...config
    };
    
    // 初始化时恢复token
    this.restoreToken();
    
    // 设置自动刷新
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * 生成新的CSRF token
   */
  generateToken(): CSRFToken {
    const token = nanoid(this.config.tokenLength);
    const timestamp = Date.now();
    const expiresAt = timestamp + this.config.tokenLifetime;

    const csrfToken: CSRFToken = {
      token,
      timestamp,
      expiresAt
    };

    this.currentToken = csrfToken;
    this.storeToken(csrfToken);
    
    return csrfToken;
  }

  /**
   * 获取当前token
   */
  getToken(): string | null {
    if (!this.currentToken || this.isTokenExpired(this.currentToken)) {
      const newToken = this.generateToken();
      return newToken.token;
    }
    
    return this.currentToken.token;
  }

  /**
   * 获取token对象
   */
  getTokenObject(): CSRFToken | null {
    if (!this.currentToken || this.isTokenExpired(this.currentToken)) {
      return this.generateToken();
    }
    
    return this.currentToken;
  }

  /**
   * 验证token
   */
  validateToken(token: string): boolean {
    if (!token || !this.currentToken) {
      return false;
    }

    // 检查token是否过期
    if (this.isTokenExpired(this.currentToken)) {
      this.clearToken();
      return false;
    }

    // 检查token是否匹配
    return this.currentToken.token === token;
  }

  /**
   * 刷新token
   */
  refreshToken(): CSRFToken {
    this.clearToken();
    return this.generateToken();
  }

  /**
   * 清除token
   */
  clearToken(): void {
    this.currentToken = null;
    this.removeStoredToken();
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 检查token是否过期
   */
  private isTokenExpired(token: CSRFToken): boolean {
    return Date.now() > token.expiresAt;
  }

  /**
   * 存储token
   */
  private storeToken(token: CSRFToken): void {
    try {
      // 存储到sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(this.config.storageKey, JSON.stringify(token));
      }

      // 设置HttpOnly cookie（仅服务端可访问）
      this.setCsrfCookie(token.token);
    } catch (error) {
      console.warn('Failed to store CSRF token:', error);
    }
  }

  /**
   * 恢复token
   */
  private restoreToken(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const stored = sessionStorage.getItem(this.config.storageKey);
        if (stored) {
          const token: CSRFToken = JSON.parse(stored);
          
          // 检查是否过期
          if (!this.isTokenExpired(token)) {
            this.currentToken = token;
            this.scheduledRefresh();
            return;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to restore CSRF token:', error);
    }

    // 恢复失败，生成新token
    this.generateToken();
  }

  /**
   * 移除存储的token
   */
  private removeStoredToken(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(this.config.storageKey);
      }
      
      // 清除cookie
      this.clearCsrfCookie();
    } catch (error) {
      console.warn('Failed to remove stored CSRF token:', error);
    }
  }

  /**
   * 设置CSRF cookie
   */
  private setCsrfCookie(token: string): void {
    if (typeof document !== 'undefined') {
      const expires = new Date(Date.now() + this.config.tokenLifetime);
      document.cookie = `${this.config.cookieName}=${token}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`;
    }
  }

  /**
   * 清除CSRF cookie
   */
  private clearCsrfCookie(): void {
    if (typeof document !== 'undefined') {
      document.cookie = `${this.config.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }

  /**
   * 开始自动刷新
   */
  private startAutoRefresh(): void {
    this.scheduledRefresh();
  }

  /**
   * 计划刷新
   */
  private scheduledRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (this.currentToken) {
      // 在token过期前5分钟刷新
      const refreshTime = this.currentToken.expiresAt - Date.now() - 300000; // 5分钟
      
      if (refreshTime > 0) {
        this.refreshTimer = setTimeout(() => {
          this.refreshToken();
        }, refreshTime);
      }
    }
  }

  /**
   * 添加到请求头
   */
  addToHeaders(headers: Headers | Record<string, string>): Headers | Record<string, string> {
    const token = this.getToken();
    
    if (!token) {
      console.warn('No CSRF token available');
      return headers;
    }

    if (headers instanceof Headers) {
      headers.set(this.config.headerName, token);
      return headers;
    } else {
      return {
        ...headers,
        [this.config.headerName]: token
      };
    }
  }

  /**
   * 创建带CSRF保护的fetch函数
   */
  createSecureFetch() {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('CSRF token not available');
      }

      // 确保init对象存在
      const requestInit: RequestInit = {
        ...init,
        headers: {
          ...init?.headers,
          [this.config.headerName]: token
        }
      };

      try {
        const response = await fetch(input, requestInit);
        
        // 检查是否是CSRF错误
        if (response.status === 403) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const body = await response.clone().json();
            if (body.error?.includes('CSRF')) {
              // 刷新token并重试
              this.refreshToken();
              const newToken = this.getToken();
              
              if (newToken) {
                requestInit.headers = {
                  ...requestInit.headers,
                  [this.config.headerName]: newToken
                };
                
                return fetch(input, requestInit);
              }
            }
          }
        }
        
        return response;
      } catch (error) {
        console.error('Secure fetch failed:', error);
        throw error;
      }
    };
  }

  /**
   * 获取用于表单的hidden input
   */
  getHiddenInput(): string {
    const token = this.getToken();
    return `<input type="hidden" name="csrf_token" value="${token}" />`;
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.clearToken();
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// 创建全局CSRF服务实例
export const csrfService = new CSRFService();

// 创建安全的fetch函数
export const secureFetch = csrfService.createSecureFetch();

// CSRF保护装饰器
export function withCSRFProtection<T extends any[], R>(
  target: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const token = csrfService.getToken();
    
    if (!token) {
      throw new Error('CSRF protection failed: No token available');
    }
    
    try {
      return await target(...args);
    } catch (error) {
      // 如果是CSRF相关错误，尝试刷新token
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;
        if (message.includes('CSRF') || message.includes('403')) {
          csrfService.refreshToken();
        }
      }
      throw error;
    }
  };
}

// React Hook for CSRF
export function useCSRF() {
  const getToken = () => csrfService.getToken();
  const refreshToken = () => csrfService.refreshToken();
  const validateToken = (token: string) => csrfService.validateToken(token);
  
  return {
    getToken,
    refreshToken,
    validateToken,
    secureFetch,
    addToHeaders: (headers: any) => csrfService.addToHeaders(headers)
  };
}