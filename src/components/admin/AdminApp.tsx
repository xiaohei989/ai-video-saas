import React from 'react'
import { Admin, Resource, ListGuesser, ShowGuesser } from 'react-admin'
import { adminDataProvider } from '@/services/adminDataProvider'
import { adminAuthProvider } from '@/services/adminAuthProvider'
import { Dashboard } from './Dashboard'
import { UserList, UserShow, UserEdit } from './Users'
import { TemplateList, TemplateEdit, TemplateCreate, TemplateShow } from './TemplateManagement'
import { TicketList, TicketShow, TicketEdit } from './Tickets'
import { FAQList, FAQEdit, FAQCreate } from './FAQ'
import { SystemSettingsList, SystemSettingsEdit, SystemSettingsCreate } from './SystemSettings'
import { OrderList, OrderShow } from './Orders'
import AdminDebug from './AdminDebug'
import ErrorBoundary from './ErrorBoundary'
import AdminThumbnailManager from './AdminThumbnailManager'

// 图标
import {
  Users,
  FileImage,
  MessageCircle,
  HelpCircle,
  Settings,
  FileText,
  Receipt
} from 'lucide-react'

const AdminApp: React.FC = () => {
  // 添加调试信息
  console.log('[AdminApp] Current URL:', window.location.href)
  console.log('[AdminApp] Pathname:', window.location.pathname)
  console.log('[AdminApp] Hash:', window.location.hash)
  
  return (
    <ErrorBoundary>
      <Admin
        dataProvider={adminDataProvider}
        authProvider={adminAuthProvider}
        dashboard={Dashboard}
        basename="/admin"
        title="AI视频SaaS管理后台"
        theme={{
          palette: {
            primary: {
              main: '#2563eb',
            },
            secondary: {
              main: '#7c3aed',
            },
          },
          typography: {
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
        }}
      >
      {/* 注意：dashboard不需要Resource，由dashboard prop处理 */}

      {/* 用户管理 */}
      <Resource
        name="users"
        list={UserList}
        show={UserShow}
        edit={UserEdit}
        options={{ 
          label: '用户管理'
        }}
        icon={Users}
      />

      {/* 订单管理 */}
      <Resource
        name="orders"
        list={OrderList}
        show={OrderShow}
        options={{ 
          label: '订单管理'
        }}
        icon={Receipt}
      />

      {/* 模板管理 */}
      <Resource
        name="templates"
        list={TemplateList}
        show={TemplateShow}
        edit={TemplateEdit}
        create={TemplateCreate}
        options={{ 
          label: '模板管理'
        }}
        icon={FileImage}
      />

      {/* 缩略图管理（自定义页，集成工具入口） */}
      <Resource
        name="thumbnails"
        list={AdminThumbnailManager}
        options={{ label: '缩略图管理' }}
        icon={FileImage}
      />

      {/* 工单管理 */}
      <Resource
        name="tickets"
        list={TicketList}
        show={TicketShow}
        edit={TicketEdit}
        options={{ 
          label: '工单系统'
        }}
        icon={MessageCircle}
      />

      {/* FAQ管理 */}
      <Resource
        name="faqs"
        list={FAQList}
        edit={FAQEdit}
        create={FAQCreate}
        options={{ 
          label: 'FAQ管理'
        }}
        icon={HelpCircle}
      />

      {/* 系统设置 */}
      <Resource
        name="settings"
        list={SystemSettingsList}
        edit={SystemSettingsEdit}
        create={SystemSettingsCreate}
        options={{ 
          label: '系统设置'
        }}
        icon={Settings}
      />

      {/* 操作日志 */}
      <Resource
        name="logs"
        list={ListGuesser}
        show={ShowGuesser}
        options={{ 
          label: '操作日志'
        }}
        icon={FileText}
      />

      {/* 调试工具 - 仅开发环境 */}
      {process.env.NODE_ENV === 'development' && (
        <Resource
          name="debug"
          list={() => <AdminDebug />}
          options={{ 
            label: '调试工具'
          }}
        />
      )}
      </Admin>
    </ErrorBoundary>
  )
}

export default AdminApp
