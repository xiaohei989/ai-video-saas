/**
 * Template Guide Page
 * SEO优化的模板用户指南页面
 */

import React, { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import {
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

// 解析多语言JSON字段的辅助函数
function parseI18nField(field: any, language: string, fallback: string = ''): string {
  if (!field) return fallback

  // 如果是字符串且以{开头，尝试解析JSON
  if (typeof field === 'string') {
    if (field.startsWith('{')) {
      try {
        const parsed = JSON.parse(field)
        return parsed[language] || parsed.en || parsed.zh || parsed.ja || Object.values(parsed)[0] || fallback
      } catch (e) {
        return field
      }
    }
    return field
  }

  // 如果已经是对象
  if (typeof field === 'object') {
    return field[language] || field.en || field.zh || field.ja || Object.values(field)[0] || fallback
  }

  return fallback
}

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
  t: any
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ t }) => {
  const [headings, setHeadings] = React.useState<Array<{ level: number; text: string; id: string }>>([])
  const [activeId, setActiveId] = React.useState<string>('')

  // 从 DOM 中提取已渲染的标题
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const markdownContent = document.querySelector('.markdown-content')
      if (!markdownContent) return

      const headingElements = markdownContent.querySelectorAll('h2[id], h3[id]')
      const extractedHeadings = Array.from(headingElements).map(el => {
        // 获取纯文本，排除可能的锚点链接
        const text = el.textContent || ''
        return {
          level: el.tagName === 'H2' ? 2 : 3,
          text: text,
          id: el.id
        }
      })

      setHeadings(extractedHeadings)
    }, 200) // 等待 Markdown 渲染完成

    return () => clearTimeout(timeout)
  }, [])

  // 监听滚动，高亮当前章节
  React.useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-100px 0px -80% 0px',
        threshold: 0
      }
    )

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [headings])

  if (headings.length === 0) return null

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.pushState(null, '', `#${id}`)
    }
  }

  return (
    <Card className="p-6 mb-8 sticky top-20">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-lg">{t('guide.tableOfContents')}</h2>
      </div>
      <nav className="space-y-1">
        {headings.map((heading, index) => {
          const isActive = activeId === heading.id
          return (
            <a
              key={index}
              href={`#${heading.id}`}
              onClick={(e) => handleClick(e, heading.id)}
              className={`
                block text-sm transition-all duration-200 rounded-md
                ${heading.level === 2
                  ? `font-semibold py-2 px-3 ${
                      isActive
                        ? 'text-primary bg-primary/10 border-l-2 border-primary'
                        : 'text-foreground hover:text-primary hover:bg-primary/10'
                    }`
                  : `py-1.5 px-3 ml-4 border-l-2 ${
                      isActive
                        ? 'text-primary bg-muted border-primary font-medium'
                        : 'text-muted-foreground hover:text-primary hover:bg-muted border-border hover:border-primary'
                    }`
                }
              `}
            >
              <span className="flex items-center gap-2">
                {heading.level === 3 && (
                  <ChevronRight
                    className={`h-3 w-3 flex-shrink-0 transition-all ${
                      isActive ? 'opacity-100 translate-x-0.5' : 'opacity-50'
                    }`}
                  />
                )}
                <span className="line-clamp-2">{heading.text}</span>
              </span>
            </a>
          )
        })}
      </nav>
    </Card>
  )
}

// 相关模板推荐组件
interface RelatedTemplatesProps {
  category: string
  currentTemplateId: string
  language: string
  t: any
}

