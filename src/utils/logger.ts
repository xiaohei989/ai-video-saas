/**
 * 统一日志管理系统
 * 支持分级日志和环境区分
 */

// 日志级别定义
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// 日志级别映射
const LOG_LEVEL_NAMES = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE'
};

// 日志级别颜色
const LOG_LEVEL_COLORS = {
  [LogLevel.ERROR]: '#ff4757', // 红色
  [LogLevel.WARN]: '#ffa502',  // 橙色
  [LogLevel.INFO]: '#1e90ff',  // 蓝色
  [LogLevel.DEBUG]: '#2ed573', // 绿色
  [LogLevel.TRACE]: '#a4b0be'  // 灰色
};

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  enableTimestamp: boolean;
  enableColors: boolean;
  enablePrefix: boolean;
}

export interface DebugSettings {
  enabled: boolean;
  level: LogLevel;
  timestamp: number;
  source: 'url' | 'localStorage' | 'default';
}

class Logger {
  private config: LoggerConfig;
  private readonly moduleName: string;
  private debugSettings: DebugSettings | null = null;

  // Debug相关常量
  private static readonly DEBUG_STORAGE_KEY = 'app_debug_settings';
  private static readonly DEBUG_EXPIRE_HOURS = 24;
  private static readonly URL_PARAM_NAME = 'debug';

  constructor(moduleName: string = 'App') {
    this.moduleName = moduleName;
    this.config = this.getDefaultConfig();
    
    // 检查并应用调试设置
    this.checkAndApplyDebugSettings();
  }

  private getDefaultConfig(): LoggerConfig {
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.VITE_APP_ENV === 'development' ||
                         import.meta.env.NODE_ENV === 'development';
    
    const isProduction = import.meta.env.VITE_APP_ENV === 'production' ||
                        import.meta.env.NODE_ENV === 'production' ||
                        import.meta.env.CF_PAGES === '1';

    // 开发环境：显示所有日志
    if (isDevelopment) {
      return {
        level: LogLevel.TRACE,
        enableConsole: true,
        enableRemoteLogging: false,
        enableTimestamp: true,
        enableColors: true,
        enablePrefix: true
      };
    }

    // 生产环境：只显示重要日志
    if (isProduction) {
      return {
        level: LogLevel.WARN,
        enableConsole: true,
        enableRemoteLogging: true,
        remoteEndpoint: '/api/logs',
        enableTimestamp: true,
        enableColors: false,
        enablePrefix: true
      };
    }

    // 默认配置（测试环境等）
    return {
      level: LogLevel.INFO,
      enableConsole: true,
      enableRemoteLogging: false,
      enableTimestamp: true,
      enableColors: true,
      enablePrefix: true
    };
  }

  /**
   * 检查并应用调试设置
   */
  private checkAndApplyDebugSettings(): void {
    // 1. 首先检查URL参数
    const urlDebugLevel = this.getURLDebugParam();
    if (urlDebugLevel !== null) {
      this.applyDebugSettings(urlDebugLevel, 'url');
      return;
    }

    // 2. 检查localStorage中的设置
    const storedSettings = this.getStoredDebugSettings();
    if (storedSettings && !this.isDebugExpired(storedSettings)) {
      this.applyDebugSettings(storedSettings.level, 'localStorage');
      return;
    }

    // 3. 清理过期设置
    if (storedSettings && this.isDebugExpired(storedSettings)) {
      this.clearDebugSettings();
    }
  }

