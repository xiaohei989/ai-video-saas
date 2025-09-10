/**
 * 安全增强的Supabase客户端
 * 集成CSRF保护、率限制、输入验证等安全特性
 */

import { createClient, SupabaseClient, PostgrestQueryBuilder, PostgrestFilterBuilder } from '@supabase/supabase-js';
import { csrfService } from './csrfService';
import { globalRateLimiter, RATE_LIMIT_CONFIGS } from '../utils/rateLimiter';
import { Database } from '../types';

export interface SecureClientOptions {
  enableCSRF: boolean;
  enableRateLimit: boolean;
  enableInputValidation: boolean;
  enableQueryLogging: boolean;
  maxQueryComplexity: number;
}

export interface QueryMetrics {
  queryType: string;
  tableName: string;
  duration: number;
  rowCount?: number;
  timestamp: Date;
}

export class SecureSupabaseClient {
  private client: SupabaseClient<Database>;
  private options: SecureClientOptions;
  private queryMetrics: QueryMetrics[] = [];
  private suspiciousQueries: Set<string> = new Set();

  constructor(
    url: string,
    anonKey: string,
    options: Partial<SecureClientOptions> = {}
  ) {
    this.options = {
      enableCSRF: true,
      enableRateLimit: true,
      enableInputValidation: true,
      enableQueryLogging: true,
      maxQueryComplexity: 10,
      ...options
    };

    // 创建基础Supabase客户端
    this.client = createClient<Database>(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      global: {
        headers: this.getSecureHeaders()
      }
    });

