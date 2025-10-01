/**
 * Lucide图标按需导入封装
 *
 * 优化策略: 使用单独导入避免打包整个lucide-react库
 * 预计减少bundle大小: 100-150KB
 *
 * ❌ 旧方式: import { Play, Pause } from '@/components/icons'  // 导入整个库
 * ✅ 新方式: import { Play, Pause } from '@/components/icons'  // 按需导入
 */

// 导航和箭头
export { default as ArrowLeft } from 'lucide-react/dist/esm/icons/arrow-left'
export { default as ArrowRight } from 'lucide-react/dist/esm/icons/arrow-right'
export { default as ArrowUp } from 'lucide-react/dist/esm/icons/arrow-up'
export { default as ArrowUpRight } from 'lucide-react/dist/esm/icons/arrow-up-right'
export { default as ChevronDown } from 'lucide-react/dist/esm/icons/chevron-down'
export { default as ChevronLeft } from 'lucide-react/dist/esm/icons/chevron-left'
export { default as ChevronRight } from 'lucide-react/dist/esm/icons/chevron-right'
export { default as ChevronUp } from 'lucide-react/dist/esm/icons/chevron-up'
export { default as ChevronsLeft } from 'lucide-react/dist/esm/icons/chevrons-left'
export { default as ChevronsRight } from 'lucide-react/dist/esm/icons/chevrons-right'
export { default as ExternalLink } from 'lucide-react/dist/esm/icons/external-link'
export { default as Home } from 'lucide-react/dist/esm/icons/home'

// 媒体控制
export { default as Play } from 'lucide-react/dist/esm/icons/play'
export { default as Pause } from 'lucide-react/dist/esm/icons/pause'
export { default as Volume2 } from 'lucide-react/dist/esm/icons/volume-2'
export { default as VolumeX } from 'lucide-react/dist/esm/icons/volume-x'
export { default as Video } from 'lucide-react/dist/esm/icons/video'
export { default as Film } from 'lucide-react/dist/esm/icons/film'
export { default as Maximize } from 'lucide-react/dist/esm/icons/maximize'
export { default as Minimize } from 'lucide-react/dist/esm/icons/minimize'

// 操作图标
export { default as Download } from 'lucide-react/dist/esm/icons/download'
export { default as Upload } from 'lucide-react/dist/esm/icons/upload'
export { default as Copy } from 'lucide-react/dist/esm/icons/copy'
export { default as Share2 } from 'lucide-react/dist/esm/icons/share-2'
export { default as Search } from 'lucide-react/dist/esm/icons/search'
export { default as RefreshCw } from 'lucide-react/dist/esm/icons/refresh-cw'
export { default as RefreshCcw } from 'lucide-react/dist/esm/icons/refresh-ccw'
export { default as Settings } from 'lucide-react/dist/esm/icons/settings'
export { default as Printer } from 'lucide-react/dist/esm/icons/printer'

// 状态和提示
export { default as Check } from 'lucide-react/dist/esm/icons/check'
export { default as CheckCircle } from 'lucide-react/dist/esm/icons/check-circle'
export { default as CheckCircle2 } from 'lucide-react/dist/esm/icons/check-circle-2'
export { default as X } from 'lucide-react/dist/esm/icons/x'
export { default as XCircle } from 'lucide-react/dist/esm/icons/x-circle'
export { default as AlertCircle } from 'lucide-react/dist/esm/icons/alert-circle'
export { default as AlertTriangle } from 'lucide-react/dist/esm/icons/alert-triangle'
export { default as Info } from 'lucide-react/dist/esm/icons/info'
export { default as Loader2 } from 'lucide-react/dist/esm/icons/loader-2'
export { default as Clock } from 'lucide-react/dist/esm/icons/clock'

// 用户和账户
export { default as User } from 'lucide-react/dist/esm/icons/user'
export { default as Users } from 'lucide-react/dist/esm/icons/users'
export { default as UserCheck } from 'lucide-react/dist/esm/icons/user-check'
export { default as UserX } from 'lucide-react/dist/esm/icons/user-x'
export { default as Mail } from 'lucide-react/dist/esm/icons/mail'
export { default as Lock } from 'lucide-react/dist/esm/icons/lock'

// 界面元素
export { default as Eye } from 'lucide-react/dist/esm/icons/eye'
export { default as EyeOff } from 'lucide-react/dist/esm/icons/eye-off'
export { default as Heart } from 'lucide-react/dist/esm/icons/heart'
export { default as Star } from 'lucide-react/dist/esm/icons/star'
export { default as MoreHorizontal } from 'lucide-react/dist/esm/icons/more-horizontal'
export { default as Trash2 } from 'lucide-react/dist/esm/icons/trash-2'
export { default as Minus } from 'lucide-react/dist/esm/icons/minus'
export { default as Menu } from 'lucide-react/dist/esm/icons/menu'
export { default as Globe } from 'lucide-react/dist/esm/icons/globe'
export { default as LogIn } from 'lucide-react/dist/esm/icons/log-in'
export { default as LogOut } from 'lucide-react/dist/esm/icons/log-out'
export { default as DollarSign } from 'lucide-react/dist/esm/icons/dollar-sign'

// 商业和支付
export { default as CreditCard } from 'lucide-react/dist/esm/icons/credit-card'
export { default as ShoppingCart } from 'lucide-react/dist/esm/icons/shopping-cart'
export { default as Gift } from 'lucide-react/dist/esm/icons/gift'
export { default as Crown } from 'lucide-react/dist/esm/icons/crown'
export { default as Gem } from 'lucide-react/dist/esm/icons/gem'
export { default as Tag } from 'lucide-react/dist/esm/icons/tag'