  /**
   * 获取URL中的debug参数
   */
  private getURLDebugParam(): LogLevel | null {
    if (typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get(Logger.URL_PARAM_NAME);
    
    if (!debugParam) return null;

    // 参数映射
    const paramToLevel: Record<string, LogLevel> = {
      'true': LogLevel.DEBUG,
      'debug': LogLevel.DEBUG,
      'trace': LogLevel.TRACE,
      'info': LogLevel.INFO,
      'warn': LogLevel.WARN,
      'error': LogLevel.ERROR,
      'false': LogLevel.WARN, // 恢复生产默认
      'off': LogLevel.WARN
    };

    return paramToLevel[debugParam.toLowerCase()] || null;
  }

  /**
   * 获取存储的调试设置
   */
  private getStoredDebugSettings(): DebugSettings | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(Logger.DEBUG_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * 检查调试设置是否过期
   */
  private isDebugExpired(settings: DebugSettings): boolean {
    const now = Date.now();
    const expireTime = settings.timestamp + (Logger.DEBUG_EXPIRE_HOURS * 60 * 60 * 1000);
    return now > expireTime;
  }

  /**
   * 应用调试设置
   */
  private applyDebugSettings(level: LogLevel, source: DebugSettings['source']): void {
    this.debugSettings = {
      enabled: true,
      level,
      timestamp: Date.now(),
      source
    };

    // 更新日志配置
    this.config.level = level;

    // 保存到localStorage（除非是关闭调试）
    if (level !== LogLevel.WARN || source === 'url') {
      this.saveDebugSettings();
    }

    // 显示调试提示
    if (level < LogLevel.WARN) {
      this.showDebugNotice();
    }
  }

  /**
   * 保存调试设置到localStorage
   */
  private saveDebugSettings(): void {
    if (typeof window === 'undefined' || !this.debugSettings) return;

    try {
      localStorage.setItem(Logger.DEBUG_STORAGE_KEY, JSON.stringify(this.debugSettings));
    } catch (error) {
      console.warn('[Logger] 无法保存调试设置到localStorage:', error);
    }
  }

  /**
   * 清理调试设置
   */
  private clearDebugSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(Logger.DEBUG_STORAGE_KEY);
      this.debugSettings = null;
    } catch (error) {
      console.warn('[Logger] 无法清理调试设置:', error);
    }
  }

  /**
   * 显示调试提示
   */
  private showDebugNotice(): void {
    if (typeof window === 'undefined' || !this.debugSettings) return;

    const level = LOG_LEVEL_NAMES[this.debugSettings.level];
    const source = this.debugSettings.source;
    const expireHours = Logger.DEBUG_EXPIRE_HOURS;

    console.warn(
      `%c🚨 DEBUG MODE ENABLED 🚨`,
      'background: #ff4757; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 14px;'
    );
    
    console.warn(
      `%c调试模式已开启 (级别: ${level}, 来源: ${source})\n` +
      `将显示详细日志信息，${expireHours}小时后自动关闭\n` +
      `如需立即关闭，请访问: ${window.location.origin}${window.location.pathname}?debug=false`,
      'color: #ff6b7a; font-size: 12px; line-height: 1.5;'
    );
  }

  /**
   * 设置日志配置
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 动态设置调试级别
   */
  setDebugLevel(level: LogLevel | string): void {
    let targetLevel: LogLevel;
    
    if (typeof level === 'string') {
      const levelMap: Record<string, LogLevel> = {
        'ERROR': LogLevel.ERROR,
        'WARN': LogLevel.WARN,
        'INFO': LogLevel.INFO,
        'DEBUG': LogLevel.DEBUG,
        'TRACE': LogLevel.TRACE
      };
      targetLevel = levelMap[level.toUpperCase()] || LogLevel.WARN;
    } else {
      targetLevel = level;
    }

    this.applyDebugSettings(targetLevel, 'default');
  }

  /**
   * 启用调试模式
   */
  enableDebug(): void {
    this.setDebugLevel(LogLevel.DEBUG);
  }

  /**
   * 禁用调试模式
   */
  disableDebug(): void {
    this.setDebugLevel(LogLevel.WARN);
    this.clearDebugSettings();
  }

  /**
   * 获取调试状态
   */
  getDebugInfo(): DebugSettings | null {
    return this.debugSettings;
  }

