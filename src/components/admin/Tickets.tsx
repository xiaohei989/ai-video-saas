import React, { useState } from 'react'
import {
  List,
  Datagrid,
  TextField,
  DateField,
  Show,
  SimpleShowLayout,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  SearchInput,
  TopToolbar,
  FilterButton,
  useRecordContext,
  ChipField,
  ReferenceField,
  ReferenceManyField,
  ShowButton,
  EditButton,
  DeleteButton,
  ArrayField,
  SingleFieldList,
  useDataProvider,
  useRefresh,
  useNotify,
  Button,
  FunctionField,
  useRedirect,
} from 'react-admin'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'

const statusChoices = [
  { id: 'open', name: '未处理' },
  { id: 'in_progress', name: '处理中' },
  { id: 'waiting_user', name: '等待用户' },
  { id: 'resolved', name: '已解决' },
  { id: 'closed', name: '已关闭' },
]

const priorityChoices = [
  { id: 'low', name: '低' },
  { id: 'medium', name: '中' },
  { id: 'high', name: '高' },
  { id: 'urgent', name: '紧急' },
]

const StatusField: React.FC<{ source?: string; record?: any; label?: string }> = ({ record, source }) => {
  const status = record?.[source || 'status']
  const statusChoice = statusChoices.find(s => s.id === status)
  return <Badge variant="outline">{statusChoice?.name || status}</Badge>
}

const PriorityField: React.FC<{ source?: string; record?: any; label?: string }> = ({ record, source }) => {
  const priority = record?.[source || 'priority']
  const priorityChoice = priorityChoices.find(p => p.id === priority)
  const variant = priority === 'urgent' ? 'destructive' : priority === 'high' ? 'default' : 'secondary'
  return <Badge variant={variant}>{priorityChoice?.name || priority}</Badge>
}

