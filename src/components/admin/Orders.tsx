import React from 'react'
import { OrdersPage } from '../../pages/admin/OrdersPage'

// React Admin 兼容的订单列表组件
export const OrderList: React.FC = () => {
  return <OrdersPage />
}

// 可选：添加详情页面
export const OrderShow: React.FC = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">订单详情</h2>
      <p className="text-muted-foreground">订单详情页面正在开发中...</p>
    </div>
  )
}