  /**
   * 获取当前配置
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * 检查是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    let formattedMessage = '';

    // 添加时间戳
    if (this.config.enableTimestamp) {
      const timestamp = new Date().toISOString();
      formattedMessage += `[${timestamp}] `;
    }

    // 添加级别标识
    formattedMessage += `[${LOG_LEVEL_NAMES[level]}] `;

    // 添加模块前缀
    if (this.config.enablePrefix && this.moduleName) {
      formattedMessage += `[${this.moduleName}] `;
    }

    // 添加消息内容
    formattedMessage += message;

    // 添加数据对象
    if (data !== undefined) {
      if (typeof data === 'object') {
        formattedMessage += ` ${JSON.stringify(data, null, 2)}`;
      } else {
        formattedMessage += ` ${data}`;
      }
    }

    return formattedMessage;
  }

  /**
   * 控制台输出
   */
  private logToConsole(level: LogLevel, message: string, data?: any): void {
    if (!this.config.enableConsole) return;

    const formattedMessage = this.formatMessage(level, message, data);

    // 根据级别选择控制台方法
    switch (level) {
      case LogLevel.ERROR:
        if (this.config.enableColors) {
          console.error(`%c${formattedMessage}`, `color: ${LOG_LEVEL_COLORS[level]}`);
        } else {
          console.error(formattedMessage);
        }
        break;
      case LogLevel.WARN:
        if (this.config.enableColors) {
          console.warn(`%c${formattedMessage}`, `color: ${LOG_LEVEL_COLORS[level]}`);
        } else {
          console.warn(formattedMessage);
        }
        break;
      case LogLevel.INFO:
        if (this.config.enableColors) {
          console.info(`%c${formattedMessage}`, `color: ${LOG_LEVEL_COLORS[level]}`);
        } else {
          console.info(formattedMessage);
        }
        break;
      case LogLevel.DEBUG:
        if (this.config.enableColors) {
          console.debug(`%c${formattedMessage}`, `color: ${LOG_LEVEL_COLORS[level]}`);
        } else {
          console.debug(formattedMessage);
        }
        break;
      case LogLevel.TRACE:
        if (this.config.enableColors) {
          console.log(`%c${formattedMessage}`, `color: ${LOG_LEVEL_COLORS[level]}`);
        } else {
          console.log(formattedMessage);
        }
        break;
    }
  }

  /**
   * 远程日志上报（生产环境）
   */
  private async logToRemote(level: LogLevel, message: string, data?: any): Promise<void> {
    if (!this.config.enableRemoteLogging || !this.config.remoteEndpoint) return;

    try {
      const logData = {
        timestamp: new Date().toISOString(),
        level: LOG_LEVEL_NAMES[level],
        module: this.moduleName,
        message,
        data,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // 异步发送，不阻塞主流程
      fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData)
      }).catch(error => {
        // 远程日志失败时降级到控制台
        console.warn('[Logger] Failed to send remote log:', error);
      });
    } catch (error) {
      // 忽略远程日志错误，避免影响主功能
    }
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    // 控制台输出
    this.logToConsole(level, message, data);

    // 远程上报（异步）
    if (level <= LogLevel.WARN) {
      this.logToRemote(level, message, data);
    }
  }

  /**
   * 错误日志 - 生产和开发环境都显示
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * 警告日志 - 生产和开发环境都显示
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * 信息日志 - 开发环境显示，生产环境不显示
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * 调试日志 - 仅开发环境显示
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * 跟踪日志 - 仅开发环境显示
   */
  trace(message: string, data?: any): void {
    this.log(LogLevel.TRACE, message, data);
  }

  /**
   * 创建子模块Logger
   */
  child(moduleName: string): Logger {
    const childLogger = new Logger(`${this.moduleName}:${moduleName}`);
    childLogger.setConfig(this.config);
    return childLogger;
  }
}

// 创建默认Logger实例
const defaultLogger = new Logger('App');

// 导出Logger类和默认实例
export { Logger, defaultLogger as logger };

// 导出便捷方法
export const log = {
  error: (message: string, data?: any) => defaultLogger.error(message, data),
  warn: (message: string, data?: any) => defaultLogger.warn(message, data),
  info: (message: string, data?: any) => defaultLogger.info(message, data),
  debug: (message: string, data?: any) => defaultLogger.debug(message, data),
  trace: (message: string, data?: any) => defaultLogger.trace(message, data),
  child: (moduleName: string) => defaultLogger.child(moduleName)
};

