/**
 * 提示词模板编辑器页面
 */

import React from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import PromptTemplateEditor from '@/components/admin/PromptTemplateEditor'

export default function PromptTemplateEditorPage() {
  return (
    <AdminLayout>
      <PromptTemplateEditor />
    </AdminLayout>
  )
}
