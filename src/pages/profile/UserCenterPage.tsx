// import React from 'react' // unused
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { useLanguageRouter } from '@/hooks/useLanguageRouter'
import MembershipBadge from '@/components/subscription/MembershipBadge'
import { useSEO } from '@/hooks/useSEO'
import { 
  User,
  Settings,
  Grid3x3,
  CreditCard,
  LogOut,
  ChevronRight,
  Edit
} from 'lucide-react'


export default function UserCenterPage() {
  const { t } = useTranslation()
  const { navigateTo } = useLanguageRouter()
  const { user, profile, signOut } = useAuth()

  // SEO优化
  useSEO('profile')

  const handleSignOut = async () => {
    try {
      await signOut()
      navigateTo('/')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }


  // 快速操作菜单
  const quickActions = [
    {
      title: t('profile.editProfile'),
      description: t('userCenter.editProfileDesc'),
      icon: <Edit className="h-5 w-5" />,
      link: '/profile/edit',
      color: 'text-blue-600'
    },
    {
      title: t('userCenter.myVideos'),
      description: t('userCenter.myVideosDesc'),
      icon: <Grid3x3 className="h-5 w-5" />,
      link: '/videos',
      color: 'text-green-600'
    },
    {
      title: t('userCenter.accountSettings'),
      description: t('userCenter.accountSettingsDesc'),
      icon: <Settings className="h-5 w-5" />,
      link: '/profile/settings',
      color: 'text-purple-600'
    },
    {
      title: t('userCenter.subscription'),
      description: t('userCenter.subscriptionDesc'),
      icon: <CreditCard className="h-5 w-5" />,
      link: '/pricing',
      color: 'text-orange-600'
    }
  ]


  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      {/* 用户信息头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-muted">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.username || 'User avatar'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">
                  {t('userCenter.welcome')}, {profile?.full_name || profile?.username || user?.email}
                </h1>
                {user && <MembershipBadge userId={user.id} variant="full" />}
              </div>
              <p className="text-muted-foreground">
                {profile?.bio || t('userCenter.noBio')}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('common.signOut')}
          </Button>
        </div>
      </div>


      <div>
        {/* 快速操作 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t('userCenter.quickActions')}</CardTitle>
              <CardDescription>
                {t('userCenter.quickActionsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickActions.map((action, index) => (
                  <Link key={index} to={action.link}>
                    <Card className="cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-muted ${action.color}`}>
                            {action.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">{action.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {action.description}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}