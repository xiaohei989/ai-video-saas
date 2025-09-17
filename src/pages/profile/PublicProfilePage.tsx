import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { 
  User, 
  Globe, 
  Twitter,
  Github,
  Linkedin,
  Instagram,
  Youtube,
  Calendar,
  Video,
  Heart,
  Users,
  Grid3x3,
  CheckCircle,
  Plus,
  Minus,
  Share2,
  ExternalLink
} from 'lucide-react'

interface PublicProfile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  website: string | null
  social_links: any
  follower_count: number
  following_count: number
  template_count: number
  is_verified: boolean
  created_at: string
}

interface Template {
  id: string
  name: string
  description: string
  thumbnail_url: string
  like_count: number
  view_count: number
  is_public: boolean
}

export default function PublicProfilePage() {
  const { t } = useTranslation()
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalVideos: 0
  })

  // 获取用户资料
  useEffect(() => {
    if (!username) return
    fetchProfile()
  }, [username])

  // 检查关注状态
  useEffect(() => {
    if (user && profile) {
      checkFollowStatus()
    }
  }, [user, profile])

  const fetchProfile = async () => {
    try {
      setIsLoading(true)
      
      // 获取用户资料
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      // 获取用户模板
      const { data: templatesData, error: templatesError } = await supabase
        .from('templates')
        .select('*')
        .eq('author_id', profileData.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (!templatesError && templatesData) {
        setTemplates(templatesData)
        
        // 计算统计数据
        const totalViews = templatesData.reduce((sum, t) => sum + (t.view_count || 0), 0)
        const totalLikes = templatesData.reduce((sum, t) => sum + (t.like_count || 0), 0)
        
        setStats({
          totalViews,
          totalLikes,
          totalVideos: templatesData.length
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkFollowStatus = async () => {
    if (!user || !profile) return

    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profile.id)
        .single()

      setIsFollowing(!!data && !error)
    } catch (error) {
      console.error('Error checking follow status:', error)
    }
  }

  const handleFollow = async () => {
    if (!user || !profile) {
      // 提示登录
      toast.error(t('profile.loginToFollow'))
      return
    }

    try {
      if (isFollowing) {
        // 取消关注
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id)
        
        setIsFollowing(false)
        setProfile(prev => prev ? {
          ...prev,
          follower_count: Math.max(0, prev.follower_count - 1)
        } : null)
      } else {
        // 关注
        await supabase
          .from('user_follows')
          .insert({
            follower_id: user.id,
            following_id: profile.id
          })
        
        setIsFollowing(true)
        setProfile(prev => prev ? {
          ...prev,
          follower_count: prev.follower_count + 1
        } : null)
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  const copyProfileLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    toast.success(t('profile.linkCopied'))
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <User className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t('profile.userNotFound')}</h1>
        <p className="text-muted-foreground">{t('profile.userNotFoundDescription')}</p>
        <Link to="/">
          <Button className="mt-4">{t('common.backToHome')}</Button>
        </Link>
      </div>
    )
  }

  const isOwnProfile = user?.id === profile.id

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* 用户信息头部 */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* 头像 */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-muted">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* 用户信息 */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">{profile.full_name || profile.username}</h1>
                  {profile.is_verified && (
                    <CheckCircle className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>

              <div className="flex gap-2">
                {isOwnProfile ? (
                  <Link to="/profile/edit">
                    <Button variant="outline">
                      {t('profile.editProfile')}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={handleFollow}
                    variant={isFollowing ? 'outline' : 'default'}
                  >
                    {isFollowing ? (
                      <>
                        <Minus className="mr-2 h-4 w-4" />
                        {t('profile.unfollow')}
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('profile.follow')}
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyProfileLink}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 简介 */}
            {profile.bio && (
              <p className="text-foreground mb-4 max-w-2xl">{profile.bio}</p>
            )}

            {/* 统计数据 */}
            <div className="flex flex-wrap gap-6 mb-4">
              <div className="flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{formatNumber(profile.template_count)}</span>
                <span className="text-muted-foreground">{t('profile.templates')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{formatNumber(profile.follower_count)}</span>
                <span className="text-muted-foreground">{t('profile.followers')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{formatNumber(profile.following_count)}</span>
                <span className="text-muted-foreground">{t('profile.following')}</span>
              </div>
            </div>

            {/* 链接 */}
            <div className="flex flex-wrap gap-3">
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Globe className="w-4 h-4" />
                  <span>{new URL(profile.website).hostname}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {profile.social_links?.twitter && (
                <a
                  href={profile.social_links.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Twitter className="w-4 h-4" />
                  <span>Twitter</span>
                </a>
              )}
              {profile.social_links?.github && (
                <a
                  href={profile.social_links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Github className="w-4 h-4" />
                  <span>GitHub</span>
                </a>
              )}
              {profile.social_links?.linkedin && (
                <a
                  href={profile.social_links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Linkedin className="w-4 h-4" />
                  <span>LinkedIn</span>
                </a>
              )}
              {profile.social_links?.instagram && (
                <a
                  href={profile.social_links.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Instagram className="w-4 h-4" />
                  <span>Instagram</span>
                </a>
              )}
              {profile.social_links?.youtube && (
                <a
                  href={profile.social_links.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Youtube className="w-4 h-4" />
                  <span>YouTube</span>
                </a>
              )}
            </div>

            {/* 加入时间 */}
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{t('profile.joinedIn')} {formatDate(profile.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('profile.totalViews')}</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalViews)}</p>
              </div>
              <Video className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('profile.totalLikes')}</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalLikes)}</p>
              </div>
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('profile.totalTemplates')}</p>
                <p className="text-2xl font-bold">{formatNumber(templates.length)}</p>
              </div>
              <Grid3x3 className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 模板列表 */}
      <div>
        <h2 className="text-2xl font-bold mb-6">{t('profile.publicTemplates')}</h2>
        
        {templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Grid3x3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('profile.noTemplatesYet')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Link key={template.id} to={`/templates/${template.id}`}>
                <Card className="cursor-pointer">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {template.thumbnail_url ? (
                      <img 
                        src={template.thumbnail_url} 
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">{template.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {formatNumber(template.like_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-4 h-4" />
                        {formatNumber(template.view_count)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}