// 全局console重定向：将原生console调用重定向到Logger
if (typeof window !== 'undefined') {
  // 保存原生console方法
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    trace: console.trace.bind(console),
    group: console.group.bind(console),
    groupEnd: console.groupEnd.bind(console),
    groupCollapsed: console.groupCollapsed.bind(console)
  };

  // 创建智能console代理
  const createLogProxy = (level: LogLevel, originalMethod: Function) => {
    return (...args: any[]) => {
      // 检查当前日志级别是否应该输出
      if (level <= defaultLogger.getConfig().level) {
        originalMethod(...args);
      }
    };
  };

  // 重定向console方法到Logger控制
  console.log = createLogProxy(LogLevel.DEBUG, originalConsole.log);
  console.info = createLogProxy(LogLevel.INFO, originalConsole.info);
  console.warn = createLogProxy(LogLevel.WARN, originalConsole.warn);
  console.error = createLogProxy(LogLevel.ERROR, originalConsole.error);
  console.debug = createLogProxy(LogLevel.DEBUG, originalConsole.debug);
  console.trace = createLogProxy(LogLevel.TRACE, originalConsole.trace);
  
  // 保持group方法不变，因为它们用于结构化输出
  // 但仍然受Logger级别控制
  console.group = (...args: any[]) => {
    if (LogLevel.INFO <= defaultLogger.getConfig().level) {
      originalConsole.group(...args);
    }
  };
  
  console.groupEnd = (...args: any[]) => {
    if (LogLevel.INFO <= defaultLogger.getConfig().level) {
      originalConsole.groupEnd(...args);
    }
  };
  
  console.groupCollapsed = (...args: any[]) => {
    if (LogLevel.INFO <= defaultLogger.getConfig().level) {
      originalConsole.groupCollapsed(...args);
    }
  };

  // 全局Logger API
  const globalLogger = {
    // 原有方法
    error: (message: string, data?: any) => defaultLogger.error(message, data),
    warn: (message: string, data?: any) => defaultLogger.warn(message, data),
    info: (message: string, data?: any) => defaultLogger.info(message, data),
    debug: (message: string, data?: any) => defaultLogger.debug(message, data),
    trace: (message: string, data?: any) => defaultLogger.trace(message, data),
    child: (moduleName: string) => defaultLogger.child(moduleName),
    
    // 新增调试控制方法
    setDebugLevel: (level: LogLevel | string) => defaultLogger.setDebugLevel(level),
    enableDebug: () => defaultLogger.enableDebug(),
    disableDebug: () => defaultLogger.disableDebug(),
    getDebugInfo: () => defaultLogger.getDebugInfo(),
    getConfig: () => defaultLogger.getConfig(),
    
    // 恢复原生console的方法（用于调试Logger本身）
    originalConsole,
    
    // 诊断方法
    diagnose: () => {
      const config = defaultLogger.getConfig();
      const debugInfo = defaultLogger.getDebugInfo();
      const envInfo = {
        isDev: import.meta.env.DEV,
        nodeEnv: import.meta.env.NODE_ENV,
        viteAppEnv: import.meta.env.VITE_APP_ENV,
        cfPages: import.meta.env.CF_PAGES
      };
      
      // 使用原生console确保诊断信息一定能显示
      originalConsole.group('%c📊 Logger Diagnostics', 'color: #1e90ff; font-weight: bold;');
      originalConsole.log('Current Config:', config);
      originalConsole.log('Debug Settings:', debugInfo);
      originalConsole.log('Environment:', envInfo);
      originalConsole.log('URL:', window.location.href);
      originalConsole.log('Console Redirection:', 'Active');
      originalConsole.groupEnd();
      
      return { config, debugInfo, envInfo };
    }
  };
  
  (window as any).__APP_LOGGER__ = globalLogger;
  
  // 立即显示console重定向生效的提示（仅开发环境）
  if (import.meta.env.DEV) {
    setTimeout(() => {
      originalConsole.log(
        '%c🔀 Console重定向已启用', 
        'background: #4CAF50; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;'
      );
      originalConsole.log(
        '%c所有console.log/info/debug调用现在受Logger级别控制', 
        'color: #4CAF50; font-size: 12px;'
      );
    }, 100);
  }
}