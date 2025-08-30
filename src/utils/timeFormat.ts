import i18n from '@/i18n/config'

/**
 * Format date to relative time string with i18n support
 * @param date - Date string or Date object
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const targetDate = typeof date === 'string' ? new Date(date) : date
  const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return i18n.t('time.justNow')
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return i18n.t('time.minutesAgo', { count: diffInMinutes })
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return i18n.t('time.hoursAgo', { count: diffInHours })
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) {
    return i18n.t('time.yesterday')
  }
  if (diffInDays === 2) {
    return i18n.t('time.dayBeforeYesterday')
  }
  if (diffInDays < 7) {
    return i18n.t('time.daysAgo', { count: diffInDays })
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return i18n.t('time.weeksAgo', { count: diffInWeeks })
  }
  
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return i18n.t('time.monthsAgo', { count: diffInMonths })
  }
  
  const diffInYears = Math.floor(diffInDays / 365)
  return i18n.t('time.yearsAgo', { count: diffInYears })
}

/**
 * Format date to display string
 * @param date - Date string or Date object
 * @returns Formatted date string (YYYY-MM-DD HH:mm)
 */
export function formatDateTime(date: string | Date): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date
  
  const year = targetDate.getFullYear()
  const month = String(targetDate.getMonth() + 1).padStart(2, '0')
  const day = String(targetDate.getDate()).padStart(2, '0')
  const hours = String(targetDate.getHours()).padStart(2, '0')
  const minutes = String(targetDate.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * Format duration in seconds to human readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "1分23秒", "2小时15分")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}${i18n.t('time.units.seconds')}`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}${i18n.t('time.units.minute')}${remainingSeconds}${i18n.t('time.units.seconds')}`
      : `${minutes}${i18n.t('time.units.minutes')}`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours}${i18n.t('time.units.hours')}${remainingMinutes}${i18n.t('time.units.minute')}`
      : `${hours}${i18n.t('time.units.hours')}`
  }
  
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  
  return remainingHours > 0
    ? `${days}${i18n.t('time.units.days')}${remainingHours}${i18n.t('time.units.hours')}`
    : `${days}${i18n.t('time.units.days')}`
}