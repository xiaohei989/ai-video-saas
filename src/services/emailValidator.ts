/**
 * 邮箱验证服务
 * 包含临时邮箱检测功能，支持数据库动态黑名单
 */

import { supabase } from '@/lib/supabase'
import i18n from '@/i18n/config'

// 本地缓存的黑名单域名（作为备用）
const FALLBACK_BLOCKED_DOMAINS = [
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
  'maildrop.cc',
  'mintemail.com',
  'sharklasers.com',
  'guerrillamail.biz',
  'guerrillamail.net',
  'guerrillamail.org',
  'emailondeck.com',
  'tempail.com',
  'getnada.com',
  'dispostable.com',
  'fakeinbox.com',
  'spamgourmet.com',
  'mytrashmail.com',
  'trbvm.com'
];

// 缓存黑名单域名和缓存时间
let cachedBlockedDomains: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 从数据库获取黑名单域名
 */
async function fetchBlockedDomains(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('blocked_email_domains')
      .select('domain')
      .eq('is_active', true);
    
    if (error) {
      console.warn('Failed to fetch blocked domains from database:', error);
      return new Set(FALLBACK_BLOCKED_DOMAINS);
    }
    
    return new Set(data.map(d => d.domain.toLowerCase()));
  } catch (error) {
    console.warn('Error fetching blocked domains:', error);
    return new Set(FALLBACK_BLOCKED_DOMAINS);
  }
}

/**
 * 获取缓存的黑名单域名
 */
async function getCachedBlockedDomains(): Promise<Set<string>> {
  const now = Date.now();
  
  // 如果缓存过期或不存在，重新获取
  if (!cachedBlockedDomains || (now - cacheTimestamp) > CACHE_DURATION) {
    cachedBlockedDomains = await fetchBlockedDomains();
    cacheTimestamp = now;
  }
  
  return cachedBlockedDomains;
}

/**
 * 检查邮箱是否为临时邮箱（异步版本，使用数据库）
 */
export async function isTemporaryEmailAsync(email: string): Promise<boolean> {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  // 使用数据库函数检查（推荐）
  try {
    const { data, error } = await supabase.rpc('is_blocked_email_domain', {
      p_email: email
    });
    
    if (error) {
      console.warn('Database domain check failed, using cache:', error);
      // 如果数据库检查失败，使用缓存
      const blockedDomains = await getCachedBlockedDomains();
      return blockedDomains.has(domain);
    }
    
    return data;
  } catch (error) {
    console.warn('Error checking blocked domain:', error);
    // 错误时使用缓存
    const blockedDomains = await getCachedBlockedDomains();
    return blockedDomains.has(domain);
  }
}

/**
 * 检查邮箱是否为临时邮箱（同步版本，使用本地缓存）
 */
export function isTemporaryEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  // 如果有缓存且未过期，使用缓存
  if (cachedBlockedDomains && (Date.now() - cacheTimestamp) <= CACHE_DURATION) {
    return cachedBlockedDomains.has(domain);
  }
  
  // 否则使用备用黑名单
  return FALLBACK_BLOCKED_DOMAINS.includes(domain);
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 综合邮箱验证（格式 + 临时邮箱检测）- 异步版本
 */
export async function validateEmailAsync(email: string): Promise<{
  isValid: boolean;
  isTemporary: boolean;
  error?: string;
}> {
  // 检查格式
  if (!isValidEmail(email)) {
    return {
      isValid: false,
      isTemporary: false,
      error: i18n.t('auth.invalidEmail')
    };
  }

  // 检查是否为临时邮箱（使用数据库）
  const isTemp = await isTemporaryEmailAsync(email);
  if (isTemp) {
    return {
      isValid: false,
      isTemporary: true,
      error: i18n.t('auth.temporaryEmailNotAllowed')
    };
  }

  return {
    isValid: true,
    isTemporary: false
  };
}

/**
 * 综合邮箱验证（格式 + 临时邮箱检测）- 同步版本
 */
export function validateEmail(email: string): {
  isValid: boolean;
  isTemporary: boolean;
  error?: string;
} {
  // 检查格式
  if (!isValidEmail(email)) {
    return {
      isValid: false,
      isTemporary: false,
      error: i18n.t('auth.invalidEmail')
    };
  }

  // 检查是否为临时邮箱（使用本地缓存）
  const isTemp = isTemporaryEmail(email);
  if (isTemp) {
    return {
      isValid: false,
      isTemporary: true,
      error: i18n.t('auth.temporaryEmailNotAllowed')
    };
  }

  return {
    isValid: true,
    isTemporary: false
  };
}

/**
 * 获取邮箱域名
 */
export function getEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const domain = email.split('@')[1];
  return domain ? domain.toLowerCase() : null;
}

/**
 * 检查邮箱域名是否在黑名单中（异步版本）
 */
export async function isBlockedDomainAsync(domain: string): Promise<boolean> {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  const blockedDomains = await getCachedBlockedDomains();
  return blockedDomains.has(domain.toLowerCase());
}

/**
 * 检查邮箱域名是否在黑名单中（同步版本）
 */
export function isBlockedDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // 如果有缓存且未过期，使用缓存
  if (cachedBlockedDomains && (Date.now() - cacheTimestamp) <= CACHE_DURATION) {
    return cachedBlockedDomains.has(domain.toLowerCase());
  }
  
  // 否则使用备用黑名单
  return FALLBACK_BLOCKED_DOMAINS.includes(domain.toLowerCase());
}

/**
 * 预加载黑名单域名到缓存
 */
export async function preloadBlockedDomains(): Promise<void> {
  try {
    await getCachedBlockedDomains();
    console.log('Blocked domains cache preloaded successfully');
  } catch (error) {
    console.warn('Failed to preload blocked domains cache:', error);
  }
}

export default {
  isTemporaryEmail,
  isTemporaryEmailAsync,
  isValidEmail,
  validateEmail,
  validateEmailAsync,
  getEmailDomain,
  isBlockedDomain,
  isBlockedDomainAsync,
  preloadBlockedDomains,
  FALLBACK_BLOCKED_DOMAINS: FALLBACK_BLOCKED_DOMAINS
};