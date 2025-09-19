/**
 * 安全配置中心
 * 集中管理所有安全相关的配置和常量
 */

export const SECURITY_CONFIG = {
  // CSRF 保护配置
  CSRF: {
    TOKEN_LENGTH: 32,
    TOKEN_LIFETIME: 3600000, // 1小时
    HEADER_NAME: 'X-CSRF-Token',
    COOKIE_NAME: 'csrf_token',
    AUTO_REFRESH: true,
    REFRESH_THRESHOLD: 300000, // 过期前5分钟刷新
  },

  // Rate Limiting 配置 (可通过环境变量覆盖)
  RATE_LIMIT: {
    WINDOW_SIZE: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW_SIZE) || 60000, // 1分钟窗口
    MAX_REQUESTS: parseInt(import.meta.env.VITE_RATE_LIMIT_MAX_REQUESTS) || 100,  // 每窗口最大请求数
    BLOCK_DURATION: parseInt(import.meta.env.VITE_RATE_LIMIT_BLOCK_DURATION) || 300000, // 阻塞5分钟
    CLEANUP_INTERVAL: parseInt(import.meta.env.VITE_RATE_LIMIT_CLEANUP_INTERVAL) || 300000, // 5分钟清理一次
    
    // 不同操作的限流配置
    LIMITS: {
      API_GENERAL: { 
        maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_API_GENERAL_MAX) || 1000, 
        windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_API_GENERAL_WINDOW) || 60000 
      },
      VIDEO_GENERATION: { 
        maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_VIDEO_GENERATION_MAX) || 100, 
        windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_VIDEO_GENERATION_WINDOW) || 3600000 
      },
      LOGIN_ATTEMPT: { 
        maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_LOGIN_ATTEMPT_MAX) || 20, 
        windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_LOGIN_ATTEMPT_WINDOW) || 900000 
      },
      PASSWORD_RESET: { 
        maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_PASSWORD_RESET_MAX) || 5, 
        windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_PASSWORD_RESET_WINDOW) || 3600000 
      },
      FILE_UPLOAD: { 
        maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_FILE_UPLOAD_MAX) || 100, 
        windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_FILE_UPLOAD_WINDOW) || 3600000 
      },
      LIKE_ACTION: { 
        maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_LIKE_ACTION_MAX) || 200, 
        windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_LIKE_ACTION_WINDOW) || 300000 
      },
      COMMENT_POST: { 
        maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_COMMENT_POST_MAX) || 50, 
        windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_COMMENT_POST_WINDOW) || 600000 
      },
    }
  },

  // Cookie 安全配置
  COOKIES: {
    SECURE: true,
    SAME_SITE: 'strict' as const,
    HTTP_ONLY: false, // 客户端需要访问
    MAX_AGE: 86400, // 24小时
    ENCRYPTION_ALGORITHM: 'AES-GCM',
    KEY_DERIVATION_ITERATIONS: 100000,
  },

  // 输入验证配置
  INPUT_VALIDATION: {
    MAX_STRING_LENGTH: 5000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    FORBIDDEN_PATTERNS: [
      /[<>]/g,           // XSS 字符
      /['";\\]/g,        // SQL 注入字符
      /--/g,             // SQL 注释
      /\/\*/g,           // SQL 块注释开始
      /\*\//g,           // SQL 块注释结束
      /script/gi,        // Script 标签
      /javascript:/gi,   // JavaScript URL
      /on\w+=/gi,        // 事件处理器
      /eval\(/gi,        // eval 函数
      /expression\(/gi,  // CSS expression
    ]
  },

  // 密码安全配置
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 100,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_DIGITS: true,
    REQUIRE_SPECIAL_CHARS: true,
    HASH_ROUNDS: 12,
    
    // 弱密码检测
    COMMON_PASSWORDS: [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ]
  },

  // 会话安全配置
  SESSION: {
    TIMEOUT: 1800000, // 30分钟无活动超时
    ABSOLUTE_TIMEOUT: 28800000, // 8小时绝对超时
    RENEWAL_THRESHOLD: 300000, // 5分钟前续期
    MAX_CONCURRENT_SESSIONS: 3, // 最多3个并发会话
  },

  // 网络安全配置
  NETWORK: {
    ALLOWED_ORIGINS: [
      'https://yourdomain.com',
      'https://api.yourdomain.com',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : [])
    ],
    
    BLOCKED_USER_AGENTS: [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i
    ],
    
    TRUSTED_PROXIES: [
      '127.0.0.1',
      '::1',
      // Cloudflare IP ranges
      '103.21.244.0/22',
      '103.22.200.0/22',
      '103.31.4.0/22',
      // Add more as needed
    ]
  },

  // Content Security Policy
  CSP: {
    DEFAULT_SRC: ["'self'"],
    SCRIPT_SRC: [
      "'self'",
      "'unsafe-inline'", // 需要时可移除
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://js.stripe.com'
    ],
    STYLE_SRC: [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com'
    ],
    FONT_SRC: [
      "'self'",
      'https://fonts.gstatic.com'
    ],
    IMG_SRC: [
      "'self'",
      'data:',
      'https:',
      'blob:'
    ],
    CONNECT_SRC: [
      "'self'",
      'https://*.supabase.co',
      'https://api.stripe.com',
      'https://www.google-analytics.com',
      'https://api.apicore.ai'
    ],
    MEDIA_SRC: [
      "'self'",
      'blob:',
      'data:',
      'https://*.supabase.co',
      'https://hvkzwrnvxsleeonqqrzq.supabase.co',
      'https://cdn.veo3video.me'
    ],
    FRAME_SRC: [
      "'self'",
      'https://js.stripe.com',
      'https://hooks.stripe.com'
    ],
    WORKER_SRC: [
      "'self'",
      'blob:'
    ],
    OBJECT_SRC: ["'none'"],
    BASE_URI: ["'self'"],
    FORM_ACTION: ["'self'"]
  },

  // 审计和日志配置
  AUDIT: {
    LOG_LEVELS: ['error', 'warn', 'info', 'debug'],
    LOG_RETENTION_DAYS: 90,
    LOG_SENSITIVE_DATA: false,
    
    // 需要审计的事件
    AUDIT_EVENTS: [
      'user_login',
      'user_logout',
      'password_change',
      'email_change',
      'profile_update',
      'payment_attempt',
      'video_generation',
      'file_upload',
      'admin_action',
      'security_violation'
    ]
  },

  // 威胁检测配置
  THREAT_DETECTION: {
    // 异常行为检测阈值
    MAX_FAILED_LOGINS: 5,
    MAX_REQUESTS_PER_MINUTE: 200,
    MAX_FILE_UPLOADS_PER_HOUR: 100,
    SUSPICIOUS_PATTERN_THRESHOLD: 3,
    
    // 自动封禁配置
    AUTO_BAN: {
      ENABLED: true,
      BAN_DURATION: 86400000, // 24小时
      ESCALATION_MULTIPLIER: 2, // 重复违规时间翻倍
      MAX_BAN_DURATION: 604800000, // 最长7天
    },
    
    // IP信誉检查
    IP_REPUTATION: {
      ENABLED: true,
      BLOCK_TOR: true,
      BLOCK_VPN: false, // 根据需要调整
      BLOCK_PROXIES: false,
    }
  },

  // 数据保护配置
  DATA_PROTECTION: {
    ENCRYPTION: {
      ALGORITHM: 'AES-256-GCM',
      KEY_ROTATION_INTERVAL: 2592000000, // 30天
      BACKUP_KEYS_COUNT: 3,
    },
    
    // 敏感字段
    SENSITIVE_FIELDS: [
      'password',
      'email',
      'phone',
      'address',
      'payment_info',
      'ssn',
      'credit_card'
    ],
    
    // 数据保留策略
    RETENTION_POLICY: {
      USER_DATA: 2555000000, // 3年
      AUDIT_LOGS: 7776000000, // 90天
      ANALYTICS_DATA: 31536000000, // 1年
    }
  },

  // 安全头配置
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }
} as const;

