// Core type definitions for the AI Video SaaS platform

export interface User {
  id: string
  email: string
  username?: string
  avatarUrl?: string
  language: string
  theme: 'light' | 'dark'
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  isActive: boolean
  referralCode?: string
  referredBy?: string
}

export interface Template {
  id: string
  name: string
  description: string
  promptTemplate: string
  parameters: TemplateParameter[]
  previewUrl?: string
  thumbnailUrl?: string
  creditCost: number
  category: string
  tags: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TemplateParameter {
  name: string
  type: 'text' | 'image'
  required: boolean
  placeholder?: string
  maxLength?: number
  acceptedFormats?: string[]
}

export interface Video {
  id: string
  userId: string
  templateId: string
  parameters: Record<string, any>
  prompt: string
  videoUrl?: string
  thumbnailUrl?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  googleAccountUsed?: string
  generationTime?: number
  createdAt: Date
  completedAt?: Date
}

export interface Credits {
  id: string
  userId: string
  balance: number
  totalEarned: number
  totalSpent: number
  updatedAt: Date
}

export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  type: 'purchase' | 'spend' | 'referral' | 'bonus'
  description: string
  referenceId?: string
  createdAt: Date
}

export interface Subscription {
  id: string
  userId: string
  stripeSubscriptionId: string
  planId: 'basic' | 'pro' | 'enterprise' | 'basic-annual' | 'pro-annual' | 'enterprise-annual'
  status: 'active' | 'cancelled' | 'expired'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}

// 订阅计划类型，包含年度和月度
export type SubscriptionPlanId = 'basic' | 'pro' | 'enterprise' | 'basic-annual' | 'pro-annual' | 'enterprise-annual'

// 基础计划类型（不包含计费周期）
export type BasePlanId = 'basic' | 'pro' | 'enterprise'

// 计费周期类型
export type BillingInterval = 'month' | 'year'

export interface Payment {
  id: string
  userId: string
  stripePaymentIntentId: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed'
  description: string
  createdAt: Date
}