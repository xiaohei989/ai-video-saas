/**
 * SEO Guide Page - SEO优化指南页面
 *
 * 根据模板slug和关键词slug显示SEO优化的内容页面
 * URL格式: /:lang/:templateSlug/guide/:keywordSlug
 */

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Container, Typography, Chip, Alert, CircularProgress, Breadcrumbs, Link as MuiLink, Paper, List, ListItem, ListItemButton, ListItemText, Card, CardMedia, CardContent, CardActionArea } from '@mui/material'
import { Home, Description, Menu as MenuIcon, PlayArrow } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { SEOHead } from '@/components/seo/SEOHead'
import { TemplateVideoPreviewCard } from '@/components/seo/TemplateVideoPreviewCard'
import templatesApiService, { type TemplateListItem } from '@/services/templatesApiService'
import type { Video } from '@/types/video.types'

interface SEOGuideData {
  id: string
  target_keyword: string
  meta_title: string
  meta_description: string
  meta_keywords: string
  guide_content: string
  faq_items: Array<{ question: string; answer: string }>
  seo_score: number | null
  is_published: boolean
  template_id: string
  language: string
}

interface TemplateData {
  id: string
  slug: string
  name: Record<string, string>
}

const SEOGuidePage: React.FC = () => {
  const { lang = 'en', templateSlug, keywordSlug } = useParams<{
    lang: string
    templateSlug: string
    keywordSlug: string
  }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guideData, setGuideData] = useState<SEOGuideData | null>(null)
  const [templateData, setTemplateData] = useState<TemplateData | null>(null)
  const [activeSection, setActiveSection] = useState<string>('')
  const [recommendedTemplates, setRecommendedTemplates] = useState<TemplateListItem[]>([])
  const [sampleVideo, setSampleVideo] = useState<Partial<Video> | null>(null)
  const [sampleVideoLoading, setSampleVideoLoading] = useState(false)

  // 从Markdown内容中提取目录结构
  const tableOfContents = useMemo(() => {
    if (!guideData?.guide_content) return []

    const headingRegex = /^##\s+(.+)$/gm
    const matches = Array.from(guideData.guide_content.matchAll(headingRegex))

    const tocItems = matches
      .map(match => {
        // 移除HTML标签，只保留纯文本
        const title = match[1].replace(/<a name="([^"]+)"><\/a>/g, '').trim()
        // 统一使用标题文本生成anchor，忽略自定义的 <a name> 标签
        const anchor = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

        return { title, anchor }
      })
      .filter(item => !item.title.includes('📋') && !item.title.includes('Table of Contents'))

    // 如果有FAQ数据，添加FAQ链接到目录
    if (guideData?.faq_items && guideData.faq_items.length > 0) {
      tocItems.push({
        title: lang === 'zh' ? '常见问题 (FAQ)' : 'FAQ',
        anchor: 'faq-section'
      })
    }

    return tocItems
  }, [guideData?.guide_content, guideData?.faq_items, lang])

  useEffect(() => {
    const fetchGuideData = async () => {
      try {
        setLoading(true)
        setError(null)

        // 1. 根据templateSlug获取template_id和预览视频URL
        const { data: template, error: templateError } = await supabase
          .from('templates')
          .select('id, slug, name, preview_url, thumbnail_url, veo3_settings')
          .eq('slug', templateSlug)
          .single()

        if (templateError || !template) {
          throw new Error('模板不存在')
        }

        console.log('[SEO Video Card] 📦 模板数据已加载:', {
          slug: template.slug,
          hasPreviewUrl: !!template.preview_url,
          previewUrl: template.preview_url,
          hasThumbnailUrl: !!template.thumbnail_url
        })

        setTemplateData(template)

        // 2. 根据template_id, language, keyword_slug获取SEO内容
        const { data: seoPage, error: seoError } = await supabase
          .from('seo_page_variants')
          .select('*')
          .eq('template_id', template.id)
          .eq('language', lang)
          .eq('keyword_slug', keywordSlug)
          .eq('is_published', true) // 只显示已发布的内容
          .single()

        if (seoError || !seoPage) {
          throw new Error('页面不存在或未发布')
        }

        setGuideData(seoPage)
      } catch (err: any) {
        console.error('加载SEO页面失败:', err)
        setError(err.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }

    if (templateSlug && keywordSlug) {
      fetchGuideData()
    }
  }, [templateSlug, keywordSlug, lang])

  // 获取推荐模板
  useEffect(() => {
    const fetchRecommendedTemplates = async () => {
      if (!templateData?.id) return

      try {
        const templates = await templatesApiService.getRandomRecommendedTemplates(3, templateData.id)
        setRecommendedTemplates(templates)
      } catch (err) {
        console.error('获取推荐模板失败:', err)
        // 静默失败，不影响主要内容展示
      }
    }

    fetchRecommendedTemplates()
  }, [templateData?.id])

  // 获取模板的示例视频 - 优先使用模板的previewUrl
  useEffect(() => {
    const fetchSampleVideo = async () => {
      if (!templateData?.id) {
        console.log('[SEO Video Card] ⏸️  模板数据未加载,跳过获取示例视频')
        return
      }

      try {
        console.log('[SEO Video Card] 🔍 开始获取模板示例视频...')
        console.log('[SEO Video Card] 📋 模板信息:', {
          id: templateData.id,
          slug: templateData.slug,
          name: templateData.name,
          hasPreviewUrl: !!templateData.preview_url,
          previewUrl: templateData.preview_url
        })

        setSampleVideoLoading(true)

        // 如果模板有 preview_url,直接使用模板的预览视频
        if (templateData.preview_url) {
          console.log('[SEO Video Card] ✅ 使用模板的预览视频!')

          // 构造一个符合 Video 类型的对象
          const previewVideo: Partial<Video> = {
            id: `template-preview-${templateData.id}`,
            template_id: templateData.id,
            title: templateData.name || 'Template Preview',
            video_url: templateData.preview_url,
            thumbnail_url: templateData.thumbnail_url || templateData.preview_url, // 使用缩略图或预览URL
            status: 'completed' as const,
            parameters: { aspectRatio: '9:16' }, // 默认使用竖屏比例
            created_at: new Date().toISOString()
          }

          console.log('[SEO Video Card] 📹 模板预览视频信息:', {
            id: previewVideo.id,
            title: previewVideo.title,
            video_url: previewVideo.video_url,
            thumbnail_url: previewVideo.thumbnail_url,
            aspectRatio: previewVideo.parameters?.aspectRatio
          })

          setSampleVideo(previewVideo)
          setSampleVideoLoading(false)
          console.log('[SEO Video Card] 🏁 示例视频获取流程结束 (使用模板预览)')
          return
        }

        // 如果没有 preview_url,则查询该模板的已完成视频
        console.log('[SEO Video Card] 💡 模板没有预览URL,查询用户生成的视频...')
        const { data, error } = await supabase
          .from('videos')
          .select('id, title, video_url, thumbnail_url, created_at, parameters')
          .eq('template_id', templateData.id)
          .eq('status', 'completed')
          .not('video_url', 'is', null)
          .not('thumbnail_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error('[SEO Video Card] ❌ 获取示例视频失败:', error)
          console.log('[SEO Video Card] 💡 提示: 该模板可能还没有已完成的视频')
          setSampleVideo(null)
        } else if (data) {
          console.log('[SEO Video Card] ✅ 成功获取用户生成的示例视频!')
          console.log('[SEO Video Card] 📹 视频信息:', {
            id: data.id,
            title: data.title,
            video_url: data.video_url,
            thumbnail_url: data.thumbnail_url,
            aspectRatio: data.parameters?.aspectRatio,
            created_at: data.created_at
          })
          setSampleVideo(data as Partial<Video>)
        } else {
          console.log('[SEO Video Card] ⚠️  查询成功但没有返回数据')
          setSampleVideo(null)
        }
      } catch (err) {
        console.error('[SEO Video Card] ❌ 获取示例视频异常:', err)
        setSampleVideo(null)
      } finally {
        setSampleVideoLoading(false)
        console.log('[SEO Video Card] 🏁 示例视频获取流程结束')
      }
    }

    fetchSampleVideo()
  }, [templateData?.id, templateData?.preview_url])

  // 获取模板名称
  const getTemplateName = () => {
    if (!templateData) return ''
    try {
      const nameObj = typeof templateData.name === 'string'
        ? JSON.parse(templateData.name)
        : templateData.name
      return nameObj[lang] || nameObj['en'] || templateData.slug
    } catch {
      return templateData.slug
    }
  }

  // 平滑滚动到指定锚点
  const scrollToSection = (anchor: string) => {
    const element = document.getElementById(anchor)
    if (element) {
      const yOffset = -80 // 顶部偏移量（header 65px + 15px 间距）
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveSection(anchor)
    }
  }

  // 获取模板多语言名称
  const getTemplateMultilingualName = (template: TemplateListItem): string => {
    try {
      const nameObj = typeof template.name === 'string'
        ? JSON.parse(template.name)
        : template.name
      return nameObj[lang] || nameObj['en'] || template.slug
    } catch {
      return template.slug
    }
  }

  // 获取模板多语言描述
  const getTemplateDescription = (template: TemplateListItem): string => {
    try {
      if (!template.description) return ''
      const descObj = typeof template.description === 'string'
        ? JSON.parse(template.description)
        : template.description
      return descObj[lang] || descObj['en'] || ''
    } catch {
      return ''
    }
  }

  // 点击推荐模板跳转
  const handleTemplateClick = (templateSlug: string) => {
    navigate(`/${lang}/create?template=${templateSlug}`)
  }

  // 监听滚动,高亮当前章节
  useEffect(() => {
    const handleScroll = () => {
      const sections = tableOfContents.map(item => ({
        id: item.anchor,
        element: document.getElementById(item.anchor)
      })).filter(s => s.element)

      const scrollPosition = window.scrollY + 150

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section.element && section.element.offsetTop <= scrollPosition) {
          setActiveSection(section.id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [tableOfContents])

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{t('common.loading')}</Typography>
      </Container>
    )
  }

  if (error || !guideData) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Alert severity="error">
          {error || '页面不存在'}
        </Alert>
      </Container>
    )
  }

  return (
    <>
      {/* SEO Meta Tags */}
      <SEOHead
        title={guideData.meta_title}
        description={guideData.meta_description}
        keywords={guideData.meta_keywords}
      />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', gap: 4, position: 'relative' }}>
          {/* 主内容区 */}
          <Box sx={{ flex: 1, minWidth: 0, maxWidth: { xs: '100%', lg: '800px' } }}>
            {/* 面包屑导航 */}
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
              <MuiLink
                color="inherit"
                href={`/${lang}`}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/${lang}`)
                }}
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <Home sx={{ mr: 0.5 }} fontSize="small" />
                {t('nav.home')}
              </MuiLink>
              <MuiLink
                color="inherit"
                href={`/${lang}/templates`}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/${lang}/templates`)
                }}
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <Description sx={{ mr: 0.5 }} fontSize="small" />
                {t('nav.templates')}
              </MuiLink>
              <Typography color="text.primary">
                {getTemplateName()}
              </Typography>
              <Typography color="text.primary">
                {guideData.target_keyword}
              </Typography>
            </Breadcrumbs>

            {/* 页面标题 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h3" component="h1" gutterBottom>
                {guideData.meta_title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={guideData.target_keyword}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>

            {/* Meta描述 */}
            <Box sx={{ mb: 4, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body1" color="text.secondary">
                {guideData.meta_description}
              </Typography>
            </Box>

            {/* 主要内容 */}
            <Box
              sx={{
                mb: 6,
                '& h1, & h2, & h3, & h4, & h5, & h6': {
                  mt: 4,
                  mb: 2,
                  fontWeight: 600
                },
                '& h1': { fontSize: '2rem' },
                '& h2': { fontSize: '1.75rem' },
                '& h3': { fontSize: '1.5rem' },
                '& p': {
                  mb: 2,
                  lineHeight: 1.7
                },
                '& ul, & ol': {
                  mb: 2,
                  pl: 3
                },
                '& li': {
                  mb: 1
                },
                '& a': {
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                },
                '& code': {
                  bgcolor: 'grey.100',
                  px: 1,
                  py: 0.5,
                  borderRadius: 0.5,
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                },
                '& pre': {
                  bgcolor: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  overflow: 'auto',
                  mb: 2
                },
                '& blockquote': {
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                  pl: 2,
                  ml: 0,
                  fontStyle: 'italic',
                  color: 'text.secondary'
                },
                // 隐藏Markdown内容中的目录（因为我们有右侧固定目录）
                // 匹配所有可能的目录标题格式和包含特定文本的标题
                '& h2[id*="table-of-contents"]': {
                  display: 'none'
                },
                '& h2[id*="table-of-contents"] + ul': {
                  display: 'none'
                },
                // 通过类名隐藏(在组件中添加)
                '& .toc-heading': {
                  display: 'none'
                },
                '& .toc-heading + ul': {
                  display: 'none'
                }
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h2: ({ node, children, ...props }) => {
                    // 从children中提取纯文本
                    const getTextFromChildren = (children: any): string => {
                      if (typeof children === 'string') return children
                      if (Array.isArray(children)) {
                        return children.map(child => getTextFromChildren(child)).join('')
                      }
                      if (children?.props?.children) {
                        return getTextFromChildren(children.props.children)
                      }
                      return ''
                    }

                    // 移除HTML标签，只保留纯文本
                    const text = getTextFromChildren(children).replace(/<a name="([^"]+)"><\/a>/g, '').trim()
                    // 统一使用标题文本生成ID，忽略自定义的 <a name> 标签，并移除首尾连字符
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

                    // 检测是否为目录标题(包含"Table of Contents"或"目录"或📋 emoji)
                    const isTocHeading = text.includes('Table of Contents') ||
                                       text.includes('目录') ||
                                       text.includes('📋')

                    return (
                      <h2 id={id} className={isTocHeading ? 'toc-heading' : ''} {...props}>
                        {children}
                      </h2>
                    )
                  },
                  a: ({ node, href, children, ...props }) => {
                    // 处理 CTA 链接占位符 #cta-link
                    if (href === '#cta-link') {
                      const targetUrl = `/${lang}/create?template=${templateSlug}`

                      console.log('[SEO CTA Link] 🔗 检测到 CTA 链接占位符')
                      console.log('[SEO CTA Link] 🎯 转换为实际链接:', targetUrl)

                      return (
                        <MuiLink
                          href={targetUrl}
                          onClick={(e) => {
                            e.preventDefault()
                            console.log('[SEO CTA Link] 🚀 用户点击 CTA 链接,跳转到:', targetUrl)
                            navigate(targetUrl)
                          }}
                          sx={{
                            color: 'primary.main',
                            fontWeight: 600,
                            textDecoration: 'none',
                            cursor: 'pointer',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          {...props}
                        >
                          {children}
                        </MuiLink>
                      )
                    }

                    // 处理内部链接占位符 #internal-link
                    if (href === '#internal-link') {
                      // Phase 1: 简单实现 - 统一链接到模板列表页
                      const targetUrl = `/${lang}/templates`

                      console.log('[SEO Internal Link] 🔗 检测到内部链接占位符')
                      console.log('[SEO Internal Link] 📝 链接文本:', children)
                      console.log('[SEO Internal Link] 🎯 转换为模板列表页:', targetUrl)

                      return (
                        <MuiLink
                          href={targetUrl}
                          onClick={(e) => {
                            e.preventDefault()
                            console.log('[SEO Internal Link] 🚀 用户点击内部链接,跳转到:', targetUrl)
                            navigate(targetUrl)
                          }}
                          sx={{
                            color: 'primary.main',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          {...props}
                        >
                          {children}
                        </MuiLink>
                      )
                    }

                    // 其他链接保持默认样式
                    return (
                      <MuiLink
                        href={href}
                        target={href?.startsWith('http') ? '_blank' : undefined}
                        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        {...props}
                      >
                        {children}
                      </MuiLink>
                    )
                  },
                  img: ({ node, src, alt, ...props }) => {
                    // 检测图片占位符
                    if (src?.includes('image-placeholder')) {
                      console.log('[SEO Image] 🖼️  检测到图片占位符')
                      console.log('[SEO Image] 📝 Alt 文本:', alt)

                      // 从 alt 文本提取关键词
                      const extractKeywords = (altText: string = ''): string => {
                        const keywords: string[] = []
                        const text = altText.toLowerCase()

                        // 技术相关
                        if (text.includes('interface') || text.includes('dashboard')) {
                          keywords.push('technology', 'interface', 'dashboard')
                        }
                        if (text.includes('setup') || text.includes('workspace')) {
                          keywords.push('workspace', 'computer', 'setup')
                        }
                        if (text.includes('preview') || text.includes('screen')) {
                          keywords.push('display', 'screen', 'monitor')
                        }
                        if (text.includes('effect') || text.includes('particle')) {
                          keywords.push('creative', 'effects', 'visual')
                        }

                        // 通用视频相关
                        keywords.push('video', 'content', 'creative')

                        // 如果没有匹配到特定关键词，使用通用关键词
                        if (keywords.length <= 3) {
                          keywords.push('technology', 'digital', 'modern')
                        }

                        return keywords.slice(0, 6).join(',') // 限制最多6个关键词
                      }

                      const keywords = extractKeywords(alt)
                      // 使用 SourceSplash API (source.unsplash.com 的现代替代品)
                      // 文档: https://www.sourcesplash.com/
                      // 免费限额: 50 请求/天 (无需 API key), 1000 请求/天 (免费 API key)
                      const imageUrl = `https://www.sourcesplash.com/i/random?w=1200&h=800&q=${keywords}`

                      console.log('[SEO Image] 🔗 SourceSplash URL:', imageUrl)
                      console.log('[SEO Image] 🏷️  关键词:', keywords)

                      return (
                        <Box
                          component="img"
                          src={imageUrl}
                          alt={alt}
                          onError={(e: any) => {
                            console.log('[SEO Image] ⚠️  图片加载失败，隐藏图片')
                            e.currentTarget.style.display = 'none'
                          }}
                          sx={{
                            borderRadius: 2,
                            width: '100%',
                            maxWidth: 800,
                            height: 'auto',
                            my: 3,
                            boxShadow: 2,
                            display: 'block',
                            mx: 'auto'
                          }}
                          loading="lazy"
                          {...props}
                        />
                      )
                    }

                    // 普通图片保持原样
                    return <img src={src} alt={alt} {...props} />
                  },
                  blockquote: ({ node, children, ...props }) => {
                    // 检测是否为CTA blockquote (包含"Ready to"/"Try our"等关键词)
                    const getTextFromChildren = (children: any): string => {
                      if (typeof children === 'string') return children
                      if (Array.isArray(children)) {
                        return children.map(child => getTextFromChildren(child)).join('')
                      }
                      if (children?.props?.children) {
                        return getTextFromChildren(children.props.children)
                      }
                      return ''
                    }

                    const text = getTextFromChildren(children)
                    const isCTA = /Ready to|Try our|Get started|Create your|Start creating|立即|开始创建/i.test(text)

                    console.log('[SEO Video Card] 🔍 检测到blockquote元素')
                    console.log('[SEO Video Card] 📝 Blockquote文本内容:', text.substring(0, 100) + (text.length > 100 ? '...' : ''))
                    console.log('[SEO Video Card] 🎯 是否为CTA:', isCTA)

                    if (isCTA) {
                      console.log('[SEO Video Card] ✅ 检测到CTA blockquote!')
                      console.log('[SEO Video Card] 📹 示例视频状态:', {
                        hasSampleVideo: !!sampleVideo,
                        videoId: sampleVideo?.id,
                        loading: sampleVideoLoading
                      })

                      if (sampleVideo) {
                        console.log('[SEO Video Card] 🎬 准备渲染视频预览卡片!')
                      } else {
                        console.log('[SEO Video Card] ⚠️  没有示例视频,跳过卡片渲染')
                      }
                    }

                    return (
                      <>
                        <blockquote {...props}>
                          {children}
                        </blockquote>
                        {/* 如果是CTA blockquote，在其后插入视频预览卡片 */}
                        {isCTA && sampleVideo && (
                          <TemplateVideoPreviewCard
                            video={sampleVideo}
                            templateSlug={templateSlug || ''}
                            templateName={getTemplateName()}
                            loading={sampleVideoLoading}
                            language={lang || 'en'}
                          />
                        )}
                      </>
                    )
                  }
                }}
              >
                {guideData.guide_content}
              </ReactMarkdown>
            </Box>

            {/* FAQ部分 */}
            {guideData.faq_items && guideData.faq_items.length > 0 && (
              <Box id="faq-section" sx={{ mt: 6 }}>
                <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
                  {lang === 'zh' ? '常见问题 (FAQ)' : 'Frequently Asked Questions (FAQ)'}
                </Typography>
                {guideData.faq_items.map((faq, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 3,
                      p: 3,
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider'
                    }}
                  >
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      {faq.question}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {faq.answer}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* 页脚信息 */}
            <Box sx={{ mt: 6, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                {lang === 'zh' ? '关键词' : 'Keywords'}: {guideData.meta_keywords}
              </Typography>
            </Box>
          </Box>

          {/* 右侧目录导航 - 仅桌面端显示 */}
          {tableOfContents.length > 0 && (
            <Box
              sx={{
                display: { xs: 'none', lg: 'block' },
                width: '280px',
                flexShrink: 0
              }}
            >
              <Paper
                elevation={2}
                sx={{
                  position: 'sticky',
                  top: 85, // 65px header + 20px 间距
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  maxHeight: 'calc(100vh - 105px)', // 85px top + 20px bottom spacing
                  overflow: 'auto',
                  bgcolor: 'background.paper',
                  zIndex: 10,
                  '&::-webkit-scrollbar': {
                    width: '6px'
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '3px'
                  }
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <MenuIcon fontSize="small" />
                  {lang === 'zh' ? '目录' : 'Table of Contents'}
                </Typography>
                <List dense disablePadding>
                  {tableOfContents.map((item, index) => (
                    <ListItem key={index} disablePadding>
                      <ListItemButton
                        onClick={() => scrollToSection(item.anchor)}
                        selected={activeSection === item.anchor}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          py: 0.75,
                          px: 1.5,
                          '&.Mui-selected': {
                            bgcolor: 'primary.main',
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'primary.dark'
                            }
                          },
                          '&:hover': {
                            bgcolor: 'action.hover'
                          }
                        }}
                      >
                        <ListItemText
                          primary={item.title}
                          primaryTypographyProps={{
                            variant: 'body2',
                            sx: {
                              fontSize: '0.875rem',
                              lineHeight: 1.4,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>

              {/* 推荐模板区域 */}
              {recommendedTemplates.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      background: 'linear-gradient(to bottom, rgba(25, 118, 210, 0.02) 0%, transparent 100%)'
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        mb: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: 'text.primary',
                        fontSize: '0.9rem'
                      }}
                    >
                      <PlayArrow fontSize="small" sx={{ color: 'primary.main' }} />
                      {lang === 'zh' ? '推荐模板' : 'Recommended Templates'}
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {recommendedTemplates.map((template) => (
                        <Card
                          key={template.id}
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            '&:hover': {
                              borderColor: 'primary.main',
                              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)',
                              transform: 'translateY(-3px) scale(1.01)'
                            }
                          }}
                        >
                          <CardActionArea
                            onClick={() => handleTemplateClick(template.slug)}
                            sx={{
                              '&:hover .MuiCardMedia-root': {
                                transform: 'scale(1.05)'
                              }
                            }}
                          >
                            {template.thumbnail_url && (
                              <Box sx={{ overflow: 'hidden', bgcolor: 'grey.100' }}>
                                <CardMedia
                                  component="img"
                                  height="140"
                                  image={template.thumbnail_url}
                                  alt={getTemplateMultilingualName(template)}
                                  sx={{
                                    objectFit: 'cover',
                                    transition: 'transform 0.3s ease'
                                  }}
                                />
                              </Box>
                            )}
                            <CardContent sx={{ p: 1.5 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  mb: 0.5,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  lineHeight: 1.4,
                                  fontSize: '0.875rem',
                                  color: 'text.primary'
                                }}
                              >
                                {getTemplateMultilingualName(template)}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  fontSize: '0.7rem',
                                  lineHeight: 1.4
                                }}
                              >
                                {getTemplateDescription(template)}
                              </Typography>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      ))}
                    </Box>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Container>
    </>
  )
}

export default SEOGuidePage
