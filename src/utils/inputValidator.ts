/**
 * 输入验证和清理工具
 * 提供全面的输入安全检查和清理功能
 */

import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';
import { SECURITY_CONFIG, SecurityLevel, ThreatType } from '../config/security';

export interface ValidationResult {
  isValid: boolean;
  sanitized?: any;
  errors: string[];
  warnings: string[];
  threatLevel: SecurityLevel;
  threats: ThreatType[];
}

export interface ValidationOptions {
  sanitize: boolean;
  allowHtml: boolean;
  maxLength?: number;
  customPatterns?: RegExp[];
}

export class InputValidator {
  private static readonly MAX_LENGTH = SECURITY_CONFIG.INPUT_VALIDATION.MAX_STRING_LENGTH;

  /**
   * 验证和清理字符串输入
   */
  static validateString(
    input: string, 
    options: Partial<ValidationOptions> = {}
  ): ValidationResult {
    const opts: ValidationOptions = {
      sanitize: true,
      allowHtml: false,
      maxLength: this.MAX_LENGTH,
      ...options
    };

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      threatLevel: SecurityLevel.LOW,
      threats: []
    };

    // 基本类型检查
    if (typeof input !== 'string') {
      result.isValid = false;
      result.errors.push('Input must be a string');
      result.threatLevel = SecurityLevel.MEDIUM;
      return result;
    }

    // 长度检查
    if (opts.maxLength && input.length > opts.maxLength) {
      result.isValid = false;
      result.errors.push(`Input exceeds maximum length of ${opts.maxLength}`);
      result.threatLevel = SecurityLevel.MEDIUM;
      return result;
    }

    // 恶意模式检测
    const detectedThreats = this.detectThreats(input);
    if (detectedThreats.length > 0) {
      result.threats = detectedThreats;
      result.threatLevel = this.calculateThreatLevel(detectedThreats);
      
      if (result.threatLevel === SecurityLevel.CRITICAL || result.threatLevel === SecurityLevel.HIGH) {
        result.isValid = false;
        result.errors.push('Input contains potentially malicious content');
      } else {
        result.warnings.push('Input contains suspicious patterns');
      }
    }

    // 自定义模式检查
    if (opts.customPatterns) {
      for (const pattern of opts.customPatterns) {
        if (pattern.test(input)) {
          result.warnings.push(`Input matches custom forbidden pattern: ${pattern.source}`);
          result.threatLevel = SecurityLevel.MEDIUM;
        }
      }
    }

    // 清理输入
    if (opts.sanitize && result.isValid) {
      result.sanitized = this.sanitizeString(input, opts.allowHtml);
    }

