import React from 'react'
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
  UrlField
} from 'react-admin'
import { Check, X } from 'lucide-react'

const TemplateFilters = [
  <SearchInput source="q" placeholder="搜索模板名称" alwaysOn />,
  <SelectInput
    source="audit_status"
    choices={[
      { id: 'pending', name: '待审核' },
      { id: 'approved', name: '已批准' },
      { id: 'rejected', name: '已拒绝' },
      { id: 'needs_revision', name: '需要修改' },
    ]}
    label="审核状态"
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
  />,
  <BooleanInput source="is_premium" label="高级模板" />,
]

const TemplateListActions = () => (
  <TopToolbar>
    <FilterButton />
    <CreateButton />
    <ExportButton />
  </TopToolbar>
)

const AuditStatusField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record) return null

  const statusLabels: Record<string, string> = {
    pending: '待审核',
    approved: '已批准',
    rejected: '已拒绝',
    needs_revision: '需要修改'
  }

  const status = record[source]
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(status)}`}>
      {statusLabels[status] || status}
    </span>
  )
}

const TemplateActionsButtons: React.FC = () => {
  const record = useRecordContext()
  const [update] = useUpdate()
  const notify = useNotify()
  const refresh = useRefresh()

  const handleApprove = () => {
    const notes = prompt('审核备注（可选）:')
    update(
      'templates',
      {
        id: record?.id,
        data: { action: 'approve', admin_notes: notes },
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
  }

  const handleReject = () => {
    const reason = prompt('请输入拒绝原因:')
    if (!reason) return

    update(
      'templates',
      {
        id: record?.id,
        data: { action: 'reject', rejection_reason: reason },
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
  }

  if (!record) return null

  return (
    <div className="flex gap-1">
      {record.audit_status === 'pending' && (
        <>
          <Button onClick={handleApprove} size="small" color="success">
            <Check /> 批准
          </Button>
          <Button onClick={handleReject} size="small" color="error">
            <X /> 拒绝
          </Button>
        </>
      )}
      <ShowButton />
      <EditButton />
      <DeleteButton />
    </div>
  )
}

export const TemplateList: React.FC = () => (
  <List
    filters={TemplateFilters}
    actions={<TemplateListActions />}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
  >
    <Datagrid
      rowClick="show"
      bulkActionButtons={false}
    >
      <TextField source="name" label="模板名称" />
      <TextField source="category" label="分类" />
      <AuditStatusField source="audit_status" />
      <BooleanField source="is_premium" label="高级模板" />
      <NumberField source="credit_cost" label="积分消耗" />
      <NumberField source="usage_count" label="使用次数" />
      <NumberField source="like_count" label="点赞数" />
      <DateField source="created_at" label="创建时间" showTime />
      <TemplateActionsButtons />
    </Datagrid>
  </List>
)

export const TemplateShow: React.FC = () => {
  const TemplateTitle = () => {
    const record = useRecordContext()
    return <span>模板详情: {record ? record.name : ''}</span>
  }

  return (
    <Show title={<TemplateTitle />}>
      <SimpleShowLayout>
        <TextField source="name" label="模板名称" />
        <TextField source="slug" label="URL标识" />
        <RichTextField source="description" label="描述" />
        <TextField source="category" label="分类" />
        <AuditStatusField source="audit_status" />
        <BooleanField source="is_premium" label="高级模板" />
        <BooleanField source="is_active" label="启用状态" />
        <BooleanField source="is_public" label="公开状态" />
        <NumberField source="credit_cost" label="积分消耗" />
        <NumberField source="usage_count" label="使用次数" />
        <NumberField source="like_count" label="点赞数" />
        <DateField source="created_at" label="创建时间" showTime />
        <DateField source="updated_at" label="更新时间" showTime />
        <ImageField source="thumbnail_url" label="缩略图" />
        <UrlField source="preview_url" label="预览视频" />
        <RichTextField source="prompt_template" label="提示词模板" />
        <RichTextField source="admin_notes" label="管理员备注" />
        <RichTextField source="rejection_reason" label="拒绝原因" />
      </SimpleShowLayout>
    </Show>
  )
}

export const TemplateEdit: React.FC = () => {
  const TemplateTitle = () => {
    const record = useRecordContext()
    return <span>编辑模板: {record ? record.name : ''}</span>
  }

  return (
    <Edit title={<TemplateTitle />}>
      <SimpleForm>
        <TextInput source="name" label="模板名称" required />
        <TextInput source="slug" label="URL标识" required />
        <TextInput source="description" label="描述" multiline rows={3} />
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
        />
        <BooleanInput source="is_premium" label="高级模板" />
        <BooleanInput source="is_active" label="启用状态" />
        <BooleanInput source="is_public" label="公开状态" />
        <NumberInput source="credit_cost" label="积分消耗" min={0} />
        <TextInput source="thumbnail_url" label="缩略图URL" />
        <TextInput source="preview_url" label="预览视频URL" />
        <TextInput source="prompt_template" label="提示词模板" multiline rows={4} />
        <TextInput source="admin_notes" label="管理员备注" multiline rows={2} />
        <TextInput source="rejection_reason" label="拒绝原因" multiline rows={2} />
      </SimpleForm>
    </Edit>
  )
}

export const TemplateCreate: React.FC = () => (
  <Create title="创建新模板">
    <SimpleForm>
      <TextInput source="name" label="模板名称" required />
      <TextInput source="slug" label="URL标识" required />
      <TextInput source="description" label="描述" multiline rows={3} />
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
      />
      <BooleanInput source="is_premium" label="高级模板" />
      <NumberInput source="credit_cost" label="积分消耗" min={0} defaultValue={10} />
      <TextInput source="thumbnail_url" label="缩略图URL" />
      <TextInput source="preview_url" label="预览视频URL" />
      <TextInput source="prompt_template" label="提示词模板" multiline rows={4} required />
      <TextInput source="parameters" label="参数配置(JSON)" multiline rows={3} defaultValue="[]" />
      <TextInput source="veo3_settings" label="Veo3设置(JSON)" multiline rows={2} defaultValue="{}" />
    </SimpleForm>
  </Create>
)