// 安全级别枚举
export enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 威胁类型枚举
export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  CSRF = 'csrf',
  DDOS = 'ddos',
  MALICIOUS_UPLOAD = 'malicious_upload',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
}

// 安全事件接口
export interface SecurityEvent {
  type: ThreatType;
  level: SecurityLevel;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
  blocked: boolean;
  action?: string;
}

// 获取环境特定的安全配置
export function getSecurityConfig(environment: 'development' | 'production' | 'test' = 'production') {
  // 创建深度可变副本
  const config = JSON.parse(JSON.stringify(SECURITY_CONFIG));
  
  if (environment === 'development') {
    // 开发环境下放松一些限制
    config.COOKIES.SECURE = false;
    config.SESSION.TIMEOUT = 3600000; // 1小时
    config.THREAT_DETECTION.AUTO_BAN.ENABLED = false;
    
    // 开发环境CSP更宽松
    config.CSP.MEDIA_SRC.push('http://localhost:*', 'http://127.0.0.1:*');
    config.CSP.CONNECT_SRC.push('ws://localhost:*', 'ws://127.0.0.1:*');
    config.CSP.SCRIPT_SRC.push('http://localhost:*', 'blob:');
    config.CSP.WORKER_SRC.push('http://localhost:*');
  } else if (environment === 'test') {
    // 测试环境配置
    config.RATE_LIMIT.MAX_REQUESTS = 10000;
    config.COOKIES.SECURE = false;
    config.AUDIT.LOG_LEVELS = ['error'];
  }
  
  return config;
}

// 验证配置完整性
export function validateSecurityConfig(): boolean {
  const requiredEnvVars = [
    'VITE_COOKIE_ENCRYPTION_KEY',
    'VITE_COOKIE_SIGNATURE_SECRET',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    return false;
  }
  
  return true;
}

// 生成Content Security Policy字符串
export function generateCSPString(): string {
  // 使用环境特定的配置
  const environment = process.env.NODE_ENV as 'development' | 'production' | 'test';
  const config = getSecurityConfig(environment);
  const csp = config.CSP;
  
  const policies = [
    `default-src ${csp.DEFAULT_SRC.join(' ')}`,
    `script-src ${csp.SCRIPT_SRC.join(' ')}`,
    `style-src ${csp.STYLE_SRC.join(' ')}`,
    `font-src ${csp.FONT_SRC.join(' ')}`,
    `img-src ${csp.IMG_SRC.join(' ')}`,
    `connect-src ${csp.CONNECT_SRC.join(' ')}`,
    `media-src ${csp.MEDIA_SRC.join(' ')}`,
    `frame-src ${csp.FRAME_SRC.join(' ')}`,
    `worker-src ${csp.WORKER_SRC.join(' ')}`,
    `object-src ${csp.OBJECT_SRC.join(' ')}`,
    `base-uri ${csp.BASE_URI.join(' ')}`,
    `form-action ${csp.FORM_ACTION.join(' ')}`
  ];
  
  return policies.join('; ');
}

export default SECURITY_CONFIG;