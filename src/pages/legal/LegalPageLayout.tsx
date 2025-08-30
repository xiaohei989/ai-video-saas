import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, Clock, FileText, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface TableOfContentsItem {
  id: string
  title: string
  level: number
}

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  tableOfContents: TableOfContentsItem[]
  children: React.ReactNode
  pageType?: 'privacyPolicy' | 'termsOfService' | 'cookiePolicy'
}

export function LegalPageLayout({ 
  title, 
  lastUpdated, 
  tableOfContents, 
  children,
  pageType = 'privacyPolicy'
}: LegalPageLayoutProps) {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)

  // 监听滚动，高亮当前章节
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: '-20% 0px -35% 0px' }
    )

    // 观察所有章节标题
    tableOfContents.forEach(({ id }) => {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [tableOfContents])

  // 监听滚动，显示返回顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 侧边栏 - 目录 */}
          <div className="lg:col-span-1 print:hidden">
            <div className="sticky top-8 space-y-6 print:static">
              {/* 文档信息 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <FileText className="h-4 w-4" />
                    <span>{t('legal.common.legalDocument')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <Clock className="h-3 w-3" />
                    <span>{t(`legal.${pageType}.lastUpdated`)}: {lastUpdated}</span>
                  </div>
                  <Button 
                    onClick={handlePrint}
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    {t('legal.common.printPdf')}
                  </Button>
                </CardContent>
              </Card>

              {/* 目录 */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">{t('legal.common.tableOfContents')}</h3>
                  <nav className="space-y-1">
                    {tableOfContents.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className={`
                          block w-full text-left text-sm py-1 px-2 rounded transition-colors
                          ${item.level === 1 ? 'font-medium' : 'ml-3 text-muted-foreground'}
                          ${activeSection === item.id 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-muted'
                          }
                        `}
                      >
                        {item.title}
                      </button>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 主要内容 */}
          <div className="lg:col-span-3 print:col-span-full">
            <div className="max-w-4xl">
              {/* 页面标题 */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-4">{title}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{t(`legal.${pageType}.effectiveDate`)}: {lastUpdated}</span>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="prose prose-slate dark:prose-invert max-w-none">
                {children}
              </div>

              {/* 联系信息 */}
              <div className="mt-12 p-6 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">{t(`legal.${pageType}.questionsContact`)}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t(`legal.${pageType}.contactDescription`)}
                </p>
                <div className="text-sm">
                  <p>{t(`legal.${pageType}.email`)}: legal@veo3video.me</p>
                  <p>{t(`legal.${pageType}.website`)}: https://veo3video.me</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 返回顶部按钮 */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-8 right-8 rounded-full shadow-lg z-50 print:hidden"
        >
          <ArrowUp className="h-4 w-4" />
          <span className="sr-only">{t('legal.common.backToTop')}</span>
        </Button>
      )}

    </div>
  )
}