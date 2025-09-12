import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
}

interface TemplateManagementRequest {
  action: 'list' | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'bulk_import' | 'bulk_export' | 'get_import_status'
  templateId?: string
  templateData?: {
    slug: string
    name: string
    description?: string
    category: string
    parameters: any[]
    prompt_template: string
    thumbnail_url?: string
    preview_url?: string
    credit_cost?: number
    is_premium?: boolean
  }
  auditStatus?: 'pending' | 'approved' | 'rejected' | 'needs_revision'
  adminNotes?: string
  rejectionReason?: string
  importData?: {
    templates: any[]
    overwriteExisting?: boolean
  }
  exportFilters?: {
    categories?: string[]
    auditStatus?: string
    dateRange?: { start: string; end: string }
  }
  importId?: string
  filters?: {
    auditStatus?: string
    category?: string
    author?: string
    dateRange?: { start: string; end: string }
  }
  pagination?: {
    page: number
    pageSize: number
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 验证管理员权限
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    const { data: adminProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      throw new Error('Insufficient permissions')
    }

    const requestData: TemplateManagementRequest = await req.json()
    const { action, filters, pagination } = requestData

    switch (action) {
      case 'list': {
        let query = supabaseClient
          .from('templates')
          .select(`
            *,
            author:profiles!author_id(username, email, avatar_url),
            reviewed_by_admin:profiles!reviewed_by(username, email)
          `, { count: 'exact' })

        // 应用过滤条件
        if (filters?.auditStatus) {
          query = query.eq('audit_status', filters.auditStatus)
        }
        if (filters?.category) {
          query = query.eq('category', filters.category)
        }
        if (filters?.author) {
          query = query.eq('author_id', filters.author)
        }
        if (filters?.dateRange) {
          query = query
            .gte('created_at', filters.dateRange.start)
            .lte('created_at', filters.dateRange.end)
        }

        // 分页
        const page = pagination?.page || 1
        const pageSize = pagination?.pageSize || 20
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        query = query.range(from, to).order('created_at', { ascending: false })

        const { data: templates, error, count } = await query

        if (error) throw error
        
        console.log('[Admin Templates API] Query result:', { 
          templatesCount: templates?.length, 
          totalCount: count,
          page,
          pageSize 
        })

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              templates: templates || [],
              pagination: {
                page,
                pageSize,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / pageSize)
              }
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'create': {
        if (!requestData.templateData) {
          throw new Error('Template data is required')
        }

        const templateData = {
          ...requestData.templateData,
          author_id: user.id,
          audit_status: 'approved', // 管理员创建的模板自动批准
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        }

        const { data, error } = await supabaseClient
          .from('templates')
          .insert(templateData)
          .select()

        if (error) throw error

        // 记录操作日志
        await supabaseClient
          .from('admin_operations_log')
          .insert({
            admin_id: user.id,
            operation_type: 'create_template',
            target_type: 'template',
            target_id: data[0]?.id,
            operation_details: { name: templateData.name }
          })

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Template created successfully',
            data: data[0]
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'update': {
        if (!requestData.templateId || !requestData.templateData) {
          throw new Error('Template ID and data are required')
        }

        const { error } = await supabaseClient
          .from('templates')
          .update({
            ...requestData.templateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', requestData.templateId)

        if (error) throw error

        // 记录操作日志
        await supabaseClient
          .from('admin_operations_log')
          .insert({
            admin_id: user.id,
            operation_type: 'update_template',
            target_type: 'template',
            target_id: requestData.templateId,
            operation_details: requestData.templateData
          })

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Template updated successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'delete': {
        if (!requestData.templateId) {
          throw new Error('Template ID is required')
        }

        const { error } = await supabaseClient
          .from('templates')
          .delete()
          .eq('id', requestData.templateId)

        if (error) throw error

        // 记录操作日志
        await supabaseClient
          .from('admin_operations_log')
          .insert({
            admin_id: user.id,
            operation_type: 'delete_template',
            target_type: 'template',
            target_id: requestData.templateId
          })

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Template deleted successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'approve': {
        if (!requestData.templateId) {
          throw new Error('Template ID is required')
        }

        const { error } = await supabaseClient
          .from('templates')
          .update({
            audit_status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            admin_notes: requestData.adminNotes,
            is_public: true
          })
          .eq('id', requestData.templateId)

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Template approved successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'reject': {
        if (!requestData.templateId || !requestData.rejectionReason) {
          throw new Error('Template ID and rejection reason are required')
        }

        const { error } = await supabaseClient
          .from('templates')
          .update({
            audit_status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: requestData.rejectionReason,
            admin_notes: requestData.adminNotes,
            is_public: false
          })
          .eq('id', requestData.templateId)

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Template rejected successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'bulk_import': {
        if (!requestData.importData?.templates || requestData.importData.templates.length === 0) {
          throw new Error('No templates provided for import')
        }

        // 创建导入记录
        const { data: importRecord, error: importError } = await supabaseClient
          .from('template_import_exports')
          .insert({
            admin_id: user.id,
            operation_type: 'import',
            file_name: `bulk_import_${new Date().getTime()}.json`,
            templates_count: requestData.importData.templates.length,
            status: 'processing'
          })
          .select()

        if (importError) throw importError

        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // 批量导入模板
        for (const templateData of requestData.importData.templates) {
          try {
            // 检查是否已存在
            if (!requestData.importData.overwriteExisting) {
              const { data: existing } = await supabaseClient
                .from('templates')
                .select('id')
                .eq('slug', templateData.slug)
                .single()

              if (existing) {
                errors.push(`Template with slug '${templateData.slug}' already exists`)
                errorCount++
                continue
              }
            }

            // 插入或更新模板
            const { error } = await supabaseClient
              .from('templates')
              .upsert({
                ...templateData,
                author_id: user.id,
                audit_status: 'approved',
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString()
              })

            if (error) {
              errors.push(`Failed to import ${templateData.slug}: ${error.message}`)
              errorCount++
            } else {
              successCount++
            }
          } catch (error) {
            errors.push(`Failed to import ${templateData.slug}: ${error}`)
            errorCount++
          }
        }

        // 更新导入记录
        await supabaseClient
          .from('template_import_exports')
          .update({
            status: errorCount > 0 ? 'completed_with_errors' : 'completed',
            error_message: errors.length > 0 ? errors.join('\n') : null,
            completed_at: new Date().toISOString(),
            metadata: {
              success_count: successCount,
              error_count: errorCount
            }
          })
          .eq('id', importRecord[0].id)

        return new Response(
          JSON.stringify({
            success: true,
            message: `Import completed: ${successCount} successful, ${errorCount} errors`,
            data: {
              importId: importRecord[0].id,
              successCount,
              errorCount,
              errors: errors.slice(0, 10) // 只返回前10个错误
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'bulk_export': {
        let query = supabaseClient
          .from('templates')
          .select('*')

        // 应用导出过滤条件
        if (requestData.exportFilters?.categories) {
          query = query.in('category', requestData.exportFilters.categories)
        }
        if (requestData.exportFilters?.auditStatus) {
          query = query.eq('audit_status', requestData.exportFilters.auditStatus)
        }
        if (requestData.exportFilters?.dateRange) {
          query = query
            .gte('created_at', requestData.exportFilters.dateRange.start)
            .lte('created_at', requestData.exportFilters.dateRange.end)
        }

        const { data: templates, error } = await query

        if (error) throw error

        // 创建导出记录
        const fileName = `template_export_${new Date().getTime()}.json`
        const { data: exportRecord } = await supabaseClient
          .from('template_import_exports')
          .insert({
            admin_id: user.id,
            operation_type: 'export',
            file_name: fileName,
            templates_count: templates?.length || 0,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .select()

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Templates exported successfully',
            data: {
              exportId: exportRecord?.[0]?.id,
              fileName,
              templates: templates || [],
              count: templates?.length || 0
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      case 'get_import_status': {
        if (!requestData.importId) {
          throw new Error('Import ID is required')
        }

        const { data: importRecord, error } = await supabaseClient
          .from('template_import_exports')
          .select('*')
          .eq('id', requestData.importId)
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            data: importRecord
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }

      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('Admin templates error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})