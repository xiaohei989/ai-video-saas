/**
 * 安全事件监控服务
 * 负责检测、记录和响应安全威胁
 */

import { 
  SecurityEvent, 
  SecurityLevel, 
  ThreatType, 
  SECURITY_CONFIG 
} from '../config/security';
// 避免循环依赖，延迟导入 Supabase
// import { supabase } from '../lib/supabase';

export interface AlertConfig {
  email?: string;
  webhook?: string;
  slack?: string;
  minimumLevel: SecurityLevel;
  enabled: boolean;
}

export interface MonitoringStats {
  totalEvents: number;
  eventsByType: Record<ThreatType, number>;
  eventsByLevel: Record<SecurityLevel, number>;
  recentEvents: SecurityEvent[];
  topThreats: Array<{ type: ThreatType; count: number }>;
  suspiciousIPs: Array<{ ip: string; eventCount: number; lastSeen: Date }>;
}

export class SecurityMonitorService {
  private supabase: any;
  private eventBuffer: SecurityEvent[] = [];
  private alertConfig: AlertConfig;
  private isEnabled: boolean = true;

  constructor(alertConfig: Partial<AlertConfig> = {}) {
    this.alertConfig = {
      minimumLevel: SecurityLevel.MEDIUM,
      enabled: !import.meta.env.DEV, // 开发环境下禁用
      ...alertConfig
    };

    // 开发环境下跳过初始化，避免网络错误
    if (import.meta.env.DEV) {
      console.log('[SecurityMonitor] 开发环境，跳过安全监控初始化');
      return;
    }

    // 延迟初始化Supabase客户端，避免循环依赖
    this.initializeSupabase();

    // 启动定期处理
    this.startPeriodicProcessing();
    
    // 监听页面卸载事件，确保缓存的事件被发送
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushEventBuffer();
      });
    }
  }

  /**
   * 延迟初始化Supabase客户端
   */
  private async initializeSupabase(): Promise<void> {
    try {
      // 动态导入避免循环依赖
      const { supabase } = await import('../lib/supabase');
      this.supabase = supabase;
      
      if (!this.supabase) {
        console.warn('[SecurityMonitor] Supabase客户端未初始化，禁用安全监控');
        this.isEnabled = false;
        return;
      }
    } catch (error) {
      console.warn('[SecurityMonitor] 初始化失败，禁用安全监控:', error);
      this.isEnabled = false;
      return;
    }
  }

  /**
   * 记录安全事件
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    if (!this.isEnabled) return;

    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    // 添加到缓冲区
    this.eventBuffer.push(fullEvent);

    // 立即处理高危事件
    if (this.isCriticalEvent(fullEvent)) {
      await this.processImmediately(fullEvent);
    }

    // 记录到控制台（开发环境）
    if (import.meta.env.NODE_ENV === 'development') {
      console.warn('Security Event:', fullEvent);
    }
  }

  /**
   * 检测可疑活动
   */
  detectSuspiciousActivity(
    action: string, 
    context: Record<string, any> = {}
  ): boolean {
    const patterns = this.getSuspiciousPatterns(action, context);
    
    if (patterns.length > 0) {
      this.logSecurityEvent({
        type: ThreatType.SUSPICIOUS_PATTERN,
        level: SecurityLevel.MEDIUM,
        userId: context.userId,
        ipAddress: context.ipAddress || this.getClientIP(),
        userAgent: context.userAgent || navigator.userAgent,
        details: {
          action,
          patterns,
          context
        },
        blocked: false,
        action: 'monitor'
      });
      
      return true;
    }

    return false;
  }

  /**
   * 记录登录尝试
   */
  async logLoginAttempt(
    userId: string | null,
    success: boolean,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logSecurityEvent({
      type: success ? ThreatType.SUSPICIOUS_PATTERN : ThreatType.BRUTE_FORCE,
      level: success ? SecurityLevel.LOW : SecurityLevel.MEDIUM,
      userId,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      details: {
        success,
        ...details
      },
      blocked: false,
      action: success ? 'login_success' : 'login_failure'
    });
  }

  /**
   * 记录文件上传事件
   */
  async logFileUpload(
    userId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    success: boolean,
    blocked: boolean = false
  ): Promise<void> {
    await this.logSecurityEvent({
      type: blocked ? ThreatType.MALICIOUS_UPLOAD : ThreatType.SUSPICIOUS_PATTERN,
      level: blocked ? SecurityLevel.HIGH : SecurityLevel.LOW,
      userId,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      details: {
        fileName,
        fileSize,
        mimeType,
        success
      },
      blocked,
      action: 'file_upload'
    });
  }

  /**
   * 记录API调用异常
   */
  async logAPIAnomaly(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    details: Record<string, any> = {}
  ): Promise<void> {
    const level = this.calculateAPIAnomalyLevel(statusCode, responseTime);
    
    await this.logSecurityEvent({
      type: ThreatType.SUSPICIOUS_PATTERN,
      level,
      userId: details.userId,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      details: {
        endpoint,
        method,
        statusCode,
        responseTime,
        ...details
      },
      blocked: false,
      action: 'api_anomaly'
    });
  }

  /**
   * 获取监控统计
   */
  async getMonitoringStats(
    startDate: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: Date = new Date()
  ): Promise<MonitoringStats> {
    if (!this.supabase) {
      return this.getEmptyStats();
    }

    try {
      const { data: events, error } = await this.supabase
        .from('security_events')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Failed to fetch security events:', error);
        return this.getEmptyStats();
      }

      return this.calculateStats(events || []);
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * 获取可疑IP列表
   */
  async getSuspiciousIPs(limit: number = 50): Promise<Array<{
    ip: string;
    eventCount: number;
    threatTypes: ThreatType[];
    lastSeen: Date;
    blocked: boolean;
  }>> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase.rpc('get_suspicious_ips', {
        p_limit: limit
      });

      if (error) {
        console.error('Failed to fetch suspicious IPs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting suspicious IPs:', error);
      return [];
    }
  }

  /**
   * 阻止IP地址
   */
  async blockIP(
    ipAddress: string, 
    reason: string, 
    duration?: number
  ): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('ip_blacklist')
        .insert({
          ip_address: ipAddress,
          reason,
          blocked_until: duration 
            ? new Date(Date.now() + duration).toISOString()
            : null,
          is_permanent: !duration
        });

      if (error) {
        console.error('Failed to block IP:', error);
        return false;
      }

      // 记录阻断事件
      await this.logSecurityEvent({
        type: ThreatType.SUSPICIOUS_PATTERN,
        level: SecurityLevel.HIGH,
        ipAddress,
        details: { reason, duration },
        blocked: true,
        action: 'ip_blocked'
      });

      return true;
    } catch (error) {
      console.error('Error blocking IP:', error);
      return false;
    }
  }

  /**
   * 检查IP是否被阻止
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase.rpc('is_ip_blocked', {
        p_ip_address: ipAddress
      });

      return !error && data === true;
    } catch (error) {
      console.error('Error checking IP block status:', error);
      return false;
    }
  }

  /**
   * 启用/禁用监控
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      // 禁用时清空缓冲区
      this.eventBuffer = [];
    }
  }

  /**
   * 更新告警配置
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  /**
   * 手动刷新事件缓冲区
   */
  async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    await this.sendEventsToDatabase(events);
  }

  /**
   * 获取客户端IP地址
   */
  private getClientIP(): string {
    // 在实际应用中，这个信息通常来自服务器
    return 'client';
  }

  /**
   * 检查是否是关键事件
   */
  private isCriticalEvent(event: SecurityEvent): boolean {
    return event.level === SecurityLevel.CRITICAL || 
           event.level === SecurityLevel.HIGH ||
           event.blocked;
  }

  /**
   * 立即处理关键事件
   */
  private async processImmediately(event: SecurityEvent): Promise<void> {
    // 发送到数据库
    await this.sendEventsToDatabase([event]);
    
    // 发送告警
    if (this.alertConfig.enabled && 
        this.shouldAlert(event.level)) {
      await this.sendAlert(event);
    }
    
    // 自动响应
    await this.autoRespond(event);
  }

  /**
   * 发送事件到数据库
   */
  private async sendEventsToDatabase(events: SecurityEvent[]): Promise<void> {
    if (!this.supabase || events.length === 0) return;

    try {
      const dbEvents = events.map(event => ({
        type: event.type,
        level: event.level,
        user_id: event.userId || null,
        ip_address: event.ipAddress || null,
        user_agent: event.userAgent || null,
        details: event.details,
        blocked: event.blocked,
        action: event.action || null,
        timestamp: event.timestamp.toISOString()
      }));

      const { error } = await this.supabase
        .from('security_events')
        .insert(dbEvents);

      if (error) {
        console.error('Failed to insert security events:', error);
      }
    } catch (error) {
      console.error('Error sending events to database:', error);
    }
  }

  /**
   * 发送告警
   */
  private async sendAlert(event: SecurityEvent): Promise<void> {
    const alertMessage = this.formatAlertMessage(event);
    
    // Email 告警
    if (this.alertConfig.email) {
      await this.sendEmailAlert(this.alertConfig.email, alertMessage);
    }
    
    // Webhook 告警
    if (this.alertConfig.webhook) {
      await this.sendWebhookAlert(this.alertConfig.webhook, event);
    }
    
    // Slack 告警
    if (this.alertConfig.slack) {
      await this.sendSlackAlert(this.alertConfig.slack, alertMessage);
    }
  }

  /**
   * 格式化告警消息
   */
  private formatAlertMessage(event: SecurityEvent): string {
    return `
🚨 Security Alert - ${event.level.toUpperCase()}

Type: ${event.type}
Time: ${event.timestamp.toISOString()}
User: ${event.userId || 'Unknown'}
IP: ${event.ipAddress || 'Unknown'}
Action: ${event.action || 'N/A'}
Blocked: ${event.blocked ? 'Yes' : 'No'}

Details: ${JSON.stringify(event.details, null, 2)}
    `.trim();
  }

  /**
   * 发送邮件告警
   */
  private async sendEmailAlert(email: string, message: string): Promise<void> {
    // 实际实现需要集成邮件服务
    console.log(`Email alert to ${email}: ${message}`);
  }

  /**
   * 发送Webhook告警
   */
  private async sendWebhookAlert(webhook: string, event: SecurityEvent): Promise<void> {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * 发送Slack告警
   */
  private async sendSlackAlert(webhook: string, message: string): Promise<void> {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message
        })
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * 自动响应威胁
   */
  private async autoRespond(event: SecurityEvent): Promise<void> {
    // 自动阻断恶意IP
    if (event.type === ThreatType.BRUTE_FORCE && 
        event.ipAddress && 
        !event.blocked) {
      await this.blockIP(
        event.ipAddress, 
        'Auto-blocked for brute force attack',
        24 * 60 * 60 * 1000 // 24小时
      );
    }

    // 其他自动响应逻辑...
  }

  /**
   * 判断是否应该发送告警
   */
  private shouldAlert(level: SecurityLevel): boolean {
    const levelPriority = {
      [SecurityLevel.LOW]: 1,
      [SecurityLevel.MEDIUM]: 2,
      [SecurityLevel.HIGH]: 3,
      [SecurityLevel.CRITICAL]: 4
    };

    return levelPriority[level] >= levelPriority[this.alertConfig.minimumLevel];
  }

  /**
   * 获取可疑模式
   */
  private getSuspiciousPatterns(action: string, context: any): string[] {
    const patterns: string[] = [];

    // 检查频繁操作
    if (context.frequency && context.frequency > 100) {
      patterns.push('high_frequency_requests');
    }

    // 检查异常时间
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      patterns.push('unusual_time');
    }

    // 检查地理位置变化
    if (context.locationChange) {
      patterns.push('geographic_anomaly');
    }

    return patterns;
  }

  /**
   * 计算API异常级别
   */
  private calculateAPIAnomalyLevel(statusCode: number, responseTime: number): SecurityLevel {
    if (statusCode >= 500 || responseTime > 10000) {
      return SecurityLevel.HIGH;
    }
    if (statusCode >= 400 || responseTime > 5000) {
      return SecurityLevel.MEDIUM;
    }
    return SecurityLevel.LOW;
  }

  /**
   * 计算统计信息
   */
  private calculateStats(events: any[]): MonitoringStats {
    const stats: MonitoringStats = {
      totalEvents: events.length,
      eventsByType: {} as Record<ThreatType, number>,
      eventsByLevel: {} as Record<SecurityLevel, number>,
      recentEvents: events.slice(0, 50).map(this.mapDbEventToSecurityEvent),
      topThreats: [],
      suspiciousIPs: []
    };

    // 初始化计数器
    Object.values(ThreatType).forEach(type => {
      stats.eventsByType[type] = 0;
    });
    Object.values(SecurityLevel).forEach(level => {
      stats.eventsByLevel[level] = 0;
    });

    // 统计事件
    events.forEach(event => {
      if (event.event_type) {
        stats.eventsByType[event.event_type as ThreatType]++;
      }
      if (event.severity) {
        stats.eventsByLevel[event.severity as SecurityLevel]++;
      }
    });

    // 计算顶级威胁
    stats.topThreats = Object.entries(stats.eventsByType)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type: type as ThreatType, count }));

    return stats;
  }

  /**
   * 映射数据库事件到SecurityEvent
   */
  private mapDbEventToSecurityEvent(dbEvent: any): SecurityEvent {
    return {
      type: dbEvent.event_type,
      level: dbEvent.severity,
      userId: dbEvent.user_id,
      ipAddress: dbEvent.ip_address,
      userAgent: dbEvent.user_agent,
      details: dbEvent.details || {},
      timestamp: new Date(dbEvent.timestamp),
      blocked: dbEvent.blocked || false,
      action: dbEvent.action
    };
  }

  /**
   * 获取空统计数据
   */
  private getEmptyStats(): MonitoringStats {
    return {
      totalEvents: 0,
      eventsByType: {} as Record<ThreatType, number>,
      eventsByLevel: {} as Record<SecurityLevel, number>,
      recentEvents: [],
      topThreats: [],
      suspiciousIPs: []
    };
  }

  /**
   * 启动定期处理
   */
  private startPeriodicProcessing(): void {
    // 每30秒刷新缓冲区
    setInterval(() => {
      this.flushEventBuffer();
    }, 30000);

    // 每5分钟清理过期数据
    setInterval(() => {
      this.cleanupExpiredData();
    }, 300000);
  }

  /**
   * 清理过期数据
   */
  private async cleanupExpiredData(): Promise<void> {
    if (!this.supabase) return;

    try {
      // 删除30天前的安全事件
      await this.supabase
        .from('security_events')
        .delete()
        .lt('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
    }
  }
}

// 创建全局安全监控实例
export const securityMonitor = new SecurityMonitorService({
  minimumLevel: import.meta.env.NODE_ENV === 'production' 
    ? SecurityLevel.MEDIUM 
    : SecurityLevel.LOW,
  enabled: true,
  webhook: import.meta.env.VITE_SECURITY_WEBHOOK,
  email: import.meta.env.VITE_SECURITY_EMAIL
});

// 自动监控某些全局事件
if (typeof window !== 'undefined') {
  // 监控未处理的错误
  window.addEventListener('error', (event) => {
    securityMonitor.logSecurityEvent({
      type: ThreatType.SUSPICIOUS_PATTERN,
      level: SecurityLevel.LOW,
      details: {
        error: event.error?.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      },
      blocked: false,
      action: 'javascript_error'
    });
  });

  // 监控未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    securityMonitor.logSecurityEvent({
      type: ThreatType.SUSPICIOUS_PATTERN,
      level: SecurityLevel.LOW,
      details: {
        reason: event.reason?.toString()
      },
      blocked: false,
      action: 'unhandled_rejection'
    });
  });
}

export default SecurityMonitorService;