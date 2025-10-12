/**
 * SEO Guide Generator - Admin组件入口
 * 用于管理模板的SEO优化用户指南
 */

import React from 'react'
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  BooleanField,
  DateField,
  EditButton,
  DeleteButton,
  Create,
  Edit,
  SimpleForm,
  SelectInput,
  ReferenceInput,
  AutocompleteInput,
  useRecordContext,
  useNotify,
  useRefresh,
  Toolbar,
  SaveButton,
  Button,
  TopToolbar,
  CreateButton,
  ExportButton,
  FilterButton
} from 'react-admin'
import { Card, CardContent, Chip, Box, Typography, Badge } from '@mui/material'
import {
  Search,
  TrendingUp,
  CheckCircle,
  Cancel
} from '@mui/icons-material'
import { SEOGuideFormContent } from './SEOGuideForm'

// 支持的语言列表
const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'es', name: 'Español' },
  { id: 'de', name: 'Deutsch' },
  { id: 'fr', name: 'Français' },
  { id: 'ar', name: 'العربية' }
]

/**
 * SEO评分显示组件
 */
const SEOScoreField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record) return null

  const score = record[source] || 0
  let color: 'error' | 'warning' | 'success' = 'error'
  let label = '差'

  if (score >= 80) {
    color = 'success'
    label = '优秀'
  } else if (score >= 60) {
    color = 'warning'
    label = '良好'
  }

  return (
    <Chip
      label={`${score}分 (${label})`}
      color={color}
      size="small"
      icon={<TrendingUp />}
    />
  )
}

/**
 * 关键词标签显示
 */
const KeywordsField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record || !record[source]) return null

  const keywords = record[source] as string[]
  const displayKeywords = keywords.slice(0, 3)
  const remaining = keywords.length - 3

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {displayKeywords.map((keyword: string, index: number) => (
        <Chip key={index} label={keyword} size="small" variant="outlined" />
      ))}
      {remaining > 0 && (
        <Chip label={`+${remaining}`} size="small" color="primary" variant="outlined" />
      )}
    </Box>
  )
}

/**
 * 发布状态显示
 */
const PublishStatusField: React.FC = () => {
  const record = useRecordContext()
  if (!record) return null

  return record.is_published ? (
    <Chip label="已发布" color="success" size="small" icon={<CheckCircle />} />
  ) : (
    <Chip label="草稿" color="default" size="small" icon={<Cancel />} />
  )
}

/**
 * 列表视图的过滤器
 */
const guideFilters = [
  <ReferenceInput
    key="template"
    source="template_id"
    reference="templates"
    sort={{ field: 'name', order: 'ASC' }}
    alwaysOn
  >
    <AutocompleteInput
      optionText={(record) => {
        if (!record?.name) return record?.id || '';

        // 如果 name 是 JSON 字符串，先解析它
        if (typeof record.name === 'string' && record.name.startsWith('{')) {
          try {
            const parsed = JSON.parse(record.name);
            return parsed.en || parsed.zh || parsed.ja || Object.values(parsed)[0] || record.id;
          } catch (e) {
            return record.name;
          }
        }

        // 如果 name 是对象，直接提取语言
        if (typeof record.name === 'object') {
          return record.name.en || record.name.zh || record.name.ja || Object.values(record.name)[0] || record.id;
        }

        // 如果是普通字符串，直接返回
        return record.name;
      }}
      label="模板"
    />
  </ReferenceInput>,
  <SelectInput
    key="language"
    source="language"
    choices={LANGUAGES}
    label="语言"
    alwaysOn
  />,
  <SelectInput
    key="published"
    source="is_published"
    choices={[
      { id: 'true', name: '已发布' },
      { id: 'false', name: '草稿' }
    ]}
    label="发布状态"
  />
]

/**
 * 列表工具栏
 */
const ListActions = () => (
  <TopToolbar>
    <FilterButton />
    <CreateButton label="创建SEO指南" />
    <ExportButton />
  </TopToolbar>
)

/**
 * SEO指南列表
 */
export const SEOGuideList: React.FC = () => {
  return (
    <List
      filters={guideFilters}
      actions={<ListActions />}
      sort={{ field: 'updated_at', order: 'DESC' }}
      perPage={25}
    >
      <Datagrid rowClick="edit" bulkActionButtons={false}>
        <TextField source="template.name" label="模板名称" />
        <TextField source="language" label="语言" />
        <TextField source="primary_keyword" label="主关键词" />
        <KeywordsField source="long_tail_keywords" label="长尾关键词" />
        <SEOScoreField source="seo_score" label="SEO评分" />
        <NumberField source="page_views" label="访问量" />
        <PublishStatusField label="状态" />
        <DateField source="updated_at" label="更新时间" showTime />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  )
}

/**
 * 编辑/创建表单工具栏
 */
const SEOGuideToolbar: React.FC<{ isEdit?: boolean }> = ({ isEdit }) => {
  const record = useRecordContext()
  const notify = useNotify()
  const refresh = useRefresh()

  const handlePublish = async () => {
    try {
      // 这里调用发布API
      notify('指南已发布', { type: 'success' })
      refresh()
    } catch (error) {
      notify('发布失败', { type: 'error' })
    }
  }

  return (
    <Toolbar>
      <SaveButton label="保存" />
      {isEdit && !record?.is_published && (
        <Button label="保存并发布" onClick={handlePublish} />
      )}
    </Toolbar>
  )
}

/**
 * SEO指南编辑器（AI驱动）
 */
export const SEOGuideEdit: React.FC = () => {
  return (
    <Edit>
      <SimpleForm toolbar={<SEOGuideToolbar isEdit />}>
        <SEOGuideFormContent isEdit />
      </SimpleForm>
    </Edit>
  )
}

/**
 * SEO指南创建器（AI驱动）
 */
export const SEOGuideCreate: React.FC = () => {
  return (
    <Create>
      <SimpleForm toolbar={<SEOGuideToolbar />}>
        <SEOGuideFormContent />
      </SimpleForm>
    </Create>
  )
}

export default { SEOGuideList, SEOGuideEdit, SEOGuideCreate }
