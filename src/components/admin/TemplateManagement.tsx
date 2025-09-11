import React, { useState } from 'react'
import {
  List,
  Datagrid,
  TextField,
  DateField,
  BooleanField,
  NumberField,
  Show,
  SimpleShowLayout,
  Edit,
  Create,
  SimpleForm,
  TextInput,
  BooleanInput,
  SelectInput,
  NumberInput,
  SearchInput,
  TopToolbar,
  ExportButton,
  FilterButton,
  CreateButton,
  EditButton,
  ShowButton,
  DeleteButton,
  useRecordContext,
  useUpdate,
  useNotify,
  useRefresh,
  Button,
  RichTextField,
  ImageField,
  UrlField,
  FileInput,
  FileField
} from 'react-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Check, 
  X, 
  Download, 
  Upload, 
  Play, 
  Eye, 
  FileJson, 
  Video,
  Settings as SettingsIcon
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { bulkImportTemplates, bulkExportTemplates } from '@/services/templateFileService'
import { syncAllTemplatesToFrontend } from '@/services/templateSyncService'

// 基于数据库实际结构的模板接口
interface DatabaseTemplate {
  id: string
  slug: string
  name: string
  description?: string
  thumbnail_url?: string
  preview_url?: string
  category?: string
  author_id?: string
  is_active: boolean
  is_public: boolean
  is_premium: boolean
  is_featured: boolean
  credit_cost: number
  parameters: any // JSONB
  prompt_template: string
  veo3_settings: any // JSONB
  usage_count: number
  like_count: number
  comment_count: number
  share_count: number
  view_count: number
  favorite_count: number
  tags: string[]
  source_template_id?: string
  version: string
  audit_status?: 'pending' | 'approved' | 'rejected' | 'needs_revision'
  admin_notes?: string
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  file_checksum?: string
  file_size?: number
  original_filename?: string
  featured_at?: string
  published_at?: string
  created_at: string
  updated_at: string
}

// 过滤器配置
const TemplateFilters = [
  <SearchInput source="q" placeholder="搜索模板名称或描述" alwaysOn key="search" />,
  <SelectInput
    source="audit_status"
    choices={[
      { id: 'pending', name: '待审核' },
      { id: 'approved', name: '已批准' },
      { id: 'rejected', name: '已拒绝' },
      { id: 'needs_revision', name: '需要修改' },
    ]}
    label="审核状态"
    key="audit_status"
  />,
  <SelectInput
    source="category"
    choices={[
      { id: 'asmr', name: 'ASMR' },
      { id: 'art', name: '艺术设计' },
      { id: 'nature', name: '自然风光' },
      { id: 'tech', name: '科技' },
      { id: 'lifestyle', name: '生活方式' },
      { id: 'entertainment', name: '娱乐' },
    ]}
    label="分类"
    key="category"
  />,
  <BooleanInput source="is_premium" label="高级模板" key="is_premium" />,
  <BooleanInput source="is_active" label="启用状态" key="is_active" />,
]

