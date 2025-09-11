import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { 
  Plus,
  Grid3x3,
  List,
  Search,
  Filter,
  Heart,
  Eye,
  MessageSquare,
  Share2,
  Edit,
  Trash2,
  Copy,
  MoreVertical,
  Globe,
  Lock,
  Calendar,
  TrendingUp,
  FileText,
  Loader2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Template {
  id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  is_public: boolean
  is_featured: boolean
  like_count: number
  comment_count: number
  view_count: number
  share_count: number
  created_at: string
  updated_at: string
  tags: string[]
}

type ViewMode = 'grid' | 'list'
type SortBy = 'created' | 'updated' | 'likes' | 'views' | 'name'
type FilterBy = 'all' | 'public' | 'private' | 'featured'

export default function MyTemplatesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('created')
  const [filterBy, setFilterBy] = useState<FilterBy>('all')
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user) {
      fetchTemplates()
    }
  }, [user])

  useEffect(() => {
    filterAndSortTemplates()
  }, [templates, searchQuery, sortBy, filterBy])

  const fetchTemplates = async () => {
    if (!user) return

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortTemplates = () => {
    let filtered = [...templates]

    // 搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // 状态过滤
    switch (filterBy) {
      case 'public':
        filtered = filtered.filter(t => t.is_public)
        break
      case 'private':
        filtered = filtered.filter(t => !t.is_public)
        break
      case 'featured':
        filtered = filtered.filter(t => t.is_featured)
        break
    }

    // 排序
    switch (sortBy) {
      case 'created':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'updated':
        filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        break
      case 'likes':
        filtered.sort((a, b) => b.like_count - a.like_count)
        break
      case 'views':
        filtered.sort((a, b) => b.view_count - a.view_count)
        break
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    setFilteredTemplates(filtered)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm(t('templates.confirmDelete'))) return

    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error
      
      setTemplates(prev => prev.filter(t => t.id !== templateId))
      alert(t('templates.deleteSuccess'))
    } catch (error) {
      console.error('Error deleting template:', error)
      alert(t('templates.deleteError'))
    }
  }

  const handleDuplicate = async (template: Template) => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .insert({
          ...template,
          id: undefined,
          name: `${template.name} (Copy)`,
          is_public: false,
          is_featured: false,
          like_count: 0,
          comment_count: 0,
          view_count: 0,
          share_count: 0,
          created_at: undefined,
          updated_at: undefined
        })
        .select()
        .single()

      if (error) throw error
      
      setTemplates(prev => [data, ...prev])
      alert(t('templates.duplicateSuccess'))
    } catch (error) {
      console.error('Error duplicating template:', error)
      alert(t('templates.duplicateError'))
    }
  }

  const handleTogglePublic = async (template: Template) => {
    try {
      const { error } = await supabase
        .from('templates')
        .update({ is_public: !template.is_public })
        .eq('id', template.id)

      if (error) throw error
      
      setTemplates(prev => prev.map(t => 
        t.id === template.id ? { ...t, is_public: !t.is_public } : t
      ))
    } catch (error) {
      console.error('Error toggling template visibility:', error)
    }
  }

  const handleShare = (template: Template) => {
    const url = `${window.location.origin}/templates/${template.id}`
    navigator.clipboard.writeText(url)
    alert(t('templates.linkCopied'))
  }

  const handleBatchDelete = async () => {
    if (selectedTemplates.size === 0) return
    if (!confirm(t('templates.confirmBatchDelete', { count: selectedTemplates.size }))) return

    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .in('id', Array.from(selectedTemplates))

      if (error) throw error
      
      setTemplates(prev => prev.filter(t => !selectedTemplates.has(t.id)))
      setSelectedTemplates(new Set())
      alert(t('templates.batchDeleteSuccess'))
    } catch (error) {
      console.error('Error batch deleting templates:', error)
      alert(t('templates.batchDeleteError'))
    }
  }

  const toggleSelectTemplate = (templateId: string) => {
    const newSelected = new Set(selectedTemplates)
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId)
    } else {
      newSelected.add(templateId)
    }
    setSelectedTemplates(newSelected)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('templates.myTemplates')}</h1>
        <p className="text-muted-foreground">
          {t('templates.myTemplatesDescription')}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('templates.total')}</p>
                <p className="text-2xl font-bold">{templates.length}</p>
              </div>
              <Grid3x3 className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('templates.public')}</p>
                <p className="text-2xl font-bold">
                  {templates.filter(t => t.is_public).length}
                </p>
              </div>
              <Globe className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('templates.totalViews')}</p>
                <p className="text-2xl font-bold">
                  {formatNumber(templates.reduce((sum, t) => sum + t.view_count, 0))}
                </p>
              </div>
              <Eye className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('templates.totalLikes')}</p>
                <p className="text-2xl font-bold">
                  {formatNumber(templates.reduce((sum, t) => sum + t.like_count, 0))}
                </p>
              </div>
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('templates.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterBy} onValueChange={(value: FilterBy) => setFilterBy(value)}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('templates.filterAll')}</SelectItem>
              <SelectItem value="public">{t('templates.filterPublic')}</SelectItem>
              <SelectItem value="private">{t('templates.filterPrivate')}</SelectItem>
              <SelectItem value="featured">{t('templates.filterFeatured')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
            <SelectTrigger className="w-40">
              <TrendingUp className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">{t('templates.sortByCreated')}</SelectItem>
              <SelectItem value="updated">{t('templates.sortByUpdated')}</SelectItem>
              <SelectItem value="likes">{t('templates.sortByLikes')}</SelectItem>
              <SelectItem value="views">{t('templates.sortByViews')}</SelectItem>
              <SelectItem value="name">{t('templates.sortByName')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          {selectedTemplates.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('templates.deleteSelected', { count: selectedTemplates.size })}
            </Button>
          )}
          
          <div className="flex gap-1 border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Link to="/templates/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('templates.createNew')}
            </Button>
          </Link>
        </div>
      </div>

      {/* 模板列表 */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchQuery ? t('templates.noSearchResults') : t('templates.noTemplates')}
            </p>
            <Link to="/templates/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('templates.createFirst')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="relative">
              <div className="absolute top-4 left-4 z-10">
                <input
                  type="checkbox"
                  checked={selectedTemplates.has(template.id)}
                  onChange={() => toggleSelectTemplate(template.id)}
                  className="w-4 h-4"
                />
              </div>
              
              <div className="absolute top-4 right-4 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/templates/${template.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t('common.edit')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t('templates.duplicate')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleShare(template)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      {t('common.share')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTogglePublic(template)}>
                      {template.is_public ? (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          {t('templates.makePrivate')}
                        </>
                      ) : (
                        <>
                          <Globe className="mr-2 h-4 w-4" />
                          {t('templates.makePublic')}
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleDelete(template.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link to={`/templates/${template.id}`}>
                <CardHeader className="pb-4">
                  <div className="aspect-video bg-muted rounded-md overflow-hidden mb-4">
                    {template.thumbnail_url ? (
                      <img 
                        src={template.thumbnail_url} 
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold line-clamp-1">{template.name}</h3>
                    {template.is_public ? (
                      <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
              </Link>
              
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {template.description || t('templates.noDescription')}
                </p>
                
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.slice(0, 3).map((tag, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-muted text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs text-muted-foreground">
                        +{template.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatNumber(template.view_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {formatNumber(template.like_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {formatNumber(template.comment_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="w-3 h-3" />
                    {formatNumber(template.share_count)}
                  </span>
                </div>
              </CardContent>
              
              <CardFooter className="pt-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(template.created_at)}</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates.map((template) => (
            <Card key={template.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.has(template.id)}
                    onChange={() => toggleSelectTemplate(template.id)}
                    className="w-4 h-4"
                  />
                  
                  <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                    {template.thumbnail_url ? (
                      <img 
                        src={template.thumbnail_url} 
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/templates/${template.id}`}>
                        <h3 className="font-semibold hover:underline">{template.name}</h3>
                      </Link>
                      {template.is_public ? (
                        <Globe className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                      {template.is_featured && (
                        <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                          {t('templates.featured')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {template.description || t('templates.noDescription')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {formatNumber(template.view_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {formatNumber(template.like_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {formatNumber(template.comment_count)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {formatDate(template.created_at)}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/templates/${template.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          {t('common.edit')}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                        <Copy className="mr-2 h-4 w-4" />
                        {t('templates.duplicate')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShare(template)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        {t('common.share')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTogglePublic(template)}>
                        {template.is_public ? (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            {t('templates.makePrivate')}
                          </>
                        ) : (
                          <>
                            <Globe className="mr-2 h-4 w-4" />
                            {t('templates.makePublic')}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('common.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}