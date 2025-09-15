/**
 * 错误代码映射器
 * 将数据库返回的错误代码映射为本地化的错误消息
 */

import i18n from '@/i18n/config'

// 定义错误代码映射
const ERROR_CODE_MAP: Record<string, string> = {
  // 邮箱相关错误
  'TEMPORARY_EMAIL_NOT_ALLOWED': 'auth.temporaryEmailNotAllowed',
  'INVALID_EMAIL_FORMAT': 'auth.invalidEmailFormat',
  
  // 注册安全相关错误
  'IP_REGISTRATION_LIMIT_EXCEEDED': 'auth.ipRegistrationLimitExceeded',
  'DEVICE_REGISTRATION_LIMIT_EXCEEDED': 'auth.deviceRegistrationLimitExceeded',
  'REGISTRATION_ALLOWED': 'auth.registrationAllowed',
  
  // 邀请相关错误
  'INVITATION_INVALID_OR_EXPIRED': 'referral.errors.invalidOrExpired',
  'CANNOT_INVITE_YOURSELF': 'referral.errors.cannotInviteYourself',
  'ALREADY_HAS_REFERRER': 'referral.errors.alreadyHasReferrer',
  'INVITATION_PROCESSED_SUCCESSFULLY': 'referral.invitationProcessedSuccessfully',
  
  // 积分相关错误
  'CREDIT_CONSUMPTION_FAILED': 'errors.credit.consumeFailed',
  'CREDIT_ADDITION_FAILED': 'errors.credit.addFailed',
  'INSUFFICIENT_CREDITS': 'errors.credit.insufficientCredits',
  
  // 视频处理相关错误
  'VIDEO_GENERATION_FAILED': 'errors.video.processingFailed',
  'VIDEO_VALIDATION_FAILED': 'errors.video.validationFailed',
  'PROMPT_VALIDATION_FAILED': 'errors.video.promptValidationFailed',
  
  // 通用错误
  'NETWORK_ERROR': 'errors.credit.networkError',
  'FUNCTION_CALL_FAILED': 'errors.credit.functionCallFailed',
  'FUNCTION_EXECUTION_FAILED': 'errors.credit.functionExecutionFailed',
  'UNKNOWN_ERROR': 'common.unknownError'
}

/**
 * 将错误代码映射为本地化的错误消息
 * @param errorCode 数据库或服务返回的错误代码
 * @param fallback 如果找不到映射时的后备消息
 * @returns 本地化的错误消息
 */
export function mapErrorCodeToMessage(errorCode: string, fallback?: string): string {
  const i18nKey = ERROR_CODE_MAP[errorCode]
  
  if (i18nKey) {
    return i18n.t(i18nKey)
  }
  
  // 如果没有找到映射，返回后备消息或原始错误代码
  return fallback || errorCode
}

/**
 * 检查错误消息是否是错误代码格式
 * @param message 错误消息
 * @returns 是否是错误代码格式
 */
export function isErrorCode(message: string): boolean {
  return /^[A-Z_]+$/.test(message) && ERROR_CODE_MAP.hasOwnProperty(message)
}

/**
 * 智能错误消息处理
 * 如果是错误代码则映射，否则直接返回消息
 * @param message 错误消息或错误代码
 * @returns 处理后的错误消息
 */
export function processErrorMessage(message: string): string {
  if (isErrorCode(message)) {
    return mapErrorCodeToMessage(message)
  }
  return message
}

export default {
  mapErrorCodeToMessage,
  isErrorCode,
  processErrorMessage,
  ERROR_CODE_MAP
}