// 批量操作工具栏
const TemplateListActions = () => {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleBulkImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        setImporting(true)
        try {
          if (file.name.endsWith('.zip')) {
            const result = await bulkImportTemplates(file)
            toast.success(`导入完成: ${result.success}个成功, ${result.failed}个失败`)
            if (result.errors.length > 0) {
              console.error('Import errors:', result.errors)
            }
          } else if (file.name.endsWith('.json')) {
            // 单个JSON文件导入
            toast.info('请使用创建模板功能上传单个JSON文件')
          }
        } catch (error: any) {
          toast.error(`导入失败: ${error.message}`)
        } finally {
          setImporting(false)
        }
      }
    }
    input.click()
  }

  const handleBulkExport = async () => {
    setExporting(true)
    try {
      // 获取所有模板ID
      const { data: templates, error } = await supabase
        .from('templates')
        .select('id')
        .limit(1000)

      if (error) throw error

      const templateIds = templates?.map(t => t.id) || []
      
      if (templateIds.length === 0) {
        toast.warning('没有可导出的模板')
        return
      }

      const exportBlob = await bulkExportTemplates(templateIds)
      
      // 下载文件
      const url = URL.createObjectURL(exportBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `templates_export_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success(`已导出 ${templateIds.length} 个模板`)
    } catch (error: any) {
      toast.error(`导出失败: ${error.message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleSyncToFrontend = async () => {
    setSyncing(true)
    try {
      const result = await syncAllTemplatesToFrontend()
      toast.success(`同步完成: ${result.success}个成功, ${result.failed}个失败`)
      if (result.errors.length > 0) {
        console.error('Sync errors:', result.errors)
      }
    } catch (error: any) {
      toast.error(`同步失败: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <TopToolbar>
      <FilterButton />
      <CreateButton />
      <ExportButton />
      <Button 
        onClick={handleBulkImport} 
        disabled={importing}
        label={importing ? "导入中..." : "批量导入"}
      >
        <Upload />
      </Button>
      <Button 
        onClick={handleBulkExport} 
        disabled={exporting}
        label={exporting ? "导出中..." : "批量导出"}
      >
        <Download />
      </Button>
      <Button 
        onClick={handleSyncToFrontend} 
        disabled={syncing}
        label={syncing ? "同步中..." : "同步到前端"}
        variant="contained"
        color="success"
      >
        <SettingsIcon />
      </Button>
    </TopToolbar>
  )
}

// 审核状态字段组件
const AuditStatusField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record) return null

  const statusLabels: Record<string, string> = {
    pending: '待审核',
    approved: '已批准',
    rejected: '已拒绝',
    needs_revision: '需要修改'
  }

  const status = record[source] || 'pending'
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'needs_revision': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(status)}`}>
      {statusLabels[status] || status}
    </span>
  )
}

// 模板预览组件
const TemplatePreview: React.FC<{ template: DatabaseTemplate }> = ({ template }) => {
  const [showVideo, setShowVideo] = useState(false)

  if (!template) {
    return (
      <div className="text-center text-gray-500">
        模板数据不可用
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 缩略图 */}
      <div className="w-full">
        <label className="block text-sm font-medium mb-2">缩略图</label>
        {template.thumbnail_url ? (
          <img 
            src={template.thumbnail_url} 
            alt={template.name}
            className="w-full max-w-xs h-32 object-cover rounded-lg border"
          />
        ) : (
          <div className="w-full max-w-xs h-32 bg-gray-100 rounded-lg border flex items-center justify-center">
            <FileJson className="h-8 w-8 text-gray-400" />
            <span className="text-sm text-gray-500 ml-2">暂无缩略图</span>
          </div>
        )}
      </div>

      {/* 预览视频 */}
      <div className="w-full">
        <label className="block text-sm font-medium mb-2">预览视频</label>
        {template.preview_url ? (
          <div className="space-y-2">
            <Button
              onClick={() => setShowVideo(!showVideo)}
              size="small"
              variant="outlined"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {showVideo ? '隐藏视频' : '播放预览'}
            </Button>
            {showVideo && (
              <video 
                src={template.preview_url}
                controls
                className="w-full max-w-md rounded-lg border"
                poster={template.thumbnail_url}
              >
                您的浏览器不支持视频播放
              </video>
            )}
            <p className="text-xs text-gray-500">
              文件路径: {template.preview_url}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-xs h-32 bg-gray-100 rounded-lg border flex items-center justify-center">
            <Video className="h-8 w-8 text-gray-400" />
            <span className="text-sm text-gray-500 ml-2">暂无预览视频</span>
          </div>
        )}
      </div>
    </div>
  )
}

// 模板参数显示组件（适配数据库JSONB格式）
const TemplateParametersField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record) return null

  const parameters = record[source]
  
  // 处理JSONB数据 - 可能是对象或数组格式
  let paramArray: any[] = []
  
  if (Array.isArray(parameters)) {
    paramArray = parameters
  } else if (parameters && typeof parameters === 'object') {
    // 转换对象格式为数组格式
    paramArray = Object.entries(parameters).map(([key, value]: [string, any]) => ({
      name: key,
      ...value
    }))
  } else {
    return <span className="text-gray-500">暂无参数</span>
  }

  if (paramArray.length === 0) {
    return <span className="text-gray-500">暂无参数</span>
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {paramArray.map((param: any, index: number) => (
        <div key={index} className="bg-gray-50 p-3 rounded border">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm">
              {param.name || param.label || `参数${index + 1}`}
            </span>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {param.type || 'text'}
              </Badge>
              {param.required && (
                <Badge variant="destructive" className="text-xs">必需</Badge>
              )}
            </div>
          </div>
          
          {param.label && param.label !== param.name && (
            <p className="text-xs text-blue-600 mb-1">显示名: {param.label}</p>
          )}
          
          {param.description && (
            <p className="text-xs text-gray-600 mb-2">{param.description}</p>
          )}
          
          {param.options && Array.isArray(param.options) && (
            <div className="text-xs text-gray-500">
              选项: {param.options.slice(0, 3).map((opt: any) => opt.label || opt.value).join(', ')}
              {param.options.length > 3 && ` (+${param.options.length - 3}项)`}
            </div>
          )}
          
          {param.default && (
            <div className="text-xs text-green-600">
              默认值: {typeof param.default === 'string' ? param.default : JSON.stringify(param.default)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// 模板操作下拉菜单
const TemplateActionsButtons: React.FC = () => {
  const record = useRecordContext()
  const [update] = useUpdate()
  const notify = useNotify()
  const refresh = useRefresh()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleApprove = () => {
    const notes = prompt('审核备注（可选）:')
    update(
      'templates',
      {
        id: record?.id,
        data: { 
          audit_status: 'approved',
          admin_notes: notes,
          is_public: true,
          reviewed_at: new Date().toISOString()
        },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify('模板已批准', { type: 'success' })
          refresh()
        },
        onError: (error: any) => {
          notify(`批准失败: ${error.message}`, { type: 'error' })
        },
      }
    )
    setMenuOpen(false)
  }

  const handleReject = () => {
    const reason = prompt('请输入拒绝原因:')
    if (!reason) return

    update(
      'templates',
      {
        id: record?.id,
        data: { 
          audit_status: 'rejected',
          rejection_reason: reason,
          is_public: false,
          reviewed_at: new Date().toISOString()
        },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify('模板已拒绝', { type: 'success' })
          refresh()
        },
        onError: (error: any) => {
          notify(`拒绝失败: ${error.message}`, { type: 'error' })
        },
      }
    )
    setMenuOpen(false)
  }

  const handleToggleActive = () => {
    update(
      'templates',
      {
        id: record?.id,
        data: { is_active: !record?.is_active },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify(record?.is_active ? '模板已禁用' : '模板已启用', { type: 'success' })
          refresh()
        },
        onError: (error: any) => {
          notify(`操作失败: ${error.message}`, { type: 'error' })
        },
      }
    )
    setMenuOpen(false)
  }

  if (!record) return null

  return (
    <div className="relative">
      <Button
        onClick={() => setMenuOpen(!menuOpen)}
        size="small"
        variant="outlined"
        className="flex items-center gap-1"
      >
        操作
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            {record.audit_status === 'pending' && (
              <>
                <button
                  onClick={handleApprove}
                  className="flex items-center w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                >
                  <Check className="h-4 w-4 mr-2" />
                  批准
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  拒绝
                </button>
                <hr className="my-1" />
              </>
            )}
            
            <button
              onClick={handleToggleActive}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <SettingsIcon className="h-4 w-4 mr-2" />
              {record.is_active ? '禁用' : '启用'}
            </button>

            {record.preview_url && (
              <button
                onClick={() => {
                  window.open(record.preview_url, '_blank')
                  setMenuOpen(false)
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                预览视频
              </button>
            )}

            <hr className="my-1" />
            
            <div className="flex items-center justify-around py-2">
              <ShowButton />
              <EditButton />
              <DeleteButton />
            </div>
          </div>
        </div>
      )}

      {/* 点击外部关闭菜单 */}
      {menuOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}

// 模板列表组件
export const TemplateList: React.FC = () => (
  <List
    filters={TemplateFilters}
    actions={<TemplateListActions />}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
    title="模板管理"
  >
    <Datagrid
      rowClick="show"
      bulkActionButtons={false}
    >
      {/* 缩略图预览 */}
      <ImageField 
        source="thumbnail_url" 
        label="缩略图"
        className="w-16 h-12 object-cover rounded"
      />
      
      {/* 基本信息 */}
      <TextField source="name" label="模板名称" />
      <TextField source="slug" label="标识符" />
      <TextField source="category" label="分类" />
      
      {/* 状态信息 */}
      <AuditStatusField source="audit_status" />
      <BooleanField source="is_active" label="启用" />
      
      {/* 统计信息 */}
      <NumberField source="usage_count" label="使用数" />
      <NumberField source="like_count" label="点赞" />
      
      {/* 时间信息 */}
      <DateField source="created_at" label="创建时间" showTime />
      
      {/* 操作按钮 */}
      <TemplateActionsButtons />
    </Datagrid>
  </List>
)

// 模板详情显示组件
export const TemplateShow: React.FC = () => {
  const TemplateTitle = () => {
    const record = useRecordContext()
    return <span>模板详情: {record ? record.name : ''}</span>
  }

  return (
    <Show title={<TemplateTitle />}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要信息 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleShowLayout>
                <TextField source="name" label="模板名称" />
                <TextField source="slug" label="URL标识" />
                <RichTextField source="description" label="描述" />
                <TextField source="category" label="分类" />
                <TextField source="version" label="版本" />
                <AuditStatusField source="audit_status" />
                
                {/* 状态标识组 */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                  <BooleanField source="is_premium" label="高级模板" />
                  <BooleanField source="is_active" label="启用状态" />
                  <BooleanField source="is_public" label="公开状态" />
                  <BooleanField source="is_featured" label="推荐模板" />
                </div>
                
                <NumberField source="credit_cost" label="积分消耗" />
                <TextField source="author_id" label="创建者ID" />
                <TextField source="reviewed_by" label="审核者ID" />
                
                {/* 标签显示 */}
                <div>
                  <h4 className="font-medium mb-2">标签</h4>
                  <TextField source="tags" />
                </div>
                
                <DateField source="reviewed_at" label="审核时间" showTime />
                <DateField source="featured_at" label="推荐时间" showTime />
                <DateField source="published_at" label="发布时间" showTime />
                <DateField source="created_at" label="创建时间" showTime />
                <DateField source="updated_at" label="更新时间" showTime />
              </SimpleShowLayout>
            </CardContent>
          </Card>

          {/* 模板配置 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>模板配置</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleShowLayout>
                <div className="space-y-4">
                  {/* 参数配置 */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      参数配置
                    </h4>
                    <TemplateParametersField source="parameters" />
                  </div>

                  {/* 提示词模板 */}
                  <div>
                    <h4 className="font-medium mb-2">提示词模板</h4>
                    <div className="bg-gray-50 p-3 rounded font-mono text-sm">
                      <RichTextField source="prompt_template" />
                    </div>
                  </div>

                  {/* Veo3设置 */}
                  <div>
                    <h4 className="font-medium mb-2">Veo3设置</h4>
                    <div className="bg-gray-50 p-3 rounded font-mono text-sm">
                      <TextField source="veo3_settings" />
                    </div>
                  </div>
                </div>
              </SimpleShowLayout>
            </CardContent>
          </Card>

          {/* 审核信息 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>审核信息</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleShowLayout>
                <RichTextField source="admin_notes" label="管理员备注" />
                <RichTextField source="rejection_reason" label="拒绝原因" />
                <DateField source="reviewed_at" label="审核时间" showTime />
              </SimpleShowLayout>
            </CardContent>
          </Card>
        </div>

        {/* 媒体文件和统计信息 */}
        <div className="space-y-6">
          {/* 媒体预览 */}
          <Card>
            <CardHeader>
              <CardTitle>媒体文件</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const record = useRecordContext()
                return record ? (
                  <TemplatePreview template={record as DatabaseTemplate} />
                ) : (
                  <div className="text-center text-gray-500">
                    加载模板信息中...
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* 使用统计 */}
          <Card>
            <CardHeader>
              <CardTitle>使用统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <NumberField source="usage_count" label="" />
                  <p className="text-sm text-gray-600">使用次数</p>
                </div>
                <div className="text-center">
                  <NumberField source="like_count" label="" />
                  <p className="text-sm text-gray-600">点赞数</p>
                </div>
                <div className="text-center">
                  <NumberField source="view_count" label="" />
                  <p className="text-sm text-gray-600">浏览数</p>
                </div>
                <div className="text-center">
                  <NumberField source="favorite_count" label="" />
                  <p className="text-sm text-gray-600">收藏数</p>
                </div>
                <div className="text-center">
                  <NumberField source="comment_count" label="" />
                  <p className="text-sm text-gray-600">评论数</p>
                </div>
                <div className="text-center">
                  <NumberField source="share_count" label="" />
                  <p className="text-sm text-gray-600">分享数</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 文件信息 */}
          <Card>
            <CardHeader>
              <CardTitle>文件信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">文件大小:</span>
                  <TextField source="file_size" label="" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">文件校验:</span>
                  <TextField source="file_checksum" label="" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">原始文件名:</span>
                  <TextField source="original_filename" label="" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">缩略图URL:</span>
                  <div className="text-xs text-blue-600 break-all max-w-xs">
                    <UrlField source="thumbnail_url" label="" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">预览视频URL:</span>
                  <div className="text-xs text-blue-600 break-all max-w-xs">
                    <UrlField source="preview_url" label="" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Show>
  )
}

// 模板编辑组件
export const TemplateEdit: React.FC = () => {
  const TemplateTitle = () => {
    const record = useRecordContext()
    return <span>编辑模板: {record ? record.name : ''}</span>
  }

  return (
    <Edit title={<TemplateTitle />}>
      <SimpleForm>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">基本信息</h3>
            <TextInput source="name" label="模板名称" required fullWidth />
            <TextInput source="slug" label="URL标识" required fullWidth />
            <TextInput source="description" label="描述" multiline rows={3} fullWidth />
            <SelectInput
              source="category"
              choices={[
                { id: 'asmr', name: 'ASMR' },
                { id: 'art', name: '艺术设计' },
                { id: 'nature', name: '自然风光' },
                { id: 'tech', name: '科技' },
                { id: 'lifestyle', name: '生活方式' },
                { id: 'entertainment', name: '娱乐' },
              ]}
              label="分类"
              required
              fullWidth
            />
            
            <div className="grid grid-cols-2 gap-4">
              <BooleanInput source="is_premium" label="高级模板" />
              <BooleanInput source="is_active" label="启用状态" />
              <BooleanInput source="is_public" label="公开状态" />
              <NumberInput source="credit_cost" label="积分消耗" min={0} />
            </div>
          </div>

          {/* 审核信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">审核管理</h3>
            <SelectInput
              source="audit_status"
              choices={[
                { id: 'pending', name: '待审核' },
                { id: 'approved', name: '已批准' },
                { id: 'rejected', name: '已拒绝' },
                { id: 'needs_revision', name: '需要修改' },
              ]}
              label="审核状态"
              fullWidth
            />
            <TextInput source="admin_notes" label="管理员备注" multiline rows={2} fullWidth />
            <TextInput source="rejection_reason" label="拒绝原因" multiline rows={2} fullWidth />
          </div>
        </div>

        {/* 媒体文件 */}
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">媒体文件</h3>
          
          {/* 文件上传 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FileInput 
              source="thumbnail_file" 
              label="更新缩略图" 
              accept={{"image/*": []}}
              placeholder="选择新的缩略图文件"
            >
              <FileField source="src" title="title" />
            </FileInput>

            <FileInput 
              source="preview_file" 
              label="更新预览视频" 
              accept={{"video/*": []}}
              placeholder="选择新的预览视频文件"
            >
              <FileField source="src" title="title" />
            </FileInput>
          </div>

          {/* 当前文件URL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TextInput source="thumbnail_url" label="当前缩略图URL" fullWidth disabled />
            <TextInput source="preview_url" label="当前预览视频URL" fullWidth disabled />
          </div>
        </div>

        {/* 模板配置 */}
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">模板配置</h3>
          <TextInput 
            source="prompt_template" 
            label="提示词模板" 
            multiline 
            rows={4} 
            required 
            fullWidth
            helperText="使用 {参数名} 作为占位符"
          />
          <TextInput 
            source="parameters" 
            label="参数配置(JSON)" 
            multiline 
            rows={6} 
            fullWidth
            helperText="JSON格式的参数配置数组"
          />
          <TextInput 
            source="veo3_settings" 
            label="Veo3设置(JSON)" 
            multiline 
            rows={3} 
            fullWidth
            helperText="Veo3 API的特殊设置"
          />
        </div>
      </SimpleForm>
    </Edit>
  )
}

// 模板创建组件
export const TemplateCreate: React.FC = () => {
  // TODO: 实现文件上传功能时重新启用这些状态
  // const [jsonFile, setJsonFile] = useState<File | null>(null)
  // const [videoFile, setVideoFile] = useState<File | null>(null)

  return (
    <Create title="创建新模板">
      <SimpleForm>
        <div className="space-y-6">
          {/* 文件上传区域 */}
          <Card>
            <CardHeader>
              <CardTitle>文件上传</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* JSON配置文件上传 */}
                <FileInput 
                  source="config_file" 
                  label="配置文件(JSON)" 
                  accept={{".json": []}}           
                  placeholder="选择JSON配置文件"
                >
                  <FileField source="src" title="title" />
                </FileInput>

                {/* 缩略图上传 */}
                <FileInput 
                  source="thumbnail_file" 
                  label="缩略图" 
                  accept={{"image/*": []}}
                  placeholder="选择缩略图"
                >
                  <FileField source="src" title="title" />
                </FileInput>

                {/* 预览视频上传 */}
                <FileInput 
                  source="preview_file" 
                  label="预览视频" 
                  accept={{"video/*": []}}
                  placeholder="选择预览视频"
                >
                  <FileField source="src" title="title" />
                </FileInput>
              </div>
              
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm text-blue-800">
                  💡 提示: 上传JSON配置文件将自动填充下方表单字段。视频和图片文件将上传到云存储。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 基本信息表单 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">基本信息</h3>
              <TextInput source="name" label="模板名称" required fullWidth />
              <TextInput source="slug" label="URL标识" required fullWidth />
              <TextInput source="description" label="描述" multiline rows={3} fullWidth />
              <SelectInput
                source="category"
                choices={[
                  { id: 'asmr', name: 'ASMR' },
                  { id: 'art', name: '艺术设计' },
                  { id: 'nature', name: '自然风光' },
                  { id: 'tech', name: '科技' },
                  { id: 'lifestyle', name: '生活方式' },
                  { id: 'entertainment', name: '娱乐' },
                ]}
                label="分类"
                required
                fullWidth
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">设置选项</h3>
              <div className="grid grid-cols-2 gap-4">
                <BooleanInput source="is_premium" label="高级模板" defaultValue={false} />
                <BooleanInput source="is_active" label="启用状态" defaultValue={true} />
                <BooleanInput source="is_public" label="公开状态" defaultValue={true} />
                <BooleanInput source="is_featured" label="推荐模板" defaultValue={false} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <NumberInput source="credit_cost" label="积分消耗" min={0} defaultValue={10} />
                <TextInput source="version" label="版本号" defaultValue="1.0.0" />
              </div>
              
              <TextInput 
                source="tags" 
                label="标签 (逗号分隔)" 
                fullWidth 
                helperText="例如: asmr,艺术,创意,咖啡"
              />
              
              <TextInput source="thumbnail_url" label="缩略图URL" fullWidth />
              <TextInput source="preview_url" label="预览视频URL" fullWidth />
            </div>
          </div>

          {/* 模板配置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">模板配置</h3>
            <TextInput 
              source="prompt_template" 
              label="提示词模板" 
              multiline 
              rows={4} 
              required 
              fullWidth
              helperText="使用 {参数名} 作为占位符，例如：{user_text}, {user_image}"
            />
            <TextInput 
              source="parameters" 
              label="参数配置(JSON)" 
              multiline 
              rows={8} 
              fullWidth
              defaultValue={JSON.stringify([
                {
                  "name": "user_text",
                  "type": "text", 
                  "label": "用户输入文本",
                  "description": "用户可以输入的文本内容",
                  "required": true
                },
                {
                  "name": "user_image",
                  "type": "image",
                  "label": "用户上传图片", 
                  "description": "用户可以上传的图片",
                  "required": false
                }
              ], null, 2)}
              helperText="JSON格式的参数配置数组"
            />
            <TextInput 
              source="veo3_settings" 
              label="Veo3设置(JSON)" 
              multiline 
              rows={3} 
              fullWidth
              defaultValue={JSON.stringify({
                "duration": 5,
                "resolution": "720p",
                "style": "realistic"
              }, null, 2)}
              helperText="Veo3 API的特殊设置"
            />
          </div>
        </div>
      </SimpleForm>
    </Create>
  )
}