const RelatedTemplates: React.FC<RelatedTemplatesProps> = ({
  category,
  currentTemplateId,
  language,
  t
}) => {
  // 🎲 生成一个随机种子，只在组件首次挂载时生成（页面刷新时会改变）
  const [randomSeed] = React.useState(() => Math.random())

  const { data: templates } = useQuery({
    queryKey: ['related-templates', category, currentTemplateId, randomSeed],
    queryFn: async () => {
      // 🎲 先获取同分类的模板
      const { data } = await supabase
        .from('templates')
        .select('id, name, slug, thumbnail_url, description, category')
        .eq('category', category)
        .eq('is_active', true)
        .neq('id', currentTemplateId)
        .limit(20) // 先获取更多候选，然后前端随机选择

      if (!data || data.length === 0) {
        // 如果同分类下没有其他模板，尝试推荐其他热门模板
        const { data: fallbackData } = await supabase
          .from('templates')
          .select('id, name, slug, thumbnail_url, description, category')
          .eq('is_active', true)
          .neq('id', currentTemplateId)
          .limit(20)

        if (!fallbackData) return []

        // ✅ 使用 Fisher-Yates 洗牌算法进行随机打乱
        const shuffled = [...fallbackData]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled.slice(0, 3)
      }

      // ✅ 使用 Fisher-Yates 洗牌算法进行随机打乱
      const shuffled = [...data]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled.slice(0, 3)
    }
  })

  if (!templates || templates.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-6">{t('guide.relatedTemplates')}</h2>
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
                    alt={parseI18nField(template.name, language, template.name)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  {parseI18nField(template.name, language, template.name)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {parseI18nField(template.description, language, '')}
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
  const { t } = useTranslation()

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
            { label: t('guide.home'), href: `/${lang}` },
            { label: t('guide.templates'), href: `/${lang}/templates` },
            { label: parseI18nField(guide.template_name, lang, guide.template_name) }
          ]}
          lang={lang}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
          {/* 主要内容区域 */}
          <article className="prose prose-lg max-w-none dark:prose-invert">
            {/* 标题和元信息 */}
            <header className="mb-8 not-prose">
              <h1 className="text-4xl font-bold mb-4">{guide.meta_title}</h1>

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

              {/* CTA 按钮 - 顶部 */}
              <div className="mt-6">
                <Button size="lg" asChild>
                  <Link to={`/${lang}/create?template=${guide.template_id}`}>
                    <Play className="mr-2 h-5 w-5" />
                    {t('guide.useThisTemplate')}
                  </Link>
                </Button>
              </div>
            </header>

            {/* 简介 */}
            {guide.guide_intro && (
              <div className="bg-muted/50 rounded-lg p-6 mb-8 not-prose">
                <p className="text-lg leading-relaxed">{guide.guide_intro}</p>
              </div>
            )}

            {/* 主要内容 - Markdown渲染 */}
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                  rehypeSlug,
                  [rehypeAutolinkHeadings, { behavior: 'wrap' }]
                ]}
              >
                {guide.guide_content}
              </ReactMarkdown>
            </div>

            {/* FAQ部分 */}
            {guide.faq_items && guide.faq_items.length > 0 && (
              <section className="mt-12 not-prose">
                <div className="flex items-center gap-2 mb-6">
                  <HelpCircle className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-bold">{t('guide.faq')}</h2>
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
                <h3 className="text-2xl font-bold mb-4">{t('guide.readyToCreate')}</h3>
                <p className="text-muted-foreground mb-6">
                  {t('guide.useTemplateDescription', { templateName: parseI18nField(guide.template_name, lang, guide.template_name) })}
                </p>
                <Button size="lg" asChild>
                  <Link to={`/${lang}/create?template=${guide.template_id}`}>
                    <Play className="mr-2 h-5 w-5" />
                    {t('guide.useThisTemplate')}
                  </Link>
                </Button>
              </Card>
            </div>
          </article>

          {/* 侧边栏 */}
          <aside className="space-y-6">
            <TableOfContents t={t} />

            {/* 模板信息卡片 */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">{t('guide.aboutThisTemplate')}</h3>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                {guide.template?.thumbnail_url && (
                  <img
                    src={guide.template.thumbnail_url}
                    alt={parseI18nField(guide.template_name, lang, guide.template_name)}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <h4 className="font-medium mb-2">{parseI18nField(guide.template_name, lang, guide.template_name)}</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {parseI18nField(guide.template?.description, lang, '')}
              </p>
              <Button className="w-full" asChild>
                <Link to={`/${lang}/templates`}>
                  {t('guide.viewAllTemplates')}
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
          t={t}
        />
      </div>
  )
}
