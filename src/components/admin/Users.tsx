import React from 'react'
import {
  List,
  Datagrid,
  TextField,
  EmailField,
  DateField,
  BooleanField,
  NumberField,
  Show,
  SimpleShowLayout,
  Edit,
  SimpleForm,
  TextInput,
  BooleanInput,
  SelectInput,
  SearchInput,
  TopToolbar,
  ExportButton,
  FilterButton,
  EditButton,
  ShowButton,
  useRecordContext,
  useUpdate,
  useNotify,
  useRefresh,
  Button,
  ReferenceManyField
} from 'react-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserX, UserCheck, MapPin, CreditCard, Video, FileText } from 'lucide-react'

const VideoStatsField = () => {
  const record = useRecordContext()
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600">
        总视频数: <span className="font-medium">{(record as any)?.video_count || 0}</span>
      </div>
      <div className="text-sm text-gray-600">
        今日生成: <span className="font-medium">{(record as any)?.videos_today || 0}</span>
      </div>
    </div>
  )
}

const UserFilters = [
  <SearchInput source="q" placeholder="搜索用户名或邮箱" alwaysOn />,
  <SelectInput
    source="role"
    choices={[
      { id: 'user', name: '普通用户' },
      { id: 'admin', name: '管理员' },
      { id: 'super_admin', name: '超级管理员' },
    ]}
    label="角色"
  />,
  <BooleanInput source="is_banned" label="封禁状态" />,
  <TextInput source="registration_country" label="注册国家" />,
]

const UserListActions = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
  </TopToolbar>
)

const BanUserButton: React.FC = () => {
  const record = useRecordContext()
  const [update] = useUpdate()
  const notify = useNotify()
  const refresh = useRefresh()

  const handleBan = () => {
    if (!record?.id) return
    const reason = prompt('请输入封禁原因:')
    if (!reason) return

    update(
      'users',
      {
        id: record.id,
        data: { action: 'ban', reason },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify('用户已封禁', { type: 'success' })
          refresh()
        },
        onError: (error) => {
          notify(`封禁失败: ${error.message}`, { type: 'error' })
        },
      }
    )
  }

  const handleUnban = () => {
    if (!record?.id) return
    update(
      'users',
      {
        id: record.id,
        data: { action: 'unban' },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify('用户已解封', { type: 'success' })
          refresh()
        },
        onError: (error) => {
          notify(`解封失败: ${error.message}`, { type: 'error' })
        },
      }
    )
  }

  if (!record) return null

  return record.is_banned ? (
    <Button onClick={handleUnban} size="small" color="success">
      <UserCheck /> 解封
    </Button>
  ) : (
    <Button onClick={handleBan} size="small" color="error">
      <UserX /> 封禁
    </Button>
  )
}

const RoleField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record) return null

  const roleLabels: Record<string, string> = {
    user: '普通用户',
    admin: '管理员',
    super_admin: '超级管理员'
  }

  const roleColors: Record<string, string> = {
    user: 'bg-gray-100 text-gray-800',
    admin: 'bg-yellow-100 text-yellow-800',
    super_admin: 'bg-red-100 text-red-800'
  }

  const role = record[source]
  return (
    <span className={`px-2 py-1 text-xs rounded ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>
      {roleLabels[role] || role}
    </span>
  )
}

const CountryField: React.FC<{ source: string }> = ({ source }) => {
  const record = useRecordContext()
  if (!record || !record[source]) return <span>-</span>

  return (
    <div className="flex items-center gap-1">
      <MapPin className="h-3 w-3" />
      <span>{record[source]}</span>
    </div>
  )
}

export const UserList: React.FC = () => (
  <List
    filters={UserFilters}
    actions={<UserListActions />}
    sort={{ field: 'created_at', order: 'DESC' }}
    perPage={25}
  >
    <Datagrid
      rowClick="show"
      bulkActionButtons={false}
    >
      <TextField source="username" label="用户名" />
      <EmailField source="email" label="邮箱" />
      <RoleField source="role" />
      <NumberField source="credits" label="积分余额" />
      <BooleanField source="is_banned" label="封禁状态" />
      <CountryField source="registration_country" />
      <DateField source="created_at" label="注册时间" showTime />
      <DateField source="last_active_at" label="最后活跃" showTime />
      <ShowButton />
      <EditButton />
      <BanUserButton />
    </Datagrid>
  </List>
)

export const UserShow: React.FC = () => {
  const UserTitle = () => {
    const record = useRecordContext()
    return <span>用户详情: {record ? record.username || record.email : ''}</span>
  }

  return (
    <Show title={<UserTitle />}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本信息 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleShowLayout>
                <TextField source="username" label="用户名" />
                <EmailField source="email" label="邮箱" />
                <TextField source="full_name" label="姓名" />
                <RoleField source="role" />
                <BooleanField source="is_banned" label="封禁状态" />
                <TextField source="banned_reason" label="封禁原因" />
                <DateField source="banned_at" label="封禁时间" showTime />
                <NumberField source="credits" label="积分余额" />
                <NumberField source="total_credits_earned" label="累计获得积分" />
                <NumberField source="total_credits_spent" label="累计消费积分" />
                <TextField source="referral_code" label="邀请码" />
                <DateField source="created_at" label="注册时间" showTime />
                <DateField source="last_active_at" label="最后活跃" showTime />
              </SimpleShowLayout>
            </CardContent>
          </Card>

          {/* IP和设备信息 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>IP和设备信息</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleShowLayout>
                <TextField source="registration_ip" label="注册IP" />
                <CountryField source="registration_country" />
                <TextField source="last_login_ip" label="最后登录IP" />
                <CountryField source="last_login_country" />
              </SimpleShowLayout>
            </CardContent>
          </Card>

          {/* 订阅信息 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>订阅信息</CardTitle>
            </CardHeader>
            <CardContent>
              <ReferenceManyField
                reference="subscriptions"
                target="user_id"
                label="订阅历史"
              >
                <Datagrid>
                  <TextField source="tier" label="订阅等级" />
                  <TextField source="status" label="状态" />
                  <DateField source="current_period_start" label="开始时间" showTime />
                  <DateField source="current_period_end" label="结束时间" showTime />
                  <BooleanField source="cancel_at_period_end" label="到期取消" />
                </Datagrid>
              </ReferenceManyField>
            </CardContent>
          </Card>
        </div>

        {/* 统计信息 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                视频统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VideoStatsField />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                模板统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <TextField source="template_count" label="创建模板数" />
                <NumberField source="total_likes_received" label="获得点赞" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                支付统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <NumberField source="total_payment" label="总支付金额" />
                <NumberField source="payment_count" label="支付次数" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Show>
  )
}

export const UserEdit: React.FC = () => {
  const UserTitle = () => {
    const record = useRecordContext()
    return <span>编辑用户: {record ? record.username || record.email : ''}</span>
  }

  return (
    <Edit title={<UserTitle />}>
      <SimpleForm>
        <TextInput source="username" label="用户名" />
        <TextInput source="full_name" label="姓名" />
        <SelectInput
          source="role"
          choices={[
            { id: 'user', name: '普通用户' },
            { id: 'admin', name: '管理员' },
            { id: 'super_admin', name: '超级管理员' },
          ]}
          label="角色"
        />
        <NumberField source="credits" label="积分余额" />
        <BooleanInput source="is_banned" label="封禁状态" />
        <TextInput source="banned_reason" label="封禁原因" multiline />
      </SimpleForm>
    </Edit>
  )
}