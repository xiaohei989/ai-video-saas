import React, { useState, useEffect } from 'react'
import {
  List,
  Datagrid,
  TextField,
  DateField,
  Edit,
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  useRecordContext,
  TopToolbar,
  CreateButton,
  EditButton,
  Button
} from 'react-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface SystemSetting {
  id: string
  setting_key: string
  setting_value: any
  description: string
  category: string
}

const SettingsListActions = () => (
  <TopToolbar>
    <CreateButton />
  </TopToolbar>
)

const SettingValueField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record) return null

  const value = record[source]
  
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-600' : 'text-red-600'}>{value ? '启用' : '禁用'}</span>
  }
  
  return <span>{String(value)}</span>
}

export const SystemSettingsList: React.FC = () => (
  <List actions={<SettingsListActions />} sort={{ field: 'category', order: 'ASC' }}>
    <Datagrid rowClick="edit">
      <TextField source="setting_key" label="设置键" />
      <TextField source="description" label="描述" />
      <SettingValueField source="setting_value" />
      <TextField source="category" label="分类" />
      <DateField source="updated_at" label="更新时间" showTime />
      <EditButton />
    </Datagrid>
  </List>
)

export const SystemSettingsEdit: React.FC = () => {
  const SettingTitle = () => {
    const record = useRecordContext()
    return <span>编辑设置: {record ? record.setting_key : ''}</span>
  }

  return (
    <Edit title={<SettingTitle />}>
      <SimpleForm>
        <TextInput source="setting_key" label="设置键" disabled />
        <TextInput source="description" label="描述" disabled />
        <TextInput source="category" label="分类" disabled />
        <TextInput source="setting_value" label="设置值" required />
      </SimpleForm>
    </Edit>
  )
}

export const SystemSettingsCreate: React.FC = () => (
  <Create title="创建新设置">
    <SimpleForm>
      <TextInput source="setting_key" label="设置键" required />
      <TextInput source="description" label="描述" required />
      <SelectInput
        source="category"
        choices={[
          { id: 'general', name: '常规设置' },
          { id: 'performance', name: '性能设置' },
          { id: 'limits', name: '限制设置' },
          { id: 'security', name: '安全设置' },
          { id: 'credits', name: '积分设置' },
        ]}
        label="分类"
        required
      />
      <TextInput source="setting_value" label="设置值" required />
    </SimpleForm>
  </Create>
)

// 保留原有的系统设置管理组件，但作为独立页面
export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true })

      if (error) throw error
      setSettings(data || [])
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('加载设置失败')
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = async (key: string, value: any) => {
    setSaving(key)
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: value })
        .eq('setting_key', key)

      if (error) throw error
      
      setSettings(prev => prev.map(setting => 
        setting.setting_key === key 
          ? { ...setting, setting_value: value }
          : setting
      ))
      
      toast.success('设置已更新')
    } catch (error) {
      console.error('Failed to update setting:', error)
      toast.error('更新设置失败')
    } finally {
      setSaving(null)
    }
  }

  const groupSettingsByCategory = (settings: SystemSetting[]) => {
    const grouped: Record<string, SystemSetting[]> = {}
    settings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = []
      }
      grouped[setting.category].push(setting)
    })
    return grouped
  }

  const renderSettingInput = (setting: SystemSetting) => {
    const value = setting.setting_value

    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{setting.description}</h4>
            <p className="text-sm text-gray-600">{setting.setting_key}</p>
          </div>
          <Button
            onClick={() => updateSetting(setting.setting_key, !value)}
            disabled={saving === setting.setting_key}
            variant={value ? "contained" : "outlined"}
            size="small"
          >
            {value ? '启用' : '禁用'}
          </Button>
        </div>
      )
    }

    if (typeof value === 'number') {
      return (
        <div className="space-y-2">
          <div>
            <h4 className="font-medium">{setting.description}</h4>
            <p className="text-sm text-gray-600">{setting.setting_key}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              defaultValue={value}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement
                  updateSetting(setting.setting_key, parseInt(target.value))
                }
              }}
            />
            <Button
              onClick={(e) => {
                const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                updateSetting(setting.setting_key, parseInt(input.value))
              }}
              disabled={saving === setting.setting_key}
              size="small"
            >
              更新
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div>
          <h4 className="font-medium">{setting.description}</h4>
          <p className="text-sm text-gray-600">{setting.setting_key}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            defaultValue={value}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement
                updateSetting(setting.setting_key, target.value)
              }
            }}
          />
          <Button
            onClick={(e) => {
              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
              updateSetting(setting.setting_key, input.value)
            }}
            disabled={saving === setting.setting_key}
            size="small"
          >
            更新
          </Button>
        </div>
      </div>
    )
  }

  const categoryTitles: Record<string, string> = {
    general: '常规设置',
    performance: '性能设置',
    limits: '限制设置',
    security: '安全设置',
    credits: '积分设置'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const groupedSettings = groupSettingsByCategory(settings)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">系统设置</h1>
      
      {Object.entries(groupedSettings).map(([category, categorySettings]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{categoryTitles[category] || category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {categorySettings.map(setting => (
              <div key={setting.setting_key} className="border-b border-gray-200 pb-4 last:border-b-0">
                {renderSettingInput(setting)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}