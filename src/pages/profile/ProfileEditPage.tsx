import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, uploadFile } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'
import { 
  Loader2, 
  User, 
  Mail, 
  Globe, 
  FileText, 
  Twitter,
  Instagram,
  Youtube,
  Camera,
  Save,
  X
} from '@/components/icons'

import { toast } from 'sonner'

interface SocialLinks {
  twitter?: string
  instagram?: string
  youtube?: string
  website?: string
}

export default function ProfileEditPage() {
  const { t } = useTranslation()
  const { navigateTo } = useLanguageRouter()
  const { user, profile, updateProfile, refreshProfile } = useAuth()
  
  // 表单状态
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({})
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  
  // UI 状态
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  // 加载用户资料
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '')
      setFullName(profile.full_name || '')
      setBio(profile.bio || '')
      setWebsite(profile.website || '')
      setSocialLinks(profile.social_links || {})
      setAvatarPreview(profile.avatar_url || '')
    }
  }, [profile])

  // 处理头像选择
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setErrors({ avatar: t('profile.invalidImageType') })
      return
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ avatar: t('profile.imageTooLarge') })
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setErrors({})
  }

  // 上传头像
  const uploadAvatar = async () => {
    if (!avatarFile || !user) return null

    try {
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`
      
      // 检查网络连接
      if (!navigator.onLine) {
        throw new Error(t('profile.networkOffline') || '网络连接异常，请检查网络后重试')
      }
      
      
      await uploadFile('avatars', fileName, avatarFile, {
        cacheControl: '3600',
        upsert: true,
        maxRetries: 3
        // 不设置contentType，让浏览器自动处理
      })

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      return data.publicUrl
    } catch (error: any) {
      
      // 提供更详细的错误信息
      if (error.message?.includes('未登录') || error.message?.includes('session已过期')) {
        throw new Error(t('profile.loginStatusError'))
      } else if (error.message?.includes('网络') || error.message?.includes('fetch') || error.message?.includes('network')) {
        throw new Error(t('profile.networkError'))
      } else if (error.message?.includes('权限') || error.message?.includes('policy') || error.message?.includes('unauthorized')) {
        throw new Error(t('profile.permissionError'))
      } else if (error.message?.includes('文件类型') || error.message?.includes('mime type') || error.message?.includes('not supported')) {
        throw new Error(t('profile.unsupportedFileType'))
      } else if (error.message?.includes('size') || error.message?.includes('large')) {
        throw new Error(t('profile.fileTooLarge'))
      }
      
      // 默认错误信息
      throw new Error(`${t('profile.uploadFailed')}: ${error.message || t('common.unknownError')}`)
    }
  }

  // 验证表单
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (username && !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      newErrors.username = t('profile.invalidUsername')
    }

    if (bio && bio.length > 500) {
      newErrors.bio = t('profile.bioTooLong')
    }

    if (website && !/^https?:\/\/.+/.test(website)) {
      newErrors.website = t('profile.invalidWebsite')
    }

    // 验证社交链接
    Object.entries(socialLinks).forEach(([platform, url]) => {
      if (url && !/^https?:\/\/.+/.test(url)) {
        newErrors[platform] = t('profile.invalidUrl')
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 保存除头像外的其他字段
  const saveOtherFields = async () => {
    try {
      setIsSaving(true)
      
      // 更新资料（不包含头像）
      await updateProfile({
        username,
        full_name: fullName,
        bio,
        website,
        social_links: socialLinks
      })

      await refreshProfile()
      toast.success(t('profile.profileUpdatedExceptAvatar'))
      
    } catch (error: any) {
      console.error('Profile update error (saveOtherFields):', error)
      if (error.message?.includes('duplicate key')) {
        setErrors({ username: t('profile.usernameExists') })
        toast.error(t('profile.usernameAlreadyTaken'))
      } else if (error.message?.includes('network')) {
        toast.error(t('profile.networkError'))
      } else {
        toast.error(`${t('profile.updateError')}: ${error.message}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // 保存资料
  const handleSave = async () => {
    if (!validateForm()) return

    try {
      setIsSaving(true)
      setSuccessMessage('')
      setErrors({})

      // 上传头像（如果有新头像）
      let avatarUrl = profile?.avatar_url
      if (avatarFile) {
        try {
          avatarUrl = await uploadAvatar()
        } catch (uploadError: any) {
          // 头像上传失败，但可以继续保存其他信息
          console.error('Avatar upload failed:', uploadError)
          setErrors({ avatar: uploadError.message })
          
          // 使用toast提示错误，并询问是否继续保存其他信息
          toast.error(uploadError.message, {
            duration: 5000,
            action: {
              label: t('profile.continueWithoutAvatar'),
              onClick: () => {
                // 继续执行保存流程
                saveOtherFields()
              }
            }
          })
          
          setIsSaving(false)
          return
        }
      }

      // 更新资料
      await updateProfile({
        username,
        full_name: fullName,
        bio,
        website,
        social_links: socialLinks,
        avatar_url: avatarUrl || undefined
      })

      await refreshProfile()
      toast.success(t('profile.updateSuccess'))
      
      // 清除头像文件
      setAvatarFile(null)
      
    } catch (error: any) {
      console.error('Profile update error (handleSave):', error)
      if (error.message?.includes('duplicate key')) {
        setErrors({ username: t('profile.usernameExists') })
        toast.error(t('profile.usernameAlreadyTaken'))
      } else if (error.message?.includes('network')) {
        toast.error(t('profile.networkError'))
      } else {
        toast.error(`${t('profile.updateError')}: ${error.message}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // 处理社交链接变化
  const handleSocialLinkChange = (platform: keyof SocialLinks, value: string) => {
    setSocialLinks(prev => ({
      ...prev,
      [platform]: value
    }))
  }

  // 移除头像
  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview('')
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t('profile.editProfile')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('profile.editProfileDescription')}
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4">
        {/* 基本信息卡片（包含头像） */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t('profile.basicInfo')}</CardTitle>
            <CardDescription className="text-sm">
              {t('profile.basicInfoDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 头像和基本信息部分 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 左侧：头像 */}
              <div className="flex flex-col items-center justify-start">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-muted">
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {avatarPreview && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="absolute -top-1 -right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload" className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Camera className="mr-1 h-3 w-3" />
                      {t('profile.changeAvatar')}
                    </span>
                  </Button>
                </label>
                {errors.avatar && (
                  <p className="text-xs text-red-600 mt-1 text-center">{errors.avatar}</p>
                )}
              </div>

              {/* 右侧：用户名、全名和邮箱 */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-sm">
                    <User className="inline w-3.5 h-3.5 mr-1" />
                    {t('profile.username')}
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('profile.usernamePlaceholder')}
                    disabled={isSaving}
                    className="h-9 text-sm"
                  />
                  {errors.username && (
                    <p className="text-xs text-red-600">{errors.username}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm">
                    <User className="inline w-3.5 h-3.5 mr-1" />
                    {t('profile.fullName')}
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('profile.fullNamePlaceholder')}
                    disabled={isSaving}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm">
                    <Mail className="inline w-3.5 h-3.5 mr-1" />
                    {t('profile.email')}
                  </Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('profile.emailCannotChange')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-sm">
                <FileText className="inline w-3.5 h-3.5 mr-1" />
                {t('profile.bio')}
              </Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('profile.bioPlaceholder')}
                className="w-full min-h-[60px] px-3 py-2 border rounded-md bg-background text-sm resize-none"
                maxLength={500}
                disabled={isSaving}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{bio.length}/500</span>
              </div>
              {errors.bio && (
                <p className="text-xs text-red-600">{errors.bio}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website" className="text-sm">
                <Globe className="inline w-3.5 h-3.5 mr-1" />
                {t('profile.website')}
              </Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                disabled={isSaving}
                className="h-9 text-sm"
              />
              {errors.website && (
                <p className="text-xs text-red-600">{errors.website}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 社交链接卡片 */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t('profile.socialLinks')}</CardTitle>
            <CardDescription className="text-sm">
              {t('profile.socialLinksDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="twitter" className="text-sm">
                  <Twitter className="inline w-3.5 h-3.5 mr-1" />
                  Twitter
                </Label>
                <Input
                  id="twitter"
                  value={socialLinks.twitter || ''}
                  onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                  placeholder="@username"
                  disabled={isSaving}
                  className="h-9 text-sm"
                />
                {errors.twitter && (
                  <p className="text-xs text-red-600">{errors.twitter}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instagram" className="text-sm">
                  <Instagram className="inline w-3.5 h-3.5 mr-1" />
                  Instagram
                </Label>
                <Input
                  id="instagram"
                  value={socialLinks.instagram || ''}
                  onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                  placeholder="@username"
                  disabled={isSaving}
                  className="h-9 text-sm"
                />
                {errors.instagram && (
                  <p className="text-xs text-red-600">{errors.instagram}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="youtube" className="text-sm">
                  <Youtube className="inline w-3.5 h-3.5 mr-1" />
                  YouTube
                </Label>
                <Input
                  id="youtube"
                  value={socialLinks.youtube || ''}
                  onChange={(e) => handleSocialLinkChange('youtube', e.target.value)}
                  placeholder="@channel"
                  disabled={isSaving}
                  className="h-9 text-sm"
                />
                {errors.youtube && (
                  <p className="text-xs text-red-600">{errors.youtube}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateTo('/profile')}
            disabled={isSaving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-3 w-3" />
                {t('common.save')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}