    return result;
  }

  /**
   * 检测威胁类型
   */
  private static detectThreats(input: string): ThreatType[] {
    const threats: ThreatType[] = [];

    // SQL注入检测
    if (this.containsSQLInjection(input)) {
      threats.push(ThreatType.SQL_INJECTION);
    }

    // XSS检测
    if (this.containsXSS(input)) {
      threats.push(ThreatType.XSS);
    }

    // 可疑模式检测
    if (this.containsSuspiciousPatterns(input)) {
      threats.push(ThreatType.SUSPICIOUS_PATTERN);
    }

    return threats;
  }

  /**
   * SQL注入检测
   */
  private static containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+.+\s+set/i,
      /exec\s*\(/i,
      /execute\s*\(/i,
      /sp_executesql/i,
      /xp_cmdshell/i,
      /;\s*--/,
      /'\s*or\s+'1'\s*=\s*'1/i,
      /'\s*or\s+1\s*=\s*1/i,
      /'\s*and\s+'1'\s*=\s*'1/i,
      /'\s*;\s*drop\s+/i,
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * XSS检测
   */
  private static containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
      /<embed[\s\S]*?>/gi,
      /<link[\s\S]*?>/gi,
      /<meta[\s\S]*?>/gi,
      /javascript\s*:/gi,
      /vbscript\s*:/gi,
      /data\s*:[\s\S]*?base64/gi,
      /on\w+\s*=\s*["'][\s\S]*?["']/gi,
      /on\w+\s*=\s*[\w\s\(\)]+/gi,
      /<\s*\/?\s*\w+[\s\S]*?>/g // 通用HTML标签检测
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * 可疑模式检测
   */
  private static containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /\.\.\//g,                    // 路径遍历
      /\.\.\\/g,                    // Windows路径遍历
      /eval\s*\(/gi,                // eval函数
      /Function\s*\(/gi,            // Function构造器
      /setTimeout\s*\(/gi,          // setTimeout
      /setInterval\s*\(/gi,         // setInterval
      /document\s*\.\s*cookie/gi,   // Cookie访问
      /document\s*\.\s*write/gi,    // document.write
      /window\s*\.\s*location/gi,   // location对象
      /\${[\s\S]*?}/g,             // 模板字符串注入
      /<\?php/gi,                  // PHP标签
      /<\%[\s\S]*?\%>/g,           // ASP/JSP标签
      /\bfile\s*:\s*\/\//gi,       // file协议
      /\bftp\s*:\s*\/\//gi,        // FTP协议
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * 计算威胁级别
   */
  private static calculateThreatLevel(threats: ThreatType[]): SecurityLevel {
    if (threats.includes(ThreatType.SQL_INJECTION)) {
      return SecurityLevel.CRITICAL;
    }
    if (threats.includes(ThreatType.XSS)) {
      return SecurityLevel.HIGH;
    }
    if (threats.includes(ThreatType.SUSPICIOUS_PATTERN)) {
      return SecurityLevel.MEDIUM;
    }
    return SecurityLevel.LOW;
  }

  /**
   * 清理字符串
   */
  static sanitizeString(input: string, allowHtml = false): string {
    let sanitized = input;

    if (allowHtml) {
      // 使用DOMPurify清理HTML
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'a'],
        ALLOWED_ATTR: ['href', 'target'],
        ALLOW_DATA_ATTR: false
      });
    } else {
      // 移除所有HTML标签
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // 移除危险字符
    sanitized = sanitized
      .replace(/['";\\]/g, '')      // SQL注入字符
      .replace(/[<>]/g, '')         // XSS字符  
      .replace(/--/g, '')           // SQL注释
      .replace(/\/\*/g, '')         // 块注释开始
      .replace(/\*\//g, '')         // 块注释结束
      .replace(/\x00/g, '')         // NULL字符
      .trim();

    return sanitized;
  }

  /**
   * 验证邮箱地址
   */
  static validateEmail(email: string): ValidationResult {
    const emailSchema = z.string()
      .email('Invalid email format')
      .max(255, 'Email too long')
      .refine(email => !email.includes('<script'), 'Email contains forbidden content');

    try {
      const validated = emailSchema.parse(email.toLowerCase().trim());
      return {
        isValid: true,
        sanitized: validated,
        errors: [],
        warnings: [],
        threatLevel: SecurityLevel.LOW,
        threats: []
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.issues.map(e => e.message),
          warnings: [],
          threatLevel: SecurityLevel.MEDIUM,
          threats: [ThreatType.SUSPICIOUS_PATTERN]
        };
      }
      throw error;
    }
  }

  /**
   * 验证用户名
   */
  static validateUsername(username: string): ValidationResult {
    const usernameSchema = z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
      .refine(name => !this.isReservedUsername(name), 'Username is reserved');

    try {
      const validated = usernameSchema.parse(username.trim());
      return {
        isValid: true,
        sanitized: validated,
        errors: [],
        warnings: [],
        threatLevel: SecurityLevel.LOW,
        threats: []
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.issues.map(e => e.message),
          warnings: [],
          threatLevel: SecurityLevel.MEDIUM,
          threats: [ThreatType.SUSPICIOUS_PATTERN]
        };
      }
      throw error;
    }
  }

  /**
   * 验证密码强度
   */
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let threatLevel = SecurityLevel.LOW;
    const threats: ThreatType[] = [];

    // 长度检查
    if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
      errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters`);
    }
    if (password.length > SECURITY_CONFIG.PASSWORD.MAX_LENGTH) {
      errors.push(`Password must be at most ${SECURITY_CONFIG.PASSWORD.MAX_LENGTH} characters`);
    }

    // 复杂性检查
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_DIGITS && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one digit');
    }
    if (SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL_CHARS && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // 常见密码检查
    if (SECURITY_CONFIG.PASSWORD.COMMON_PASSWORDS.includes(password.toLowerCase() as any)) {
      errors.push('Password is too common, please choose a stronger password');
      threatLevel = SecurityLevel.MEDIUM;
    }

    // 重复字符检查
    if (/(.)\1{3,}/.test(password)) {
      warnings.push('Password contains repeated characters');
      threatLevel = SecurityLevel.LOW;
    }

    // 连续字符检查
    if (this.hasSequentialChars(password)) {
      warnings.push('Password contains sequential characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      threatLevel,
      threats
    };
  }

  /**
   * 验证URL
   */
  static validateURL(url: string): ValidationResult {
    try {
      const urlObj = new URL(url);
      
      // 只允许HTTP和HTTPS协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          isValid: false,
          errors: ['Only HTTP and HTTPS URLs are allowed'],
          warnings: [],
          threatLevel: SecurityLevel.HIGH,
          threats: [ThreatType.SUSPICIOUS_PATTERN]
        };
      }

      // 检查是否是本地地址（可能的SSRF攻击）
      const hostname = urlObj.hostname.toLowerCase();
      if (this.isLocalAddress(hostname)) {
        return {
          isValid: false,
          errors: ['Local addresses are not allowed'],
          warnings: [],
          threatLevel: SecurityLevel.HIGH,
          threats: [ThreatType.SUSPICIOUS_PATTERN]
        };
      }

      return {
        isValid: true,
        sanitized: urlObj.toString(),
        errors: [],
        warnings: [],
        threatLevel: SecurityLevel.LOW,
        threats: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid URL format'],
        warnings: [],
        threatLevel: SecurityLevel.MEDIUM,
        threats: [ThreatType.SUSPICIOUS_PATTERN]
      };
    }
  }

  /**
   * 文件验证
   */
  static async validateFile(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let threatLevel = SecurityLevel.LOW;
    const threats: ThreatType[] = [];

    // 文件大小检查
    if (file.size > SECURITY_CONFIG.INPUT_VALIDATION.MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum limit of ${SECURITY_CONFIG.INPUT_VALIDATION.MAX_FILE_SIZE} bytes`);
      threatLevel = SecurityLevel.MEDIUM;
    }

    // 文件类型检查
    if (!SECURITY_CONFIG.INPUT_VALIDATION.ALLOWED_FILE_TYPES.includes(file.type as any)) {
      errors.push('File type not allowed');
      threats.push(ThreatType.MALICIOUS_UPLOAD);
      threatLevel = SecurityLevel.HIGH;
    }

    // 文件名检查
    const fileNameValidation = this.validateString(file.name, { maxLength: 255 });
    if (!fileNameValidation.isValid) {
      errors.push(...fileNameValidation.errors);
      threats.push(...fileNameValidation.threats);
      threatLevel = fileNameValidation.threatLevel;
    }

    // 魔术数字检查
    try {
      const buffer = await file.arrayBuffer();
      if (!this.validateFileSignature(new Uint8Array(buffer), file.type)) {
        errors.push('File content does not match declared type');
        threats.push(ThreatType.MALICIOUS_UPLOAD);
        threatLevel = SecurityLevel.HIGH;
      }
    } catch (error) {
      errors.push('Failed to validate file content');
      threatLevel = SecurityLevel.MEDIUM;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      threatLevel,
      threats
    };
  }

  /**
   * 检查是否是保留用户名
   */
  private static isReservedUsername(username: string): boolean {
    const reserved = [
      'admin', 'administrator', 'root', 'system', 'user', 'guest',
      'api', 'www', 'mail', 'email', 'support', 'help', 'info',
      'news', 'blog', 'forum', 'shop', 'store', 'test', 'demo',
      'null', 'undefined', 'true', 'false'
    ];
    return reserved.includes(username.toLowerCase());
  }

  /**
   * 检查密码中是否有连续字符
   */
  private static hasSequentialChars(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm'
    ];

    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - 4; i++) {
        const subseq = seq.substring(i, i + 4);
        if (password.toLowerCase().includes(subseq)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查是否是本地地址
   */
  private static isLocalAddress(hostname: string): boolean {
    const localPatterns = [
      /^localhost$/i,
      /^127\./,
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^::1$/,
      /^fe80:/i,
      /^fc00:/i,
      /^fd00:/i
    ];

    return localPatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * 验证文件签名（魔术数字）
   */
  private static validateFileSignature(bytes: Uint8Array, mimeType: string): boolean {
    const signatures: Record<string, number[][]> = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47]],
      'image/gif': [[0x47, 0x49, 0x46, 0x38]],
      'image/webp': [[0x52, 0x49, 0x46, 0x46]]
    };

    const expectedSignatures = signatures[mimeType];
    if (!expectedSignatures) {
      return false;
    }

    return expectedSignatures.some(signature =>
      signature.every((byte, index) => bytes[index] === byte)
    );
  }
}

// Zod schemas for common validations
export const validationSchemas = {
  username: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/),
    
  email: z.string()
    .email()
    .max(255)
    .transform(val => val.toLowerCase().trim()),
    
  password: z.string()
    .min(8)
    .max(100),
    
  url: z.string()
    .url()
    .refine(url => {
      try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
      } catch {
        return false;
      }
    }),
    
  safeString: z.string()
    .max(5000)
    .transform(val => InputValidator.sanitizeString(val))
};

export default InputValidator;