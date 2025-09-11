import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Film, Video, CreditCard, User, Settings } from 'lucide-react'
import { cn } from '@/utils/cn'

const sidebarItems = [
  { icon: Home, label: 'nav.home', path: '/' },
  { icon: Film, label: 'nav.templates', path: '/templates' },
  { icon: Video, label: 'nav.videos', path: '/videos' },
  { icon: CreditCard, label: 'nav.pricing', path: '/pricing' },
  { icon: User, label: 'nav.profile', path: '/profile' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r bg-sidebar">
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium group overflow-hidden',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-md'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {/* Animated background on hover */}
                <span className={cn(
                  'absolute left-0 top-0 h-full w-1 bg-primary',
                  isActive ? 'opacity-100' : 'opacity-0'
                )} />
                
                {/* Icon with scale animation */}
                <Icon className={cn(
                  'h-4 w-4',
                  isActive 
                    ? 'scale-110' 
                    : ''
                )} />
                
                {/* Text with subtle translation */}
                <span>
                  {t(item.label)}
                </span>
                
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
      
      {/* Credits Display with hover effect */}
      <div className="border-t p-4">
        <div className="rounded-lg bg-sidebar-accent p-3 cursor-pointer group">
          <p className="text-xs text-sidebar-accent-foreground/70">
            {t('credits.balance')}
          </p>
          <p className="text-2xl font-bold text-sidebar-accent-foreground">
            100
          </p>
        </div>
      </div>
    </aside>
  )
}