const CustomDeleteButton: React.FC<{ record?: any }> = ({ record }) => {
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const redirect = useRedirect()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await dataProvider.delete('tickets', {
        id: record.id,
        previousData: record
      })
      notify('工单删除成功', { type: 'success' })
      redirect('/admin/tickets')
    } catch (error) {
      notify('删除失败：' + (error instanceof Error ? error.message : '未知错误'), { type: 'error' })
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
        disabled={isDeleting}
      >
        删除
      </button>
      
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">确认删除工单</h3>
            <p className="text-gray-600 mb-6">
              确定要删除工单 <strong>{record?.ticket_number}</strong> 吗？
              <br />
              <span className="text-red-600">删除后将无法恢复，包括所有相关消息。</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                disabled={isDeleting}
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const TicketFilters = [
  <SearchInput source="q" placeholder="搜索工单" alwaysOn />,
  <SelectInput
    source="status"
    choices={statusChoices}
    label="状态"
  />,
]

export const TicketList: React.FC = () => (
  <List filters={TicketFilters} sort={{ field: 'created_at', order: 'DESC' }}>
    <Datagrid rowClick="show">
      <TextField source="ticket_number" label="工单号" />
      <TextField source="subject" label="标题" />
      <FunctionField 
        label="状态"
        render={(record: any) => {
          const statusChoice = statusChoices.find(s => s.id === record?.status)
          return statusChoice?.name || record?.status || ''
        }}
      />
      <FunctionField 
        label="优先级"
        render={(record: any) => {
          const priorityChoice = priorityChoices.find(p => p.id === record?.priority)
          return priorityChoice?.name || record?.priority || ''
        }}
      />
      <TextField source="user_name" label="用户" />
      <DateField source="created_at" label="创建时间" showTime />
    </Datagrid>
  </List>
)

const MessageList: React.FC = () => {
  const record = useRecordContext()
  const messages = record?.messages || []

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>对话历史</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无对话消息</p>
        ) : (
          <div className="space-y-4">
            {messages.map((message: any, index: number) => {
              // 双重判断：检查role + 比较sender_id与工单user_id
              const isAdmin = (message.sender?.role === 'admin' || message.sender?.role === 'super_admin') ||
                             (message.sender_id !== record.user_id)
              
              // 如果sender_id等于工单user_id，则为用户消息；否则为管理员消息
              const isUserMessage = message.sender_id === record.user_id
              const isAdminMessage = !isUserMessage
              
              const senderName = isAdminMessage 
                ? (message.sender?.full_name || message.sender?.username || '管理员')
                : (record.user_name || message.sender?.full_name || message.sender?.username || '用户')
              
              return (
                <div
                  key={message.id || index}
                  className={`flex ${isAdminMessage ? 'justify-end' : 'justify-start'} w-full mb-4`}
                >
                  <div className="max-w-[70%]">
                    {/* 消息气泡 */}
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        isAdminMessage
                          ? 'bg-blue-500 text-white rounded-br-sm shadow-md'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    </div>
                    
                    {/* 消息信息 */}
                    <div className={`flex items-center gap-1 mt-1 text-xs ${
                      isAdminMessage ? 'justify-end text-blue-600' : 'justify-start text-gray-500'
                    }`}>
                      <span className="font-medium">{senderName}</span>
                      <span>•</span>
                      <span>{new Date(message.created_at).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric', 
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                      {message.is_internal && (
                        <>
                          <span>•</span>
                          <Badge variant="destructive" className="text-xs py-0 px-1 h-4">内部</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const ReplyForm: React.FC = () => {
  const record = useRecordContext()
  const dataProvider = useDataProvider()
  const refresh = useRefresh()
  const notify = useNotify()
  const [replyContent, setReplyContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyContent.trim()) return

    setIsSubmitting(true)
    try {
      await dataProvider.create('ticket-replies', {
        data: {
          ticketId: record.id,
          content: replyContent.trim(),
          isInternal
        }
      })
      
      setReplyContent('')
      setIsInternal(false)
      refresh()
      notify('回复发送成功', { type: 'success' })
    } catch (error) {
      notify('回复发送失败', { type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>回复工单</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">回复内容</label>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="请输入回复内容..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isInternal"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              disabled={isSubmitting}
              className="rounded"
            />
            <label htmlFor="isInternal" className="text-sm text-gray-700">
              内部备注（用户不可见）
            </label>
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!replyContent.trim() || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '发送中...' : '发送回复'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}


const ShowPageDeleteButton: React.FC = () => {
  const record = useRecordContext()
  const dataProvider = useDataProvider()
  const notify = useNotify()
  const redirect = useRedirect()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await dataProvider.delete('tickets', {
        id: record.id,
        previousData: record
      })
      notify('工单删除成功', { type: 'success' })
      redirect('/admin/tickets')
    } catch (error) {
      notify('删除失败：' + (error instanceof Error ? error.message : '未知错误'), { type: 'error' })
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <Button
        label="删除工单"
        onClick={() => setShowConfirm(true)}
        variant="outlined"
        color="error"
        disabled={isDeleting}
      />
      
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">确认删除工单</h3>
            <p className="text-gray-600 mb-6">
              确定要删除工单 <strong>{record?.ticket_number}</strong> 吗？
              <br />
              <span className="text-red-600">删除后将无法恢复，包括所有相关消息。</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                disabled={isDeleting}
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export const TicketShow: React.FC = () => (
  <Show actions={
    <TopToolbar>
      <EditButton />
      <ShowPageDeleteButton />
    </TopToolbar>
  }>
    <SimpleShowLayout>
      <TextField source="ticket_number" label="工单号" />
      <TextField source="subject" label="标题" />
      <FunctionField 
        label="状态"
        render={(record: any) => {
          const statusChoice = statusChoices.find(s => s.id === record?.status)
          return statusChoice?.name || record?.status || '未知'
        }}
      />
      <FunctionField 
        label="优先级"
        render={(record: any) => {
          const priorityChoice = priorityChoices.find(p => p.id === record?.priority)
          return priorityChoice?.name || record?.priority || '未知'
        }}
      />
      <TextField source="user_name" label="用户" />
      <TextField source="user_email" label="用户邮箱" />
      <DateField source="created_at" label="创建时间" showTime />
      <MessageList />
      <ReplyForm />
    </SimpleShowLayout>
  </Show>
)

export const TicketEdit: React.FC = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="ticket_number" label="工单号" disabled />
      <TextInput source="subject" label="标题" disabled />
      <SelectInput
        source="status"
        choices={statusChoices}
        label="状态"
      />
      <SelectInput
        source="priority"
        choices={priorityChoices}
        label="优先级"
      />
      <TextInput source="user_name" label="用户" disabled />
      <TextInput source="user_email" label="用户邮箱" disabled />
    </SimpleForm>
  </Edit>
)