    // 初始化安全监控
    if (this.options.enableQueryLogging) {
      this.initializeQueryLogging();
    }
  }

  /**
   * 获取安全请求头
   */
  private getSecureHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Client-Info': 'secure-supabase-client',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (this.options.enableCSRF) {
      const token = csrfService.getToken();
      if (token) {
        headers['X-CSRF-Token'] = token;
      }
    }

    return headers;
  }

  /**
   * 初始化查询日志记录
   */
  private initializeQueryLogging(): void {
    // 拦截网络请求
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const startTime = Date.now();
      
      try {
        const response = await originalFetch(input, init);
        const duration = Date.now() - startTime;
        
        // 记录查询指标
        if (typeof input === 'string' && input.includes('supabase')) {
          this.recordQueryMetrics(input, init, duration, response);
        }
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordQueryError(input, init, duration, error);
        throw error;
      }
    };
  }

  /**
   * 记录查询指标
   */
  private recordQueryMetrics(
    url: string | URL,
    init: RequestInit | undefined,
    duration: number,
    response: Response
  ): void {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const tableName = pathParts[pathParts.length - 1] || 'unknown';
      const method = init?.method || 'GET';
      
      const metric: QueryMetrics = {
        queryType: method,
        tableName,
        duration,
        timestamp: new Date()
      };

      this.queryMetrics.push(metric);
      
      // 保留最近1000条记录
      if (this.queryMetrics.length > 1000) {
        this.queryMetrics = this.queryMetrics.slice(-1000);
      }

      // 检测异常查询
      this.detectAnomalousQuery(metric);
    } catch (error) {
      console.warn('Failed to record query metrics:', error);
    }
  }

  /**
   * 记录查询错误
   */
  private recordQueryError(
    url: string | URL,
    init: RequestInit | undefined,
    duration: number,
    error: any
  ): void {
    console.error('Supabase query error:', {
      url,
      method: init?.method,
      duration,
      error: error.message
    });
  }

  /**
   * 检测异常查询
   */
  private detectAnomalousQuery(metric: QueryMetrics): void {
    // 检测慢查询
    if (metric.duration > 5000) { // 5秒
      console.warn('Slow query detected:', metric);
    }

    // 检测频繁查询
    const recentQueries = this.queryMetrics
      .filter(q => Date.now() - q.timestamp.getTime() < 60000) // 最近1分钟
      .filter(q => q.tableName === metric.tableName && q.queryType === metric.queryType);
    
    if (recentQueries.length > 50) { // 1分钟内超过50次相同查询
      this.suspiciousQueries.add(`${metric.queryType}:${metric.tableName}`);
      console.warn('Suspicious query pattern detected:', metric);
    }
  }

  /**
   * 安全的from方法包装器
   */
  from<T extends keyof Database['public']['Tables']>(
    table: T
  ): SecurePostgrestQueryBuilder<Database['public']['Tables'][T]> {
    // 率限制检查
    if (this.options.enableRateLimit) {
      const limitResult = globalRateLimiter.canMakeRequest(
        `supabase:${table}`,
        RATE_LIMIT_CONFIGS.API_REQUEST.maxRequests,
        RATE_LIMIT_CONFIGS.API_REQUEST.windowMs
      );

      if (!limitResult.allowed) {
        throw new Error(`Rate limit exceeded for table ${table}. Retry after ${limitResult.retryAfter} seconds.`);
      }
    }

    const originalQuery = this.client.from(table);
    return new SecurePostgrestQueryBuilder(originalQuery, table, this.options);
  }

  /**
   * 安全的RPC调用
   */
  async rpc<T>(
    functionName: string,
    params?: Record<string, any>
  ): Promise<{ data: T | null; error: any }> {
    // 验证函数名
    if (!this.isValidFunctionName(functionName)) {
      throw new Error('Invalid function name');
    }

    // 率限制检查
    if (this.options.enableRateLimit) {
      const limitResult = globalRateLimiter.canMakeRequest(
        `supabase:rpc:${functionName}`,
        RATE_LIMIT_CONFIGS.API_REQUEST.maxRequests,
        RATE_LIMIT_CONFIGS.API_REQUEST.windowMs
      );

      if (!limitResult.allowed) {
        throw new Error(`Rate limit exceeded for RPC ${functionName}`);
      }
    }

    // 参数清理
    let cleanParams = params;
    if (this.options.enableInputValidation && params) {
      cleanParams = this.sanitizeParameters(params);
    }

    // 添加安全头
    const headers = this.getSecureHeaders();
    
    try {
      return await this.client.rpc(functionName, cleanParams);
    } catch (error) {
      console.error(`RPC call failed: ${functionName}`, error);
      throw error;
    }
  }

  /**
   * 验证函数名
   */
  private isValidFunctionName(name: string): boolean {
    // 只允许字母、数字和下划线
    return /^[a-z_][a-z0-9_]*$/.test(name);
  }

  /**
   * 清理参数
   */
  private sanitizeParameters(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      // 验证键名
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        console.warn(`Invalid parameter key: ${key}`);
        continue;
      }

      // 根据值类型清理
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          console.warn(`Invalid number value for ${key}`);
          continue;
        }
        sanitized[key] = value;
      } else if (typeof value === 'boolean' || value === null) {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => 
          typeof v === 'string' ? this.sanitizeString(v) : v
        );
      } else if (typeof value === 'object') {
        // 递归清理对象
        sanitized[key] = this.sanitizeParameters(value);
      } else {
        console.warn(`Unsupported parameter type for ${key}: ${typeof value}`);
      }
    }

    return sanitized;
  }

  /**
   * 清理字符串
   */
  private sanitizeString(str: string): string {
    // 移除潜在危险字符
    return str
      .replace(/['";\\]/g, '') // SQL注入字符
      .replace(/[<>]/g, '')    // XSS字符
      .replace(/--/g, '')      // SQL注释
      .replace(/\/\*/g, '')    // SQL块注释开始
      .replace(/\*\//g, '')    // SQL块注释结束
      .trim();
  }

  /**
   * 获取认证客户端
   */
  get auth() {
    return this.client.auth;
  }

  /**
   * 获取存储客户端
   */
  get storage() {
    return this.client.storage;
  }

  /**
   * 获取查询统计
   */
  getQueryStats(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: QueryMetrics[];
    suspiciousPatterns: string[];
  } {
    const totalQueries = this.queryMetrics.length;
    const averageDuration = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;
    const slowQueries = this.queryMetrics.filter(m => m.duration > 2000);

    return {
      totalQueries,
      averageDuration,
      slowQueries,
      suspiciousPatterns: Array.from(this.suspiciousQueries)
    };
  }

  /**
   * 清理查询统计
   */
  clearQueryStats(): void {
    this.queryMetrics = [];
    this.suspiciousQueries.clear();
  }
}

/**
 * 安全的Postgrest查询构建器
 */
class SecurePostgrestQueryBuilder<T> {
  constructor(
    private originalBuilder: any,
    private tableName: string,
    private options: SecureClientOptions
  ) {}

  select(columns?: string) {
    if (this.options.enableInputValidation && columns) {
      // 验证列名
      const columnList = columns.split(',').map(c => c.trim());
      for (const col of columnList) {
        if (!this.isValidColumnName(col)) {
          throw new Error(`Invalid column name: ${col}`);
        }
      }
    }
    return new SecurePostgrestFilterBuilder(this.originalBuilder.select(columns), this.options);
  }

  insert(values: any) {
    if (this.options.enableInputValidation) {
      // 这里可以添加输入验证逻辑
      console.log(`Inserting into ${this.tableName}:`, values);
    }
    return this.originalBuilder.insert(values);
  }

  update(values: any) {
    if (this.options.enableInputValidation) {
      console.log(`Updating ${this.tableName}:`, values);
    }
    return this.originalBuilder.update(values);
  }

  delete() {
    console.warn(`Delete operation on ${this.tableName}`);
    return this.originalBuilder.delete();
  }

  private isValidColumnName(name: string): boolean {
    // 基本的列名验证
    return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(name.trim());
  }
}

/**
 * 安全的Postgrest过滤器构建器
 */
class SecurePostgrestFilterBuilder<T> {
  constructor(
    private originalBuilder: any,
    private options: SecureClientOptions
  ) {}

  eq(column: string, value: any) {
    if (this.options.enableInputValidation) {
      this.validateFilter(column, value);
    }
    return new SecurePostgrestFilterBuilder(this.originalBuilder.eq(column, value), this.options);
  }

  neq(column: string, value: any) {
    if (this.options.enableInputValidation) {
      this.validateFilter(column, value);
    }
    return new SecurePostgrestFilterBuilder(this.originalBuilder.neq(column, value), this.options);
  }

  // 添加其他过滤器方法...

  private validateFilter(column: string, value: any): void {
    // 验证列名
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name in filter: ${column}`);
    }

    // 验证值
    if (typeof value === 'string' && value.length > 1000) {
      throw new Error('Filter value too long');
    }
  }

  // 代理所有其他方法到原始构建器
  [key: string]: any;
  
  // 这里需要手动实现代理逻辑，或使用Proxy
}

// 创建安全的Supabase客户端实例
export const createSecureSupabaseClient = (
  url: string,
  anonKey: string,
  options?: Partial<SecureClientOptions>
) => {
  return new SecureSupabaseClient(url, anonKey, options);
};