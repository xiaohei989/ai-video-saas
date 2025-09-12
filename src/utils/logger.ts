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

class Logger {
  private config: LoggerConfig;
  private readonly moduleName: string;

  constructor(moduleName: string = 'App') {
    this.moduleName = moduleName;
    this.config = this.getDefaultConfig();
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
   * 设置日志配置
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
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

// 兼容性：在全局提供logger
if (typeof window !== 'undefined') {
  (window as any).__APP_LOGGER__ = defaultLogger;
}