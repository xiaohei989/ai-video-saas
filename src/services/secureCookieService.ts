/**
 * 安全Cookie服务
 * 提供安全的Cookie管理功能
 */

export interface CookieOptions {
  expires?: Date | number; // Date对象或毫秒数
  maxAge?: number; // 秒数
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  priority?: 'low' | 'medium' | 'high';
}

export interface SecureCookieConfig {
  defaultSecure: boolean;
  defaultSameSite: 'strict' | 'lax' | 'none';
  defaultPath: string;
  encryptionKey?: string;
  signatureSecret?: string;
}

export class SecureCookieService {
  private config: SecureCookieConfig;

  constructor(config?: Partial<SecureCookieConfig>) {
    this.config = {
      defaultSecure: window.location.protocol === 'https:',
      defaultSameSite: 'strict',
      defaultPath: '/',
      ...config
    };
  }

  /**
   * 设置Cookie
   */
  set(name: string, value: string, options: CookieOptions = {}): boolean {
    try {
      const cookieOptions: CookieOptions = {
        secure: this.config.defaultSecure,
        sameSite: this.config.defaultSameSite,
        path: this.config.defaultPath,
        ...options
      };

      // 验证Cookie名称
      if (!this.isValidCookieName(name)) {
        throw new Error(`Invalid cookie name: ${name}`);
      }

      // 验证Cookie值
      if (!this.isValidCookieValue(value)) {
        throw new Error(`Invalid cookie value for: ${name}`);
      }

      // 构建Cookie字符串
      const cookieString = this.buildCookieString(name, value, cookieOptions);
      
      // 检查Cookie大小限制
      if (cookieString.length > 4096) {
        throw new Error(`Cookie too large: ${name} (${cookieString.length} bytes)`);
      }

      document.cookie = cookieString;
      
      // 验证Cookie是否成功设置
      return this.get(name) === value;
    } catch (error) {
      console.error('Failed to set cookie:', error);
      return false;
    }
  }