// 数据和图表
export { default as BarChart3 } from 'lucide-react/dist/esm/icons/bar-chart-3'
export { default as TrendingUp } from 'lucide-react/dist/esm/icons/trending-up'
export { default as TrendingDown } from 'lucide-react/dist/esm/icons/trending-down'
export { default as Activity } from 'lucide-react/dist/esm/icons/activity'
export { default as Database } from 'lucide-react/dist/esm/icons/database'
export { default as HardDrive } from 'lucide-react/dist/esm/icons/hard-drive'

// 文件和文档
export { default as FileText } from 'lucide-react/dist/esm/icons/file-text'
export { default as Images } from 'lucide-react/dist/esm/icons/images'
export { default as ImageUp } from 'lucide-react/dist/esm/icons/image-up'
export { default as Edit } from 'lucide-react/dist/esm/icons/edit'
export { default as Grid3x3 } from 'lucide-react/dist/esm/icons/grid-3x3'

// 特殊效果
export { default as Sparkles } from 'lucide-react/dist/esm/icons/sparkles'
export { default as Zap } from 'lucide-react/dist/esm/icons/zap'
export { default as Shuffle } from 'lucide-react/dist/esm/icons/shuffle'

// 设备和系统
export { default as Monitor } from 'lucide-react/dist/esm/icons/monitor'
export { default as Smartphone } from 'lucide-react/dist/esm/icons/smartphone'
export { default as BatteryLow } from 'lucide-react/dist/esm/icons/battery-low'
export { default as Shield } from 'lucide-react/dist/esm/icons/shield'
export { default as Wrench } from 'lucide-react/dist/esm/icons/wrench'

// 日期和日历
export { default as CalendarDays } from 'lucide-react/dist/esm/icons/calendar-days'

// 其他
export { default as Cookie } from 'lucide-react/dist/esm/icons/cookie'
export { default as Hash } from 'lucide-react/dist/esm/icons/hash'
export { default as MapPin } from 'lucide-react/dist/esm/icons/map-pin'
export { default as Sun } from 'lucide-react/dist/esm/icons/sun'
export { default as Moon } from 'lucide-react/dist/esm/icons/moon'
export { default as Camera } from 'lucide-react/dist/esm/icons/camera'
export { default as Languages } from 'lucide-react/dist/esm/icons/languages'
export { default as MessageCircle } from 'lucide-react/dist/esm/icons/message-circle'
export { default as SquarePen } from 'lucide-react/dist/esm/icons/square-pen'
export { default as Image } from 'lucide-react/dist/esm/icons/image'
export { default as Filter } from 'lucide-react/dist/esm/icons/filter'
export { default as Tags } from 'lucide-react/dist/esm/icons/tags'
export { default as Grid } from 'lucide-react/dist/esm/icons/grid-3x3'
export { default as File } from 'lucide-react/dist/esm/icons/file'
export { default as Wifi } from 'lucide-react/dist/esm/icons/wifi'
export { default as Twitter } from 'lucide-react/dist/esm/icons/twitter'
export { default as Instagram } from 'lucide-react/dist/esm/icons/instagram'
export { default as Youtube } from 'lucide-react/dist/esm/icons/youtube'
export { default as Linkedin } from 'lucide-react/dist/esm/icons/linkedin'
export { default as Facebook } from 'lucide-react/dist/esm/icons/facebook'
export { default as Github } from 'lucide-react/dist/esm/icons/github'
export { default as Save } from 'lucide-react/dist/esm/icons/save'
export { default as Plus } from 'lucide-react/dist/esm/icons/plus'
export { default as Calendar } from 'lucide-react/dist/esm/icons/calendar'
export { default as List } from 'lucide-react/dist/esm/icons/list'
export { default as Link } from 'lucide-react/dist/esm/icons/link'
export { default as Link2 } from 'lucide-react/dist/esm/icons/link-2'
export { default as MoreVertical } from 'lucide-react/dist/esm/icons/more-vertical'
export { default as Send } from 'lucide-react/dist/esm/icons/send'
export { default as MessageSquare } from 'lucide-react/dist/esm/icons/message-square'
export { default as Package } from 'lucide-react/dist/esm/icons/package'
export { default as Bell } from 'lucide-react/dist/esm/icons/bell'
export { default as HelpCircle } from 'lucide-react/dist/esm/icons/help-circle'
export { default as BookOpen } from 'lucide-react/dist/esm/icons/book-open'
export { default as FileJson } from 'lucide-react/dist/esm/icons/file-json'
export { default as Folder } from 'lucide-react/dist/esm/icons/folder'
export { default as FolderOpen } from 'lucide-react/dist/esm/icons/folder-open'
export { default as Receipt } from 'lucide-react/dist/esm/icons/receipt'
export { default as FileImage } from 'lucide-react/dist/esm/icons/file-image'
export { default as LayoutDashboard } from 'lucide-react/dist/esm/icons/layout-dashboard'
export { default as Layers } from 'lucide-react/dist/esm/icons/layers'
export { default as Package2 } from 'lucide-react/dist/esm/icons/package-2'
export { default as SquareTerminal } from 'lucide-react/dist/esm/icons/square-terminal'
export { default as Bot } from 'lucide-react/dist/esm/icons/bot'
export { default as Code2 } from 'lucide-react/dist/esm/icons/code-2'
export { default as Book } from 'lucide-react/dist/esm/icons/book'
export { default as SquareUser } from 'lucide-react/dist/esm/icons/square-user'

// 类型导出 - 保持类型兼容性
export type { LucideProps, LucideIcon } from 'lucide-react'
