/**
 * Template Guide Page
 * SEO优化的模板用户指南页面
 */

import React, { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  Eye,
  TrendingUp,
  ChevronRight,
  Play,
  FileText,
  HelpCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TemplateSEOGuide } from '@/types/seo'

// 获取SEO指南数据
async function fetchSEOGuide(templateSlug: string, language: string) {
  const { data: template } = await supabase
    .from('templates')
    .select('id')
    .eq('slug', templateSlug)
    .single()

  if (!template) throw new Error('Template not found')

  const { data, error } = await supabase
    .rpc('get_template_seo_guide', {
      p_template_id: template.id,
      p_language: language
    })

  if (error) throw error
  if (!data || data.length === 0) throw new Error('SEO guide not found')

  return data[0] as any
}

// 记录页面访问
async function recordPageView(guideId: string) {
  await supabase.rpc('record_guide_page_view', {
    p_guide_id: guideId,
    p_is_unique_visitor: !localStorage.getItem(`guide_viewed_${guideId}`)
  })
  localStorage.setItem(`guide_viewed_${guideId}`, 'true')
}

// 面包屑导航组件
interface BreadcrumbProps {
  items: Array<{ label: string; href?: string }>
  lang: string
}

const Breadcrumbs: React.FC<BreadcrumbProps> = ({ items, lang }) => (
  <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
    {items.map((item, index) => (
      <React.Fragment key={index}>
        {index > 0 && <ChevronRight className="h-4 w-4" />}
        {item.href ? (
          <Link to={item.href} className="hover:text-foreground transition-colors">
            {item.label}
          </Link>
        ) : (
          <span className="text-foreground font-medium">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
)

// 目录组件
interface TableOfContentsProps {
  content: string
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content }) => {
  const headings = React.useMemo(() => {
    const lines = content.split('\n')
    return lines
      .filter(line => line.startsWith('## ') || line.startsWith('### '))
      .map(line => {
        const level = line.startsWith('## ') ? 2 : 3
        const text = line.replace(/^#{2,3}\s+/, '')
        const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
        return { level, text, id }
      })
  }, [content])

  if (headings.length === 0) return null

  return (
    <Card className="p-6 mb-8 sticky top-20">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-lg">目录</h2>
      </div>
      <nav className="space-y-2">
        {headings.map((heading, index) => (
          <a
            key={index}
            href={`#${heading.id}`}
            className={`block text-sm hover:text-primary transition-colors ${
              heading.level === 3 ? 'pl-4' : ''
            }`}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </Card>
  )
}

// 相关模板推荐组件
interface RelatedTemplatesProps {
  category: string
  currentTemplateId: string
  language: string
}

const RelatedTemplates: React.FC<RelatedTemplatesProps> = ({
  category,
  currentTemplateId,
  language
}) => {
  const { data: templates } = useQuery({
    queryKey: ['related-templates', category, currentTemplateId],
    queryFn: async () => {
      const { data } = await supabase
        .from('templates')
        .select('id, name, slug, thumbnail_url, description')
        .eq('category', category)
        .eq('is_active', true)
        .neq('id', currentTemplateId)
        .limit(3)

      return data || []
    }
  })

  if (!templates || templates.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-6">相关模板推荐</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates.map((template: any) => (
          <Link
            key={template.id}
            to={`/${language}/guide/${template.slug}`}
            className="group"
          >
            <Card className="overflow-hidden hover:shadow-lg transition-all">
              <div className="aspect-video bg-muted relative overflow-hidden">
                {template.thumbnail_url && (
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {template.description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}

// 主页面组件
export default function TemplateGuidePage() {
  const { lang = 'en', slug } = useParams<{ lang: string; slug: string }>()

  const { data: guide, isLoading, error } = useQuery({
    queryKey: ['template-guide', slug, lang],
    queryFn: () => fetchSEOGuide(slug!, lang),
    enabled: !!slug
  })

  // 记录页面访问 & 设置SEO
  useEffect(() => {
    if (guide?.id) {
      recordPageView(guide.id)
    }

    // 设置页面标题和meta标签
    if (guide) {
      document.title = guide.meta_title

      // 设置meta标签
      const setMeta = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
        if (!meta) {
          meta = document.createElement('meta')
          meta.name = name
          document.head.appendChild(meta)
        }
        meta.content = content
      }

      const setProperty = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
        if (!meta) {
          meta = document.createElement('meta')
          meta.setAttribute('property', property)
          document.head.appendChild(meta)
        }
        meta.content = content
      }

      setMeta('description', guide.meta_description)
      setMeta('keywords', guide.long_tail_keywords?.join(', ') || '')

      // Open Graph
      setProperty('og:title', guide.meta_title)
      setProperty('og:description', guide.meta_description)
      setProperty('og:type', 'article')
      setProperty('og:url', `https://veo3video.me/${lang}/guide/${slug}`)
      if (guide.template?.thumbnail_url) {
        setProperty('og:image', guide.template.thumbnail_url)
      }

      // Twitter Card
      setMeta('twitter:card', 'summary_large_image')
      setMeta('twitter:title', guide.meta_title)
      setMeta('twitter:description', guide.meta_description)
      if (guide.template?.thumbnail_url) {
        setMeta('twitter:image', guide.template.thumbnail_url)
      }
    }
  }, [guide, lang, slug])

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="space-y-2 mt-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !guide) {
    return (
      <div className="container max-w-5xl mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">指南未找到</h1>
        <p className="text-muted-foreground mb-8">
          抱歉，我们找不到这个模板的用户指南。
        </p>
        <Button asChild>
          <Link to={`/${lang}/templates`}>返回模板列表</Link>
        </Button>
      </div>
    )
  }

  // 生成HowTo Schema
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.meta_title,
    description: guide.meta_description,
    image: guide.template?.thumbnail_url,
    totalTime: 'PT10M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0'
    },
    step: guide.guide_content
      ?.split('\n## ')
      .filter((section: string) => section.trim())
      .map((section: string, index: number) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: section.split('\n')[0],
        text: section
      })) || []
  }

  // 生成FAQ Schema
  const faqSchema = guide.faq_items && guide.faq_items.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faq_items.map((faq: any) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  } : null

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
        {/* 面包屑导航 */}
        <Breadcrumbs
          items={[
            { label: '首页', href: `/${lang}` },
            { label: '模板', href: `/${lang}/templates` },
            { label: guide.template_name }
          ]}
          lang={lang}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* 主要内容区域 */}
          <article className="prose prose-lg max-w-none dark:prose-invert">
            {/* 标题和元信息 */}
            <header className="mb-8 not-prose">
              <h1 className="text-4xl font-bold mb-4">{guide.primary_keyword}</h1>

              {/* 统计信息 */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>阅读时间: 5分钟</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{guide.page_views} 次浏览</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>SEO评分: {guide.seo_score}/100</span>
                </div>
              </div>

              {/* 关键词标签 */}
              {guide.long_tail_keywords && guide.long_tail_keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {guide.long_tail_keywords.slice(0, 5).map((keyword: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </header>

            {/* 简介 */}
            {guide.guide_intro && (
              <div className="bg-muted/50 rounded-lg p-6 mb-8 not-prose">
                <p className="text-lg leading-relaxed">{guide.guide_intro}</p>
              </div>
            )}

            {/* 主要内容 */}
            <div className="whitespace-pre-wrap">
              {guide.guide_content}
            </div>

            {/* FAQ部分 */}
            {guide.faq_items && guide.faq_items.length > 0 && (
              <section className="mt-12 not-prose">
                <div className="flex items-center gap-2 mb-6">
                  <HelpCircle className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-bold">常见问题</h2>
                </div>
                <div className="space-y-4">
                  {guide.faq_items.map((faq: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-left mb-2">
                        {faq.question}
                      </h3>
                      <p className="text-muted-foreground">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA按钮 */}
            <div className="mt-12 not-prose">
              <Card className="bg-primary/5 border-primary/20 p-8 text-center">
                <h3 className="text-2xl font-bold mb-4">准备好开始创作了吗？</h3>
                <p className="text-muted-foreground mb-6">
                  使用 {guide.template_name} 模板，轻松创建专业级视频内容
                </p>
                <Button size="lg" asChild>
                  <Link to={`/${lang}/create?template=${guide.template_id}`}>
                    <Play className="mr-2 h-5 w-5" />
                    立即使用此模板
                  </Link>
                </Button>
              </Card>
            </div>
          </article>

          {/* 侧边栏 */}
          <aside className="space-y-6">
            <TableOfContents content={guide.guide_content || ''} />

            {/* 模板信息卡片 */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">关于此模板</h3>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                {guide.template?.thumbnail_url && (
                  <img
                    src={guide.template.thumbnail_url}
                    alt={guide.template_name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <h4 className="font-medium mb-2">{guide.template_name}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {guide.template?.description}
              </p>
              <Button className="w-full" asChild>
                <Link to={`/${lang}/templates`}>
                  查看所有模板
                </Link>
              </Button>
            </Card>
          </aside>
        </div>

        {/* 相关模板 */}
        <RelatedTemplates
          category={guide.template?.category || ''}
          currentTemplateId={guide.template_id}
          language={lang}
        />
      </div>
  )
}