  /**
   * 获取Cookie
   */
  get(name: string): string | null {
    try {
      if (!this.isValidCookieName(name)) {
        return null;
      }

      const nameEQ = encodeURIComponent(name) + '=';
      const cookies = document.cookie.split(';');

      for (let cookie of cookies) {
        let c = cookie.trim();
        if (c.indexOf(nameEQ) === 0) {
          const value = c.substring(nameEQ.length);
          return decodeURIComponent(value);
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get cookie:', error);
      return null;
    }
  }

  /**
   * 删除Cookie
   */
  remove(name: string, options: Partial<CookieOptions> = {}): boolean {
    try {
      const removeOptions: CookieOptions = {
        expires: new Date(0),
        path: this.config.defaultPath,
        ...options
      };

      return this.set(name, '', removeOptions);
    } catch (error) {
      console.error('Failed to remove cookie:', error);
      return false;
    }
  }

  /**
   * 检查Cookie是否存在
   */
  exists(name: string): boolean {
    return this.get(name) !== null;
  }

  /**
   * 获取所有Cookie
   */
  getAll(): Record<string, string> {
    try {
      const cookies: Record<string, string> = {};
      const cookieArray = document.cookie.split(';');

      for (let cookie of cookieArray) {
        const parts = cookie.trim().split('=');
        if (parts.length === 2) {
          const name = decodeURIComponent(parts[0]);
          const value = decodeURIComponent(parts[1]);
          cookies[name] = value;
        }
      }

      return cookies;
    } catch (error) {
      console.error('Failed to get all cookies:', error);
      return {};
    }
  }

  /**
   * 设置加密Cookie
   */
  async setEncrypted(
    name: string, 
    value: string, 
    options: CookieOptions = {}
  ): Promise<boolean> {
    try {
      if (!this.config.encryptionKey) {
        throw new Error('Encryption key not configured');
      }

      const encryptedValue = await this.encryptValue(value);
      return this.set(name, encryptedValue, {
        ...options,
        secure: true, // 加密Cookie必须使用HTTPS
        httpOnly: false // 前端需要能访问来解密
      });
    } catch (error) {
      console.error('Failed to set encrypted cookie:', error);
      return false;
    }
  }

  /**
   * 获取加密Cookie
   */
  async getEncrypted(name: string): Promise<string | null> {
    try {
      const encryptedValue = this.get(name);
      if (!encryptedValue || !this.config.encryptionKey) {
        return null;
      }

      return await this.decryptValue(encryptedValue);
    } catch (error) {
      console.error('Failed to get encrypted cookie:', error);
      return null;
    }
  }

  /**
   * 设置签名Cookie
   */
  setSignedO(name: string, value: string, options: CookieOptions = {}): boolean {
    try {
      if (!this.config.signatureSecret) {
        throw new Error('Signature secret not configured');
      }

      const signature = this.signValue(value);
      const signedValue = `${value}.${signature}`;
      
      return this.set(name, signedValue, options);
    } catch (error) {
      console.error('Failed to set signed cookie:', error);
      return false;
    }
  }

  /**
   * 获取签名Cookie
   */
  getSigned(name: string): string | null {
    try {
      const signedValue = this.get(name);
      if (!signedValue || !this.config.signatureSecret) {
        return null;
      }

      const lastDotIndex = signedValue.lastIndexOf('.');
      if (lastDotIndex === -1) {
        return null;
      }

      const value = signedValue.substring(0, lastDotIndex);
      const signature = signedValue.substring(lastDotIndex + 1);

      // 验证签名
      const expectedSignature = this.signValue(value);
      if (signature !== expectedSignature) {
        console.warn(`Cookie signature verification failed for: ${name}`);
        return null;
      }

      return value;
    } catch (error) {
      console.error('Failed to get signed cookie:', error);
      return null;
    }
  }

  /**
   * 构建Cookie字符串
   */
  private buildCookieString(
    name: string, 
    value: string, 
    options: CookieOptions
  ): string {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.expires) {
      if (typeof options.expires === 'number') {
        const expiresDate = new Date(Date.now() + options.expires);
        cookieString += `; Expires=${expiresDate.toUTCString()}`;
      } else {
        cookieString += `; Expires=${options.expires.toUTCString()}`;
      }
    }

    if (options.maxAge !== undefined) {
      cookieString += `; Max-Age=${options.maxAge}`;
    }

    if (options.domain) {
      cookieString += `; Domain=${options.domain}`;
    }

    if (options.path) {
      cookieString += `; Path=${options.path}`;
    }

    if (options.secure) {
      cookieString += '; Secure';
    }

    if (options.httpOnly) {
      // 注意：httpOnly属性在客户端JavaScript中无法设置
      console.warn('httpOnly flag cannot be set from client-side JavaScript');
    }

    if (options.sameSite) {
      cookieString += `; SameSite=${options.sameSite}`;
    }

    if (options.priority) {
      cookieString += `; Priority=${options.priority}`;
    }

    return cookieString;
  }

  /**
   * 验证Cookie名称
   */
  private isValidCookieName(name: string): boolean {
    // Cookie名称不能包含特殊字符
    const invalidChars = /[()<>@,;:\\"\/\[\]?={}\s]/;
    return name && !invalidChars.test(name);
  }

  /**
   * 验证Cookie值
   */
  private isValidCookieValue(value: string): boolean {
    // 基本的值验证
    return typeof value === 'string' && value.length < 4096;
  }

  /**
   * 加密值
   */
  private async encryptValue(value: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      
      // 生成加密密钥
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.config.encryptionKey),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );

      // 组合salt、iv和加密数据
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      // 转换为Base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  /**
   * 解密值
   */
  private async decryptValue(encryptedValue: string): Promise<string> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      // 从Base64解码
      const combined = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));
      
      // 分离salt、iv和加密数据
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encrypted = combined.slice(28);

      // 生成解密密钥
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.config.encryptionKey),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );

      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  /**
   * 签名值
   */
  private signValue(value: string): string {
    if (!this.config.signatureSecret) {
      throw new Error('Signature secret not available');
    }

    // 简单的HMAC签名（在实际应用中应该使用更安全的方法）
    const message = value + this.config.signatureSecret;
    return btoa(message).substring(0, 16); // 简化签名
  }

  /**
   * 清理所有Cookie
   */
  clearAll(exceptions: string[] = []): void {
    const cookies = this.getAll();
    
    for (const name of Object.keys(cookies)) {
      if (!exceptions.includes(name)) {
        this.remove(name);
      }
    }
  }

  /**
   * 获取Cookie统计信息
   */
  getStats(): {
    totalCookies: number;
    totalSize: number;
    largeCookies: Array<{name: string, size: number}>;
  } {
    const cookies = this.getAll();
    const totalCookies = Object.keys(cookies).length;
    let totalSize = 0;
    const largeCookies: Array<{name: string, size: number}> = [];

    for (const [name, value] of Object.entries(cookies)) {
      const size = name.length + value.length + 1; // +1 for '='
      totalSize += size;
      
      if (size > 1000) { // 标记大于1KB的Cookie
        largeCookies.push({ name, size });
      }
    }

    return {
      totalCookies,
      totalSize,
      largeCookies: largeCookies.sort((a, b) => b.size - a.size)
    };
  }
}

// 创建全局安全Cookie服务实例
export const secureCookieService = new SecureCookieService({
  encryptionKey: import.meta.env.VITE_COOKIE_ENCRYPTION_KEY,
  signatureSecret: import.meta.env.VITE_COOKIE_SIGNATURE_SECRET
});

// 安全Cookie配置常量
export const SECURE_COOKIE_CONFIGS = {
  // 认证相关Cookie
  AUTH_TOKEN: {
    secure: true,
    sameSite: 'strict' as const,
    httpOnly: false, // 前端需要访问
    maxAge: 86400, // 24小时
    path: '/'
  },
  
  // CSRF Token
  CSRF_TOKEN: {
    secure: true,
    sameSite: 'strict' as const,
    httpOnly: false,
    maxAge: 3600, // 1小时
    path: '/'
  },
  
  // 用户偏好设置
  USER_PREFERENCES: {
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 2592000, // 30天
    path: '/'
  },
  
  // 分析追踪
  ANALYTICS: {
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 31536000, // 1年
    path: '/'
  },
  
  // 会话Cookie
  SESSION: {
    secure: true,
    sameSite: 'strict' as const,
    httpOnly: false,
    // 不设置maxAge，使其成为会话Cookie
    path: '/'
  }
} as const;